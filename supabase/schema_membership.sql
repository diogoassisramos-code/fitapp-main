-- ============================================================================
-- CoachFit — Migration: MEMBERSHIP aluno<->consultoria (separa PESSOA do VINCULO)
-- ----------------------------------------------------------------------------
-- Introduz public.aluno_consultoria como o VINCULO/assinatura entre um aluno
-- (identidade por CPF) e uma consultoria, para que a TROCA DE CONSULTOR preserve
-- o historico (treinos/dietas/protocolos/check-ins NAO sao reescritos) e habilite
-- CANCELAMENTO self-service (FIM DE CICLO: acesso ate o vencimento; mantem conta).
--
-- alunos.consultoria_id vira CACHE do vinculo "com acesso" (ativa OU cancelada
-- ainda dentro do ciclo). A RLS do consultor passa de
--   "consultoria_id = current_consultoria_id()"  ->  consultor_tem_vinculo(<aluno>).
--
-- Hardening pos-revisao adversarial:
--  - consultor NAO insere vinculo direto (anti-takeover cross-tenant); criacao
--    via trigger de bootstrap no INSERT de alunos + RPC vincular_aluno() que so
--    abre vinculo se o aluno nao pertence a OUTRO tenant.
--  - cancelamento "fim de ciclo" mantem acesso ate fim (consultor_tem_vinculo
--    aceita 'cancelada' enquanto now() < fim).
--  - cache zerado quando o aluno fica sem nenhum vinculo com acesso.
--  - alunos.consultoria_id read-only para authenticated (so o trigger escreve).
--  - RPCs serializadas por advisory lock (anti-corrida na troca/cancelamento).
--  - corrige bug PRE-EXISTENTE do checkins UPDATE (aluno podia forjar resposta).
--
-- Idempotente / re-rodavel. Rode no SQL Editor do Supabase DEPOIS de
-- schema.sql + schema_dieta_protocolo.sql + schema_checkin.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabela public.aluno_consultoria (o VINCULO / assinatura)
-- ---------------------------------------------------------------------------
do $$ begin
  create type vinculo_status as enum ('ativa','encerrada','cancelada');
exception when duplicate_object then null; end $$;

create table if not exists public.aluno_consultoria (
  id                   uuid primary key default gen_random_uuid(),
  aluno_id             uuid not null references public.alunos(id) on delete cascade,
  consultoria_id       uuid not null references public.consultorias(id) on delete cascade,
  status               vinculo_status not null default 'ativa',
  plano_id             uuid,                         -- FK -> planos (fase posterior); nullable
  inicio               timestamptz not null default now(),
  fim                  timestamptz,
  cancelado_em         timestamptz,
  motivo_cancelamento  text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Re-run defensivo: se a tabela ja existia como text+check (rascunho antigo),
-- converte a coluna para o enum.
do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'aluno_consultoria'
       and column_name = 'status' and data_type <> 'USER-DEFINED'
  ) then
    alter table public.aluno_consultoria
      alter column status drop default,
      alter column status type vinculo_status using status::vinculo_status,
      alter column status set default 'ativa';
  end if;
exception when others then null; end $$;

-- No maximo UM vinculo 'ativa' por aluno (indice unico PARCIAL).
-- NOTA: este indice e barreira de INTEGRIDADE, nao de AUTORIZACAO. A unicidade
-- de "acesso" (ativa + cancelada-com-fim-futuro) e imposta nas RPCs (achado:
-- indice parcial nao pode usar now() por nao ser IMMUTABLE).
create unique index if not exists aluno_consultoria_um_ativo_uq
  on public.aluno_consultoria(aluno_id) where status = 'ativa';

-- Indices para os EXISTS da RLS / consultor_tem_vinculo.
create index if not exists idx_ac_consultoria_aluno_status
  on public.aluno_consultoria(consultoria_id, aluno_id, status);
create index if not exists idx_ac_aluno_status
  on public.aluno_consultoria(aluno_id, status);
create index if not exists idx_ac_consultoria
  on public.aluno_consultoria(consultoria_id);

drop trigger if exists trg_aluno_consultoria_updated on public.aluno_consultoria;
create trigger trg_aluno_consultoria_updated before update on public.aluno_consultoria
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. CACHE alunos.consultoria_id (definido ANTES do backfill p/ ja valer).
--    Recalcula o cache do aluno afetado. "Com acesso" = vinculo 'ativa' OU
--    'cancelada' cujo fim ainda esta no futuro (fim de ciclo). Sem nenhum
--    vinculo com acesso => cache = null (aluno sem consultor; inserts de filhos
--    passam a falhar nos triggers set_*_consultoria, o que e o desejado).
-- ---------------------------------------------------------------------------
create or replace function public.consultoria_do_vinculo_com_acesso(p_aluno uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select ac.consultoria_id
    from public.aluno_consultoria ac
   where ac.aluno_id = p_aluno
     and ( ac.status = 'ativa'
        or (ac.status = 'cancelada' and ac.fim is not null and ac.fim > now()) )
   order by (ac.status = 'ativa') desc, ac.inicio desc
   limit 1
$$;
revoke execute on function public.consultoria_do_vinculo_com_acesso(uuid) from anon, public;
grant  execute on function public.consultoria_do_vinculo_com_acesso(uuid) to authenticated;

create or replace function public.sync_aluno_consultoria_cache()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_aluno uuid := coalesce(new.aluno_id, old.aluno_id);
  v_cid   uuid := public.consultoria_do_vinculo_com_acesso(v_aluno);
begin
  -- Sincroniza o cache (inclusive zerando para null quando nao ha mais acesso).
  update public.alunos a
     set consultoria_id = v_cid
   where a.id = v_aluno
     and a.consultoria_id is distinct from v_cid;
  return null;
end $$;
drop trigger if exists trg_aluno_consultoria_cache on public.aluno_consultoria;
create trigger trg_aluno_consultoria_cache
  after insert or update or delete on public.aluno_consultoria
  for each row execute function public.sync_aluno_consultoria_cache();

-- ---------------------------------------------------------------------------
-- 3b. Bootstrap: todo aluno recem-criado por consultor ganha um vinculo 'ativa'
--     imediatamente, tornando o estado "aluno sem vinculo" inalcancavel (fecha
--     a janela de sequestro cross-tenant). So cria se o aluno tem consultoria_id
--     e nao existe nenhum vinculo (qualquer status). SECURITY DEFINER ignora a
--     RLS da propria aluno_consultoria de forma controlada.
-- ---------------------------------------------------------------------------
create or replace function public.bootstrap_aluno_vinculo()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.consultoria_id is not null
     and not exists (select 1 from public.aluno_consultoria ac where ac.aluno_id = new.id) then
    insert into public.aluno_consultoria (aluno_id, consultoria_id, plano_id, status, inicio)
      values (new.id, new.consultoria_id, new.plano_id, 'ativa',
              coalesce((new.inicio::timestamp at time zone 'UTC'), now()));
  end if;
  return null;
end $$;
drop trigger if exists trg_aluno_bootstrap_vinculo on public.alunos;
create trigger trg_aluno_bootstrap_vinculo
  after insert on public.alunos
  for each row execute function public.bootstrap_aluno_vinculo();

-- ---------------------------------------------------------------------------
-- 2. BACKFILL: cada aluno com consultoria_id not null e SEM vinculo ATIVO ganha
--    um vinculo 'ativa'. Filtra por status='ativa' (nao por qualquer status),
--    para nao deixar aluno com cache setado e sem vinculo ativo em re-runs apos
--    cancelamentos. Idempotente. inicio normalizado a 00:00 UTC (evita desvio de
--    fuso na variante "so o meu periodo").
-- ---------------------------------------------------------------------------
insert into public.aluno_consultoria (aluno_id, consultoria_id, plano_id, status, inicio)
select a.id,
       a.consultoria_id,
       a.plano_id,
       'ativa',
       coalesce((a.inicio::timestamp at time zone 'UTC'), now())
  from public.alunos a
 where a.consultoria_id is not null
   and not exists (
     select 1 from public.aluno_consultoria ac
      where ac.aluno_id = a.id and ac.status = 'ativa'
   );

-- ---------------------------------------------------------------------------
-- 4. Helper public.consultor_tem_vinculo(p_aluno) — o consultor logado tem
--    ACESSO ao aluno? Acesso = vinculo 'ativa' OU 'cancelada' enquanto
--    now() < fim (carencia ate o vencimento — semantica FIM DE CICLO).
--
--    Decisao v1: vinculo com acesso => o consultor enxerga TODO o historico do
--    aluno (inclusive o criado por consultores anteriores), pois o objetivo e
--    CONTINUAR o trabalho.
--
--    Variante "so o meu periodo" (descomente p/ restringir por created_at do
--    dado — recomendado AO MENOS para checkins/fotos, dado pessoal sensivel):
--      create or replace function public.consultor_tem_vinculo(
--        p_aluno uuid, p_quando timestamptz default now())
--      returns boolean language sql stable security definer
--      set search_path = public, pg_temp as $fn$
--        select exists (
--          select 1 from public.aluno_consultoria ac
--           where ac.aluno_id = p_aluno
--             and ac.consultoria_id = public.current_consultoria_id()
--             and ( ac.status = 'ativa'
--                or (ac.status = 'cancelada' and ac.fim is not null and ac.fim > now()) )
--             and p_quando >= ac.inicio
--             and p_quando <  coalesce(ac.fim, 'infinity'::timestamptz)
--        )
--      $fn$;
--    e nas policies de checkins passar consultor_tem_vinculo(aluno_id, checkins.created_at).
-- ---------------------------------------------------------------------------
create or replace function public.consultor_tem_vinculo(p_aluno uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.aluno_consultoria ac
     where ac.aluno_id = p_aluno
       and ac.consultoria_id = public.current_consultoria_id()
       and ( ac.status = 'ativa'
          or (ac.status = 'cancelada' and ac.fim is not null and ac.fim > now()) )
  )
$$;
revoke execute on function public.consultor_tem_vinculo(uuid) from anon, public;
grant  execute on function public.consultor_tem_vinculo(uuid) to authenticated;

-- ============================================================================
-- 5. RLS reescrita — consultor passa de "consultoria_id = current_consultoria_id()"
--    para consultor_tem_vinculo(<aluno_id resolvido pela cadeia>).
--    Mantem is_admin() e o caminho do aluno (current_aluno_id()).
--    Em INSERT/UPDATE do consultor, exige vinculo COM ACESSO.
-- ============================================================================

-- ---------- RLS da propria aluno_consultoria ----------
alter table public.aluno_consultoria enable row level security;

-- SELECT: admin | consultor da consultoria do vinculo | aluno dono.
-- (Aluno ve o proprio historico de vinculos — esperado para self-service.)
drop policy if exists aluno_consultoria_select on public.aluno_consultoria;
create policy aluno_consultoria_select on public.aluno_consultoria for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
  or (public.auth_app_role() = 'aluno'     and aluno_id = public.current_aluno_id())
);

-- INSERT: SOMENTE admin. Consultor NUNCA insere vinculo direto (anti-takeover
-- cross-tenant — achado critico). Bootstrap automatico via trigger de alunos +
-- RPC vincular_aluno() (SECURITY DEFINER, valida origem) cobrem o caminho legitimo.
drop policy if exists aluno_consultoria_insert on public.aluno_consultoria;
create policy aluno_consultoria_insert on public.aluno_consultoria for insert with check (
  public.is_admin()
);

-- UPDATE: admin | consultor da consultoria do vinculo. NAO permite remanejar o
-- vinculo para outro tenant (consultoria_id imutavel: WITH CHECK exige seguir na
-- mesma consultoria do USING).
drop policy if exists aluno_consultoria_update on public.aluno_consultoria;
create policy aluno_consultoria_update on public.aluno_consultoria for update
  using  (public.is_admin()
          or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()))
  with check (public.is_admin()
          or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));

-- DELETE: so admin (troca/cancelamento usam RPC; vinculos preservam historico).
drop policy if exists aluno_consultoria_delete on public.aluno_consultoria;
create policy aluno_consultoria_delete on public.aluno_consultoria for delete using (public.is_admin());

-- ---------- alunos ----------
drop policy if exists alunos_select on public.alunos;
create policy alunos_select on public.alunos for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(id))
  or (public.auth_app_role() = 'aluno'     and id = public.current_aluno_id())
);
-- INSERT: consultor cria aluno na PROPRIA consultoria. O cache consultoria_id
-- = current_consultoria_id() e o ponto de partida; o trigger de bootstrap abre
-- o vinculo 'ativa' logo apos, atomicamente, fechando a janela de sequestro.
drop policy if exists alunos_insert on public.alunos;
create policy alunos_insert on public.alunos for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
);
drop policy if exists alunos_update on public.alunos;
create policy alunos_update on public.alunos for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(id)))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(id)));
drop policy if exists alunos_delete on public.alunos;
create policy alunos_delete on public.alunos for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(id)));

-- ---------- treinos (aluno NAO ve rascunho) ----------
drop policy if exists treinos_select on public.treinos;
create policy treinos_select on public.treinos for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(aluno_id))
  or (public.auth_app_role() = 'aluno'     and aluno_id = public.current_aluno_id() and not rascunho)
);
drop policy if exists treinos_insert on public.treinos;
create policy treinos_insert on public.treinos for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(aluno_id))
);
drop policy if exists treinos_update on public.treinos;
create policy treinos_update on public.treinos for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(aluno_id)))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(aluno_id)));
drop policy if exists treinos_delete on public.treinos;
create policy treinos_delete on public.treinos for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(aluno_id)));

-- ---------- exercicios (resolve aluno via treinos) ----------
drop policy if exists exercicios_select on public.exercicios;
create policy exercicios_select on public.exercicios for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.treinos t
        where t.id = exercicios.treino_id and public.consultor_tem_vinculo(t.aluno_id)))
  or (public.auth_app_role() = 'aluno' and exists (
        select 1 from public.treinos t
        where t.id = exercicios.treino_id and t.aluno_id = public.current_aluno_id() and not t.rascunho))
);
drop policy if exists exercicios_insert on public.exercicios;
create policy exercicios_insert on public.exercicios for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.treinos t
        where t.id = exercicios.treino_id and public.consultor_tem_vinculo(t.aluno_id)))
);
drop policy if exists exercicios_update on public.exercicios;
create policy exercicios_update on public.exercicios for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.treinos t
        where t.id = exercicios.treino_id and public.consultor_tem_vinculo(t.aluno_id))))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.treinos t
        where t.id = exercicios.treino_id and public.consultor_tem_vinculo(t.aluno_id))));
drop policy if exists exercicios_delete on public.exercicios;
create policy exercicios_delete on public.exercicios for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.treinos t
        where t.id = exercicios.treino_id and public.consultor_tem_vinculo(t.aluno_id))));

-- ---------- dietas (aluno NAO ve rascunho) ----------
drop policy if exists dietas_select on public.dietas;
create policy dietas_select on public.dietas for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(aluno_id))
  or (public.auth_app_role() = 'aluno'     and aluno_id = public.current_aluno_id() and not rascunho)
);
drop policy if exists dietas_insert on public.dietas;
create policy dietas_insert on public.dietas for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(aluno_id))
);
drop policy if exists dietas_update on public.dietas;
create policy dietas_update on public.dietas for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(aluno_id)))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(aluno_id)));
drop policy if exists dietas_delete on public.dietas;
create policy dietas_delete on public.dietas for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(aluno_id)));

-- ---------- refeicoes (resolve aluno via dietas) ----------
drop policy if exists refeicoes_select on public.refeicoes;
create policy refeicoes_select on public.refeicoes for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.dietas d
        where d.id = refeicoes.dieta_id and public.consultor_tem_vinculo(d.aluno_id)))
  or (public.auth_app_role() = 'aluno' and exists (
        select 1 from public.dietas d
        where d.id = refeicoes.dieta_id and d.aluno_id = public.current_aluno_id() and not d.rascunho))
);
drop policy if exists refeicoes_insert on public.refeicoes;
create policy refeicoes_insert on public.refeicoes for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.dietas d
        where d.id = refeicoes.dieta_id and public.consultor_tem_vinculo(d.aluno_id)))
);
drop policy if exists refeicoes_update on public.refeicoes;
create policy refeicoes_update on public.refeicoes for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.dietas d
        where d.id = refeicoes.dieta_id and public.consultor_tem_vinculo(d.aluno_id))))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.dietas d
        where d.id = refeicoes.dieta_id and public.consultor_tem_vinculo(d.aluno_id))));
drop policy if exists refeicoes_delete on public.refeicoes;
create policy refeicoes_delete on public.refeicoes for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.dietas d
        where d.id = refeicoes.dieta_id and public.consultor_tem_vinculo(d.aluno_id))));

-- ---------- alimentos (resolve aluno via refeicoes -> dietas) ----------
drop policy if exists alimentos_select on public.alimentos;
create policy alimentos_select on public.alimentos for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.refeicoes r join public.dietas d on d.id = r.dieta_id
        where r.id = alimentos.refeicao_id and public.consultor_tem_vinculo(d.aluno_id)))
  or (public.auth_app_role() = 'aluno' and exists (
        select 1 from public.refeicoes r join public.dietas d on d.id = r.dieta_id
        where r.id = alimentos.refeicao_id and d.aluno_id = public.current_aluno_id() and not d.rascunho))
);
drop policy if exists alimentos_insert on public.alimentos;
create policy alimentos_insert on public.alimentos for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.refeicoes r join public.dietas d on d.id = r.dieta_id
        where r.id = alimentos.refeicao_id and public.consultor_tem_vinculo(d.aluno_id)))
);
drop policy if exists alimentos_update on public.alimentos;
create policy alimentos_update on public.alimentos for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.refeicoes r join public.dietas d on d.id = r.dieta_id
        where r.id = alimentos.refeicao_id and public.consultor_tem_vinculo(d.aluno_id))))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.refeicoes r join public.dietas d on d.id = r.dieta_id
        where r.id = alimentos.refeicao_id and public.consultor_tem_vinculo(d.aluno_id))));
drop policy if exists alimentos_delete on public.alimentos;
create policy alimentos_delete on public.alimentos for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.refeicoes r join public.dietas d on d.id = r.dieta_id
        where r.id = alimentos.refeicao_id and public.consultor_tem_vinculo(d.aluno_id))));

-- ---------- protocolos (aluno NAO ve rascunho) ----------
drop policy if exists protocolos_select on public.protocolos;
create policy protocolos_select on public.protocolos for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(aluno_id))
  or (public.auth_app_role() = 'aluno'     and aluno_id = public.current_aluno_id() and not rascunho)
);
drop policy if exists protocolos_insert on public.protocolos;
create policy protocolos_insert on public.protocolos for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(aluno_id))
);
drop policy if exists protocolos_update on public.protocolos;
create policy protocolos_update on public.protocolos for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(aluno_id)))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(aluno_id)));
drop policy if exists protocolos_delete on public.protocolos;
create policy protocolos_delete on public.protocolos for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(aluno_id)));

-- ---------- protocolo_blocos (resolve aluno via protocolos) ----------
drop policy if exists blocos_select on public.protocolo_blocos;
create policy blocos_select on public.protocolo_blocos for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.protocolos p
        where p.id = protocolo_blocos.protocolo_id and public.consultor_tem_vinculo(p.aluno_id)))
  or (public.auth_app_role() = 'aluno' and exists (
        select 1 from public.protocolos p
        where p.id = protocolo_blocos.protocolo_id and p.aluno_id = public.current_aluno_id() and not p.rascunho))
);
drop policy if exists blocos_insert on public.protocolo_blocos;
create policy blocos_insert on public.protocolo_blocos for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.protocolos p
        where p.id = protocolo_blocos.protocolo_id and public.consultor_tem_vinculo(p.aluno_id)))
);
drop policy if exists blocos_update on public.protocolo_blocos;
create policy blocos_update on public.protocolo_blocos for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.protocolos p
        where p.id = protocolo_blocos.protocolo_id and public.consultor_tem_vinculo(p.aluno_id))))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.protocolos p
        where p.id = protocolo_blocos.protocolo_id and public.consultor_tem_vinculo(p.aluno_id))));
drop policy if exists blocos_delete on public.protocolo_blocos;
create policy blocos_delete on public.protocolo_blocos for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.protocolos p
        where p.id = protocolo_blocos.protocolo_id and public.consultor_tem_vinculo(p.aluno_id))));

-- ---------- protocolo_itens (resolve aluno via blocos -> protocolos) ----------
drop policy if exists itens_select on public.protocolo_itens;
create policy itens_select on public.protocolo_itens for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.protocolo_blocos b join public.protocolos p on p.id = b.protocolo_id
        where b.id = protocolo_itens.bloco_id and public.consultor_tem_vinculo(p.aluno_id)))
  or (public.auth_app_role() = 'aluno' and exists (
        select 1 from public.protocolo_blocos b join public.protocolos p on p.id = b.protocolo_id
        where b.id = protocolo_itens.bloco_id and p.aluno_id = public.current_aluno_id() and not p.rascunho))
);
drop policy if exists itens_insert on public.protocolo_itens;
create policy itens_insert on public.protocolo_itens for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.protocolo_blocos b join public.protocolos p on p.id = b.protocolo_id
        where b.id = protocolo_itens.bloco_id and public.consultor_tem_vinculo(p.aluno_id)))
);
drop policy if exists itens_update on public.protocolo_itens;
create policy itens_update on public.protocolo_itens for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.protocolo_blocos b join public.protocolos p on p.id = b.protocolo_id
        where b.id = protocolo_itens.bloco_id and public.consultor_tem_vinculo(p.aluno_id))))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.protocolo_blocos b join public.protocolos p on p.id = b.protocolo_id
        where b.id = protocolo_itens.bloco_id and public.consultor_tem_vinculo(p.aluno_id))));
drop policy if exists itens_delete on public.protocolo_itens;
create policy itens_delete on public.protocolo_itens for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and exists (
        select 1 from public.protocolo_blocos b join public.protocolos p on p.id = b.protocolo_id
        where b.id = protocolo_itens.bloco_id and public.consultor_tem_vinculo(p.aluno_id))));

-- ---------- checkins ----------
drop policy if exists checkins_select on public.checkins;
create policy checkins_select on public.checkins for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(aluno_id))
  or (public.auth_app_role() = 'aluno'     and aluno_id = public.current_aluno_id())
);
drop policy if exists checkins_insert on public.checkins;
create policy checkins_insert on public.checkins for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(aluno_id))
  or (public.auth_app_role() = 'aluno'     and aluno_id = public.current_aluno_id() and status = 'pendente')
);
-- UPDATE: consultor responde (vinculo); aluno corrige o PROPRIO so enquanto
-- pendente. CORRIGE bug pre-existente: o ramo do aluno no WITH CHECK agora
-- reexige status='pendente' AND resposta_coach is null (o aluno nao consegue
-- forjar resposta do coach nem marcar como respondido).
drop policy if exists checkins_update on public.checkins;
create policy checkins_update on public.checkins for update
  using (
    public.is_admin()
    or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(aluno_id))
    or (public.auth_app_role() = 'aluno' and aluno_id = public.current_aluno_id() and status = 'pendente')
  )
  with check (
    public.is_admin()
    or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(aluno_id))
    or (public.auth_app_role() = 'aluno' and aluno_id = public.current_aluno_id()
        and status = 'pendente' and resposta_coach is null)
  );
drop policy if exists checkins_delete on public.checkins;
create policy checkins_delete on public.checkins for delete using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(aluno_id))
);

-- ============================================================================
-- 6a. RPC public.vincular_aluno(p_aluno) — abre o vinculo inicial de forma
--     SEGURA para o consultor logado. So permite se o aluno NAO possui nenhum
--     vinculo (ativo ou historico) de OUTRA consultoria (anti-takeover) e nao
--     possui vinculo com acesso. SECURITY DEFINER + advisory lock (anti-corrida).
--     Usar quando o caminho de bootstrap automatico nao se aplica (ex.: reabrir
--     vinculo do PROPRIO consultor para aluno que ele encerrou).
-- ============================================================================
create or replace function public.vincular_aluno(p_aluno uuid)
returns public.aluno_consultoria
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_cid  uuid := public.current_consultoria_id();
  v_row  public.aluno_consultoria;
begin
  if not (public.auth_app_role() = 'consultor') or v_cid is null then
    raise exception 'apenas consultor pode vincular aluno';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_aluno::text, 0));

  if not exists (select 1 from public.alunos where id = p_aluno) then
    raise exception 'aluno % inexistente', p_aluno;
  end if;
  -- Anti-takeover: nenhum vinculo (qualquer status) de OUTRA consultoria.
  if exists (
    select 1 from public.aluno_consultoria ac
     where ac.aluno_id = p_aluno and ac.consultoria_id <> v_cid
  ) then
    raise exception 'aluno % pertence/pertenceu a outra consultoria; troca so via admin', p_aluno;
  end if;
  -- Ja tem acesso => no-op (retorna o vinculo com acesso).
  if public.consultoria_do_vinculo_com_acesso(p_aluno) is not null then
    select * into v_row from public.aluno_consultoria
     where aluno_id = p_aluno
       and ( status = 'ativa' or (status = 'cancelada' and fim > now()) )
     order by (status = 'ativa') desc, inicio desc limit 1;
    return v_row;
  end if;

  insert into public.aluno_consultoria (aluno_id, consultoria_id, status, inicio)
    values (p_aluno, v_cid, 'ativa', now())
    returning * into v_row;
  return v_row;
end $$;
revoke execute on function public.vincular_aluno(uuid) from anon, public;
grant  execute on function public.vincular_aluno(uuid) to authenticated;

-- ============================================================================
-- 6b. RPC public.trocar_consultor(p_aluno, p_nova_consultoria) — RESTRITO A ADMIN.
--     Encerra TODO vinculo com acesso (ativa OU cancelada-com-fim-futuro) e abre
--     um novo 'ativa', SEM reescrever treino/dieta/etc. Serializa por advisory
--     lock. O trigger atualiza o cache alunos.consultoria_id.
-- ============================================================================
create or replace function public.trocar_consultor(p_aluno uuid, p_nova_consultoria uuid)
returns public.aluno_consultoria
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_novo  public.aluno_consultoria;
  v_atual uuid;
begin
  if not public.is_admin() then
    raise exception 'apenas admin pode trocar consultor';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_aluno::text, 0));

  if not exists (select 1 from public.alunos where id = p_aluno) then
    raise exception 'aluno % inexistente', p_aluno;
  end if;
  if not exists (select 1 from public.consultorias where id = p_nova_consultoria) then
    raise exception 'consultoria % inexistente', p_nova_consultoria;
  end if;

  v_atual := public.consultoria_do_vinculo_com_acesso(p_aluno);
  if v_atual is not distinct from p_nova_consultoria then
    raise exception 'aluno ja vinculado/com acesso a consultoria %', p_nova_consultoria;
  end if;

  -- Encerra TODO vinculo com acesso (evita 2 tenants com acesso simultaneo).
  update public.aluno_consultoria
     set status = 'encerrada', fim = now()
   where aluno_id = p_aluno
     and ( status = 'ativa'
        or (status = 'cancelada' and fim is not null and fim > now()) );

  insert into public.aluno_consultoria (aluno_id, consultoria_id, status, inicio)
    values (p_aluno, p_nova_consultoria, 'ativa', now())
    returning * into v_novo;

  return v_novo;
end $$;
revoke execute on function public.trocar_consultor(uuid, uuid) from anon, public;
grant  execute on function public.trocar_consultor(uuid, uuid) to authenticated;  -- is_admin() filtra dentro

-- ============================================================================
-- 7. RPC public.cancelar_vinculo(p_aluno, p_motivo) — CANCELAMENTO self-service.
--    Permitido ao PROPRIO aluno (current_aluno_id() = p_aluno) ou ao admin.
--    Semantica FIM DE CICLO: status='cancelada', cancelado_em=now(),
--    fim = alunos.proximo_vencimento (se futuro) senao now(). O acesso do
--    consultor PERSISTE ate fim (consultor_tem_vinculo aceita 'cancelada' com
--    fim futuro). NAO apaga conta/dados. Idempotente: 2a chamada e no-op (retorna
--    o vinculo ja cancelado em vez de erro). Serializa por advisory lock.
-- ============================================================================
create or replace function public.cancelar_vinculo(p_aluno uuid, p_motivo text default null)
returns public.aluno_consultoria
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_venc date;
  v_fim  timestamptz;
  v_row  public.aluno_consultoria;
begin
  if not (public.is_admin() or public.current_aluno_id() = p_aluno) then
    raise exception 'sem permissao para cancelar vinculo do aluno %', p_aluno;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_aluno::text, 0));

  select proximo_vencimento into v_venc from public.alunos where id = p_aluno;
  if v_venc is not null and (v_venc::timestamp at time zone 'UTC') > now() then
    v_fim := (v_venc::timestamp at time zone 'UTC');   -- fim de ciclo: ate o vencimento
  else
    v_fim := now();
  end if;

  update public.aluno_consultoria
     set status = 'cancelada',
         cancelado_em = now(),
         fim = v_fim,
         motivo_cancelamento = p_motivo
   where aluno_id = p_aluno and status = 'ativa'
   returning * into v_row;

  if v_row.id is null then
    -- Sem vinculo 'ativa': idempotente — retorna o ultimo 'cancelada' (no-op).
    select * into v_row from public.aluno_consultoria
     where aluno_id = p_aluno and status = 'cancelada'
     order by cancelado_em desc nulls last limit 1;
    if v_row.id is null then
      raise exception 'aluno % nao possui vinculo ativo para cancelar', p_aluno;
    end if;
  end if;

  return v_row;
end $$;
revoke execute on function public.cancelar_vinculo(uuid, text) from anon, public;
grant  execute on function public.cancelar_vinculo(uuid, text) to authenticated;  -- checagem interna

-- ============================================================================
-- GRANTS da tabela de vinculo (PostgREST usa "authenticated"; RLS filtra).
--  - INSERT por authenticated existe mas a policy so deixa admin (consultor usa RPC).
-- ============================================================================
grant select, insert, update, delete on public.aluno_consultoria to authenticated;

-- ============================================================================
-- CACHE read-only: alunos.consultoria_id so deve ser escrito pelo trigger.
-- Revoga UPDATE da coluna para authenticated; concede as demais (mantem a
-- capacidade do consultor/admin de editar o resto do aluno).
-- ============================================================================
revoke update on public.alunos from authenticated;
grant update (
  plano_id, nome, cpf, email, telefone, objetivo, status_pagamento,
  proximo_vencimento, inicio, peso_inicial, peso_atual, aderencia_treino,
  checkin_pendente, aguardando_protocolo
) on public.alunos to authenticated;
-- (consultoria_id de fora => so o trigger sync_aluno_consultoria_cache escreve)

-- ============================================================================
-- Recarrega o cache de schema do PostgREST.
-- ============================================================================
notify pgrst, 'reload schema';
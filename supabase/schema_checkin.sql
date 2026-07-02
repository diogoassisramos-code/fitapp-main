-- ============================================================================
-- CoachFit — Check-in (mesmo padrão multi-tenant de treinos/dieta/protocolo).
-- O ALUNO envia o check-in (INSERT da própria semana); o CONSULTOR lê e responde
-- (UPDATE de resposta_coach + status). consultoria_id DENORMALIZADO, preenchido
-- por trigger a partir do aluno. Um trigger AFTER mantém alunos.checkin_pendente
-- em dia (= existe check-in pendente). Idempotente. Rode no SQL Editor depois do
-- schema.sql principal. O seed de exemplo está no fim (comentado).
-- ============================================================================

create table if not exists public.checkins (
  id              uuid primary key default gen_random_uuid(),
  consultoria_id  uuid not null references public.consultorias(id) on delete cascade,
  aluno_id        uuid not null references public.alunos(id) on delete cascade,
  semana          integer not null,
  enviado_em      timestamptz not null default now(),
  peso            numeric(6,2),
  -- [{ id, angulo, url }] — fotos enviadas pelo aluno (data URL ou storage).
  fotos           jsonb not null default '[]',
  energia         smallint not null default 3,  -- 1..5
  sono            smallint not null default 3,  -- 1..5
  dieta           smallint not null default 3,  -- 1..5
  treinos_feitos  integer not null default 0,
  treinos_totais  integer not null default 0,
  comentario      text,
  resposta_coach  text,
  status          text not null default 'pendente',  -- 'pendente' | 'respondido'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (aluno_id, semana),
  constraint checkins_status_chk check (status in ('pendente','respondido')),
  constraint checkins_energia_chk check (energia between 1 and 5),
  constraint checkins_sono_chk    check (sono    between 1 and 5),
  constraint checkins_dieta_chk   check (dieta   between 1 and 5)
);
create index if not exists idx_checkins_consultoria on public.checkins(consultoria_id);
create index if not exists idx_checkins_aluno       on public.checkins(aluno_id);
drop trigger if exists trg_checkins_updated on public.checkins;
create trigger trg_checkins_updated before update on public.checkins
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- consultoria_id copiado do aluno (client nunca envia)
-- ----------------------------------------------------------------------------
create or replace function public.set_checkin_consultoria()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  select consultoria_id into new.consultoria_id from public.alunos where id = new.aluno_id;
  if new.consultoria_id is null then raise exception 'aluno % inexistente', new.aluno_id; end if;
  return new;
end $$;
drop trigger if exists trg_checkin_consultoria on public.checkins;
create trigger trg_checkin_consultoria before insert or update on public.checkins
  for each row execute function public.set_checkin_consultoria();

-- ----------------------------------------------------------------------------
-- Solicitação de check-in pelo consultor (flag no aluno + mensagem opcional).
-- O consultor seta via UPDATE (RLS já permite consultor do tenant); o aluno lê
-- a própria; é limpa quando o aluno envia um check-in (trigger abaixo).
-- ----------------------------------------------------------------------------
alter table public.alunos add column if not exists checkin_solicitado boolean not null default false;
alter table public.alunos add column if not exists checkin_solicitado_em timestamptz;
alter table public.alunos add column if not exists checkin_solicitacao_msg text;

-- ----------------------------------------------------------------------------
-- Mantém alunos.checkin_pendente = (existe check-in pendente do aluno) e LIMPA
-- a solicitação quando o aluno envia um check-in novo (INSERT).
-- ----------------------------------------------------------------------------
create or replace function public.sync_aluno_checkin_pendente()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_aluno uuid := coalesce(new.aluno_id, old.aluno_id);
begin
  update public.alunos a
     set checkin_pendente = exists (
       select 1 from public.checkins c
       where c.aluno_id = v_aluno and c.status = 'pendente'
     ),
     checkin_solicitado = case when tg_op = 'INSERT' then false else a.checkin_solicitado end
   where a.id = v_aluno;
  return null;
end $$;
drop trigger if exists trg_checkin_sync_pendente on public.checkins;
create trigger trg_checkin_sync_pendente
  after insert or update or delete on public.checkins
  for each row execute function public.sync_aluno_checkin_pendente();

-- ----------------------------------------------------------------------------
-- Atualiza alunos.peso_atual e aderencia_treino a partir do check-in enviado
-- (o "peso atual" do aluno = peso do último check-in; aderência = treinos
-- feitos/planejados). Security definer: o aluno não pode dar UPDATE em alunos,
-- mas o trigger pode. Assim o dashboard do consultor reflete na hora.
-- ----------------------------------------------------------------------------
create or replace function public.sync_aluno_metricas_checkin()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.alunos a
     set peso_atual = coalesce(new.peso, a.peso_atual),
         aderencia_treino = case
           when coalesce(new.treinos_totais, 0) > 0
             then round(new.treinos_feitos::numeric / new.treinos_totais * 100)
           else a.aderencia_treino
         end
   where a.id = new.aluno_id;
  return null;
end $$;
drop trigger if exists trg_checkin_sync_metricas on public.checkins;
create trigger trg_checkin_sync_metricas
  after insert or update on public.checkins
  for each row execute function public.sync_aluno_metricas_checkin();

-- ----------------------------------------------------------------------------
-- RPC enviar_checkin: o ALUNO envia o check-in da semana em UMA chamada só
-- (resolve aluno_id pela sessão, calcula a semana e insere). Reduz 3 round-trips
-- a 1 — importante no free-tier, onde a 1ª query pós-inatividade é lenta.
-- ----------------------------------------------------------------------------
create or replace function public.enviar_checkin(
  p_peso            numeric  default null,
  p_fotos           jsonb    default '[]',
  p_energia         smallint default 3,
  p_sono            smallint default 3,
  p_dieta           smallint default 3,
  p_treinos_feitos  integer  default 0,
  p_treinos_totais  integer  default 0,
  p_comentario      text     default null
) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_aluno  uuid := public.current_aluno_id();
  v_semana integer;
begin
  if v_aluno is null then
    raise exception 'sem aluno na sessão';
  end if;
  -- Idempotente: se já existe um check-in pendente (não respondido), devolve-o
  -- sem criar outro (torna reenvio/retry seguros, sem duplicar).
  select semana into v_semana from public.checkins
   where aluno_id = v_aluno and status = 'pendente'
   order by semana desc limit 1;
  if v_semana is not null then
    return v_semana;
  end if;
  select coalesce(max(semana), 0) + 1 into v_semana
    from public.checkins where aluno_id = v_aluno;
  insert into public.checkins (
    aluno_id, semana, peso, fotos, energia, sono, dieta,
    treinos_feitos, treinos_totais, comentario, status
  ) values (
    v_aluno, v_semana, p_peso, coalesce(p_fotos, '[]'::jsonb),
    p_energia, p_sono, p_dieta, p_treinos_feitos, p_treinos_totais,
    p_comentario, 'pendente'
  ) on conflict (aluno_id, semana) do nothing;
  return v_semana;
end $$;
revoke execute on function public.enviar_checkin(numeric, jsonb, smallint, smallint, smallint, integer, integer, text) from anon, public;
grant  execute on function public.enviar_checkin(numeric, jsonb, smallint, smallint, smallint, integer, integer, text) to authenticated;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.checkins enable row level security;

-- SELECT: admin | consultor do tenant | aluno dono
drop policy if exists checkins_select on public.checkins;
create policy checkins_select on public.checkins for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
  or (public.auth_app_role() = 'aluno'     and aluno_id = public.current_aluno_id())
);

-- INSERT: admin | consultor do tenant | aluno só da própria assinatura
drop policy if exists checkins_insert on public.checkins;
create policy checkins_insert on public.checkins for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
  or (public.auth_app_role() = 'aluno'     and aluno_id = public.current_aluno_id())
);

-- UPDATE: consultor responde (tenant); aluno corrige o próprio enquanto pendente.
drop policy if exists checkins_update on public.checkins;
create policy checkins_update on public.checkins for update
  using (
    public.is_admin()
    or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
    or (public.auth_app_role() = 'aluno' and aluno_id = public.current_aluno_id() and status = 'pendente')
  )
  with check (
    public.is_admin()
    or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
    or (public.auth_app_role() = 'aluno' and aluno_id = public.current_aluno_id())
  );

-- DELETE: admin | consultor do tenant
drop policy if exists checkins_delete on public.checkins;
create policy checkins_delete on public.checkins for delete using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
);

-- ============================================================================
-- GRANTS
-- ============================================================================
grant select, insert, update, delete on public.checkins to authenticated;

-- ============================================================================
-- Recarrega o cache de schema do PostgREST.
-- ============================================================================
notify pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- SEED de exemplo (opcional): um check-in pendente para um aluno existente.
-- Descomente e troque o aluno_id por um id real da sua base.
-- ----------------------------------------------------------------------------
-- insert into public.checkins (aluno_id, semana, peso, energia, sono, dieta,
--   treinos_feitos, treinos_totais, comentario)
-- values ('<ALUNO_UUID>', 1, 80.5, 4, 3, 4, 4, 5, 'Primeira semana, animado!');

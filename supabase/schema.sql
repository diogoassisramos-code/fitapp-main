-- ============================================================================
-- CoachFit — Schema + RLS multi-tenant (Supabase / Postgres)
-- Fatia vertical: consultorias, profiles, alunos, treinos, exercicios.
--
-- Esta é a versão CORRIGIDA após revisão adversarial de segurança. Inclui:
--  - vínculo único aluno↔auth via profiles.aluno_id (sem alunos.auth_user_id)
--  - signup endurecido (sem sequestro de aluno entre consultorias)
--  - aluno NÃO vê treino/exercício em rascunho
--  - helpers SECURITY DEFINER (sem colisão com current_role do Postgres)
--  - WITH CHECK barrando escrita em tenant alheio
--  - grants por coluna (consultor não edita saldo/a_liberar)
--
-- Como aplicar: cole inteiro no SQL Editor do Supabase e rode. Idempotente.
-- ============================================================================

create extension if not exists pgcrypto;  -- gen_random_uuid(), crypt()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin create type app_role         as enum ('admin','consultor','aluno'); exception when duplicate_object then null; end $$;
do $$ begin create type status_pagamento as enum ('em_dia','pendente','atrasado','novo'); exception when duplicate_object then null; end $$;
do $$ begin create type conselho_tipo    as enum ('CREF','CRN','CRM'); exception when duplicate_object then null; end $$;
do $$ begin create type video_origem     as enum ('biblioteca','proprio','vazio'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- updated_at trigger genérico
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ============================================================================
-- consultorias (TENANT — = Prestador/consultor)
-- ============================================================================
create table if not exists public.consultorias (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  conselho_tipo   conselho_tipo,
  conselho_numero text,
  documento       text,                         -- CPF/CNPJ
  -- financeiro (escrita restrita — ver grants no fim)
  saldo           numeric(12,2) not null default 0,
  a_liberar       numeric(12,2) not null default 0,
  saque_pix       text,
  saque_banco     text,
  saque_agencia   text,
  saque_conta     text,
  -- perfil
  nome_negocio    text,
  bio             text,
  especialidade   text,
  -- notificações
  notif_novo_pagamento     boolean not null default true,
  notif_checkin_recebido   boolean not null default true,
  notif_pagamento_atrasado boolean not null default true,
  notif_novo_aluno         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
drop trigger if exists trg_consultorias_updated on public.consultorias;
create trigger trg_consultorias_updated before update on public.consultorias
  for each row execute function public.set_updated_at();

-- ============================================================================
-- profiles (1:1 com auth.users — fonte de verdade de autorização)
-- ============================================================================
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  role           app_role not null default 'consultor',
  consultoria_id uuid references public.consultorias(id) on delete cascade,
  aluno_id       uuid,                          -- FK p/ alunos (adicionada abaixo)
  nome           text,
  email          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- invariantes por papel
  constraint profiles_role_shape check (
    (role = 'admin'     and consultoria_id is null     and aluno_id is null) or
    (role = 'consultor' and consultoria_id is not null and aluno_id is null) or
    (role = 'aluno'     and consultoria_id is not null and aluno_id is not null)
  )
);
create index if not exists idx_profiles_consultoria on public.profiles(consultoria_id);
create index if not exists idx_profiles_aluno       on public.profiles(aluno_id);
create index if not exists idx_profiles_role        on public.profiles(role);
-- 1 conta por aluno (fecha corrida de signup — ACHADO 5)
create unique index if not exists profiles_aluno_uq on public.profiles(aluno_id) where aluno_id is not null;
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
-- alunos (assinatura de um plano dentro de uma consultoria)
-- ============================================================================
create table if not exists public.alunos (
  id                  uuid primary key default gen_random_uuid(),
  consultoria_id      uuid not null references public.consultorias(id) on delete cascade,
  plano_id            uuid,                      -- FK -> planos (fase posterior)
  nome                text not null,
  cpf                 text,
  email               text,
  objetivo            text,
  status_pagamento    status_pagamento not null default 'novo',
  proximo_vencimento  date,
  inicio              date,
  peso_inicial        numeric(6,2),
  peso_atual          numeric(6,2),
  aderencia_treino    smallint check (aderencia_treino between 0 and 100),
  -- flags derivadas (materializadas)
  checkin_pendente      boolean not null default false,
  aguardando_protocolo  boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_alunos_consultoria on public.alunos(consultoria_id);
create index if not exists idx_alunos_status      on public.alunos(consultoria_id, status_pagamento);
create unique index if not exists alunos_cpf_uq    on public.alunos(consultoria_id, cpf) where cpf is not null;
drop trigger if exists trg_alunos_updated on public.alunos;
create trigger trg_alunos_updated before update on public.alunos
  for each row execute function public.set_updated_at();

-- FK tardia: profiles.aluno_id -> alunos.id
do $$ begin
  alter table public.profiles
    add constraint profiles_aluno_fk foreign key (aluno_id)
    references public.alunos(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ============================================================================
-- treinos / exercicios
-- consultoria_id é DESNORMALIZADO (mantido por trigger) p/ RLS sem JOIN.
-- ============================================================================
create table if not exists public.treinos (
  id              uuid primary key default gen_random_uuid(),
  consultoria_id  uuid not null references public.consultorias(id) on delete cascade,
  aluno_id        uuid not null references public.alunos(id) on delete cascade,
  nome            text not null,
  rascunho        boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()   -- = "atualizadoEm"
);
create index if not exists idx_treinos_consultoria on public.treinos(consultoria_id);
create index if not exists idx_treinos_aluno       on public.treinos(aluno_id);
drop trigger if exists trg_treinos_updated on public.treinos;
create trigger trg_treinos_updated before update on public.treinos
  for each row execute function public.set_updated_at();

create table if not exists public.exercicios (
  id              uuid primary key default gen_random_uuid(),
  treino_id       uuid not null references public.treinos(id) on delete cascade,
  consultoria_id  uuid not null references public.consultorias(id) on delete cascade,
  ordem           integer not null default 0,
  nome            text not null,
  grupo           text,
  series          integer,
  reps            text,                          -- "8-12"
  descanso_seg    integer,
  video_origem    video_origem not null default 'vazio',
  video_url       text,
  observacoes     text,
  series_detalhe  jsonb not null default '[]'::jsonb,  -- [{rotulo,reps,descansoSeg,obs}]
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (treino_id, ordem)
);
create index if not exists idx_exercicios_treino      on public.exercicios(treino_id);
create index if not exists idx_exercicios_consultoria on public.exercicios(consultoria_id);
drop trigger if exists trg_exercicios_updated on public.exercicios;
create trigger trg_exercicios_updated before update on public.exercicios
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Helpers SECURITY DEFINER — quebram a recursão de RLS em profiles.
-- (renomeado: NÃO usar current_role — colide com função reservada do Postgres)
-- ============================================================================
create or replace function public.auth_app_role()
returns app_role language sql stable security definer set search_path = public, pg_temp
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.current_consultoria_id()
returns uuid language sql stable security definer set search_path = public, pg_temp
as $$ select consultoria_id from public.profiles where id = auth.uid() $$;

create or replace function public.current_aluno_id()
returns uuid language sql stable security definer set search_path = public, pg_temp
as $$ select aluno_id from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

-- só authenticated executa os helpers
revoke execute on function public.auth_app_role(), public.current_consultoria_id(),
  public.current_aluno_id(), public.is_admin() from anon, public;
grant execute on function public.auth_app_role(), public.current_consultoria_id(),
  public.current_aluno_id(), public.is_admin() to authenticated;

-- ============================================================================
-- Triggers de consistência de consultoria_id (desnormalização à prova de fraude)
-- before insert OR UPDATE (qualquer coluna) recalcula a partir do pai.
-- ============================================================================
create or replace function public.set_treino_consultoria()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  select consultoria_id into new.consultoria_id from public.alunos where id = new.aluno_id;
  if new.consultoria_id is null then raise exception 'aluno % inexistente', new.aluno_id; end if;
  return new;
end $$;
drop trigger if exists trg_treino_consultoria on public.treinos;
create trigger trg_treino_consultoria before insert or update on public.treinos
  for each row execute function public.set_treino_consultoria();

create or replace function public.set_exercicio_consultoria()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  select consultoria_id into new.consultoria_id from public.treinos where id = new.treino_id;
  if new.consultoria_id is null then raise exception 'treino % inexistente', new.treino_id; end if;
  return new;
end $$;
drop trigger if exists trg_exercicio_consultoria on public.exercicios;
create trigger trg_exercicio_consultoria before insert or update on public.exercicios
  for each row execute function public.set_exercicio_consultoria();

-- ============================================================================
-- Signup endurecido (ACHADO 5): popula profiles via trigger on auth.users.
--  - admin NUNCA via signup
--  - consultor cria a PRÓPRIA consultoria (não pode escolher uma existente)
--  - aluno só se aluno_id pertence à consultoria informada E ainda não tem dono
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role app_role := coalesce((new.raw_user_meta_data->>'role')::app_role, 'consultor');
  v_cid  uuid := nullif(new.raw_user_meta_data->>'consultoria_id','')::uuid;
  v_aid  uuid := nullif(new.raw_user_meta_data->>'aluno_id','')::uuid;
  v_nome text := new.raw_user_meta_data->>'nome';
  v_aluno_cid uuid;
begin
  if v_role = 'admin' then
    raise exception 'admin nao pode ser criado via signup';
  elsif v_role = 'consultor' then
    if v_cid is not null then raise exception 'consultor nao pode escolher consultoria existente'; end if;
    insert into public.consultorias (nome, nome_negocio)
      values (coalesce(v_nome, new.email), coalesce(v_nome, new.email))
      returning id into v_cid;
    v_aid := null;
  elsif v_role = 'aluno' then
    if v_cid is null or v_aid is null then
      raise exception 'aluno signup requires consultoria_id and aluno_id';
    end if;
    select consultoria_id into v_aluno_cid from public.alunos where id = v_aid;
    if v_aluno_cid is null or v_aluno_cid <> v_cid then
      raise exception 'aluno_id nao pertence a consultoria informada';
    end if;
    if exists (select 1 from public.profiles where aluno_id = v_aid) then
      raise exception 'aluno ja possui conta';
    end if;
  end if;

  insert into public.profiles (id, role, consultoria_id, aluno_id, nome, email)
    values (new.id, v_role, v_cid, v_aid, v_nome, new.email);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.consultorias enable row level security;
alter table public.profiles     enable row level security;
alter table public.alunos       enable row level security;
alter table public.treinos      enable row level security;
alter table public.exercicios   enable row level security;

-- ---------- consultorias ----------
drop policy if exists consultorias_select on public.consultorias;
create policy consultorias_select on public.consultorias for select
  using (public.is_admin() or id = public.current_consultoria_id());
drop policy if exists consultorias_insert on public.consultorias;
create policy consultorias_insert on public.consultorias for insert
  with check (public.is_admin());   -- criação real vem do trigger de signup
drop policy if exists consultorias_update on public.consultorias;
create policy consultorias_update on public.consultorias for update
  using  (public.is_admin() or id = public.current_consultoria_id())
  with check (public.is_admin() or id = public.current_consultoria_id());
drop policy if exists consultorias_delete on public.consultorias;
create policy consultorias_delete on public.consultorias for delete using (public.is_admin());

-- ---------- profiles ----------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  public.is_admin()
  or id = auth.uid()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert with check (public.is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (public.is_admin() or id = auth.uid())
  with check (
    public.is_admin()
    or (id = auth.uid()
        and role = public.auth_app_role()
        and consultoria_id is not distinct from public.current_consultoria_id()
        and aluno_id      is not distinct from public.current_aluno_id())
  );
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete using (public.is_admin());

-- ---------- alunos ----------
drop policy if exists alunos_select on public.alunos;
create policy alunos_select on public.alunos for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
  or (public.auth_app_role() = 'aluno'     and id = public.current_aluno_id())
);
drop policy if exists alunos_insert on public.alunos;
create policy alunos_insert on public.alunos for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
);
drop policy if exists alunos_update on public.alunos;
create policy alunos_update on public.alunos for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));
drop policy if exists alunos_delete on public.alunos;
create policy alunos_delete on public.alunos for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));

-- ---------- treinos (aluno NÃO vê rascunho — ACHADO 2) ----------
drop policy if exists treinos_select on public.treinos;
create policy treinos_select on public.treinos for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
  or (public.auth_app_role() = 'aluno'     and aluno_id = public.current_aluno_id() and not rascunho)
);
drop policy if exists treinos_insert on public.treinos;
create policy treinos_insert on public.treinos for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
);
drop policy if exists treinos_update on public.treinos;
create policy treinos_update on public.treinos for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));
drop policy if exists treinos_delete on public.treinos;
create policy treinos_delete on public.treinos for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));

-- ---------- exercicios (aluno NÃO vê rascunho — ACHADO 2) ----------
drop policy if exists exercicios_select on public.exercicios;
create policy exercicios_select on public.exercicios for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
  or (public.auth_app_role() = 'aluno' and consultoria_id = public.current_consultoria_id()
      and exists (
        select 1 from public.treinos t
        where t.id = exercicios.treino_id and t.aluno_id = public.current_aluno_id() and not t.rascunho
      ))
);
drop policy if exists exercicios_insert on public.exercicios;
create policy exercicios_insert on public.exercicios for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
);
drop policy if exists exercicios_update on public.exercicios;
create policy exercicios_update on public.exercicios for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));
drop policy if exists exercicios_delete on public.exercicios;
create policy exercicios_delete on public.exercicios for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));

-- ============================================================================
-- GRANTS (PostgREST usa role "authenticated"; RLS filtra)
--  - consultorias: UPDATE só nas colunas não-financeiras (ACHADO 11)
-- ============================================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.alunos, public.treinos, public.exercicios to authenticated;
grant select, insert, delete on public.consultorias to authenticated;
revoke update on public.consultorias from authenticated;
grant update (nome, conselho_tipo, conselho_numero, documento, nome_negocio, bio, especialidade,
  saque_pix, saque_banco, saque_agencia, saque_conta,
  notif_novo_pagamento, notif_checkin_recebido, notif_pagamento_atrasado, notif_novo_aluno)
  on public.consultorias to authenticated;   -- saldo/a_liberar ficam de fora

-- ============================================================================
-- FASE POSTERIOR (mesmo padrão de tenant: consultoria_id + RLS análoga):
--   planos, dietas/refeicoes/alimentos, protocolos/blocos/itens,
--   checkins (+ fotos em Storage), transacoes, pagamentos_assinatura,
--   bibliotecas (exercicio/alimento/suplemento), plataforma (planos/assinaturas).
-- ============================================================================

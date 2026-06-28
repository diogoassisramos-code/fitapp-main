-- ============================================================================
-- CoachFit — Dieta + Protocolo (mesmo padrão multi-tenant de treinos).
-- consultoria_id DENORMALIZADO em TODAS as tabelas, preenchido por trigger a
-- partir do pai. RLS: consultor = tenant; aluno SELECT do que é dele e NOT
-- rascunho (raiz). Filhos herdam via EXISTS no pai. Idempotente.
-- Rode no SQL Editor (depois do schema.sql principal). Inclui seed da Ana no fim.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- DIETAS
-- ---------------------------------------------------------------------------
create table if not exists public.dietas (
  id              uuid primary key default gen_random_uuid(),
  consultoria_id  uuid not null references public.consultorias(id) on delete cascade,
  aluno_id        uuid not null references public.alunos(id) on delete cascade,
  meta_kcal       integer not null default 0,
  rascunho        boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_dietas_consultoria on public.dietas(consultoria_id);
create index if not exists idx_dietas_aluno       on public.dietas(aluno_id);
drop trigger if exists trg_dietas_updated on public.dietas;
create trigger trg_dietas_updated before update on public.dietas
  for each row execute function public.set_updated_at();

create table if not exists public.refeicoes (
  id              uuid primary key default gen_random_uuid(),
  dieta_id        uuid not null references public.dietas(id) on delete cascade,
  consultoria_id  uuid not null references public.consultorias(id) on delete cascade,
  ordem           integer not null default 0,
  nome            text not null,
  horario         text,
  observacoes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (dieta_id, ordem)
);
create index if not exists idx_refeicoes_dieta       on public.refeicoes(dieta_id);
create index if not exists idx_refeicoes_consultoria on public.refeicoes(consultoria_id);
drop trigger if exists trg_refeicoes_updated on public.refeicoes;
create trigger trg_refeicoes_updated before update on public.refeicoes
  for each row execute function public.set_updated_at();

create table if not exists public.alimentos (
  id              uuid primary key default gen_random_uuid(),
  refeicao_id     uuid not null references public.refeicoes(id) on delete cascade,
  consultoria_id  uuid not null references public.consultorias(id) on delete cascade,
  ordem           integer not null default 0,
  nome            text not null,
  qtd_valor       numeric(10,2),
  qtd_unidade     text,
  kcal            numeric(10,2),
  p               numeric(10,2),
  c               numeric(10,2),
  g               numeric(10,2),
  substituicoes   text[] not null default '{}',
  custom          boolean not null default false,
  sem_macros      boolean not null default false,
  observacoes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (refeicao_id, ordem)
);
create index if not exists idx_alimentos_refeicao    on public.alimentos(refeicao_id);
create index if not exists idx_alimentos_consultoria on public.alimentos(consultoria_id);
drop trigger if exists trg_alimentos_updated on public.alimentos;
create trigger trg_alimentos_updated before update on public.alimentos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- PROTOCOLOS
-- ---------------------------------------------------------------------------
create table if not exists public.protocolos (
  id              uuid primary key default gen_random_uuid(),
  consultoria_id  uuid not null references public.consultorias(id) on delete cascade,
  aluno_id        uuid not null references public.alunos(id) on delete cascade,
  rascunho        boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_protocolos_consultoria on public.protocolos(consultoria_id);
create index if not exists idx_protocolos_aluno       on public.protocolos(aluno_id);
drop trigger if exists trg_protocolos_updated on public.protocolos;
create trigger trg_protocolos_updated before update on public.protocolos
  for each row execute function public.set_updated_at();

create table if not exists public.protocolo_blocos (
  id              uuid primary key default gen_random_uuid(),
  protocolo_id    uuid not null references public.protocolos(id) on delete cascade,
  consultoria_id  uuid not null references public.consultorias(id) on delete cascade,
  ordem           integer not null default 0,
  nome            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (protocolo_id, ordem)
);
create index if not exists idx_blocos_protocolo   on public.protocolo_blocos(protocolo_id);
create index if not exists idx_blocos_consultoria on public.protocolo_blocos(consultoria_id);
drop trigger if exists trg_blocos_updated on public.protocolo_blocos;
create trigger trg_blocos_updated before update on public.protocolo_blocos
  for each row execute function public.set_updated_at();

create table if not exists public.protocolo_itens (
  id              uuid primary key default gen_random_uuid(),
  bloco_id        uuid not null references public.protocolo_blocos(id) on delete cascade,
  consultoria_id  uuid not null references public.consultorias(id) on delete cascade,
  ordem           integer not null default 0,
  nome            text not null,
  dose            text,
  horario         text,
  observacoes     text,
  como_usar       text,
  com_o_que       text,
  beneficio       text,
  duracao         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (bloco_id, ordem)
);
create index if not exists idx_itens_bloco       on public.protocolo_itens(bloco_id);
create index if not exists idx_itens_consultoria on public.protocolo_itens(consultoria_id);
drop trigger if exists trg_itens_updated on public.protocolo_itens;
create trigger trg_itens_updated before update on public.protocolo_itens
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Triggers de consistência de consultoria_id (copiam do pai; client nunca envia)
-- ============================================================================
create or replace function public.set_dieta_consultoria()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  select consultoria_id into new.consultoria_id from public.alunos where id = new.aluno_id;
  if new.consultoria_id is null then raise exception 'aluno % inexistente', new.aluno_id; end if;
  return new;
end $$;
drop trigger if exists trg_dieta_consultoria on public.dietas;
create trigger trg_dieta_consultoria before insert or update on public.dietas
  for each row execute function public.set_dieta_consultoria();

create or replace function public.set_refeicao_consultoria()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  select consultoria_id into new.consultoria_id from public.dietas where id = new.dieta_id;
  if new.consultoria_id is null then raise exception 'dieta % inexistente', new.dieta_id; end if;
  return new;
end $$;
drop trigger if exists trg_refeicao_consultoria on public.refeicoes;
create trigger trg_refeicao_consultoria before insert or update on public.refeicoes
  for each row execute function public.set_refeicao_consultoria();

create or replace function public.set_alimento_consultoria()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  select consultoria_id into new.consultoria_id from public.refeicoes where id = new.refeicao_id;
  if new.consultoria_id is null then raise exception 'refeicao % inexistente', new.refeicao_id; end if;
  return new;
end $$;
drop trigger if exists trg_alimento_consultoria on public.alimentos;
create trigger trg_alimento_consultoria before insert or update on public.alimentos
  for each row execute function public.set_alimento_consultoria();

create or replace function public.set_protocolo_consultoria()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  select consultoria_id into new.consultoria_id from public.alunos where id = new.aluno_id;
  if new.consultoria_id is null then raise exception 'aluno % inexistente', new.aluno_id; end if;
  return new;
end $$;
drop trigger if exists trg_protocolo_consultoria on public.protocolos;
create trigger trg_protocolo_consultoria before insert or update on public.protocolos
  for each row execute function public.set_protocolo_consultoria();

create or replace function public.set_bloco_consultoria()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  select consultoria_id into new.consultoria_id from public.protocolos where id = new.protocolo_id;
  if new.consultoria_id is null then raise exception 'protocolo % inexistente', new.protocolo_id; end if;
  return new;
end $$;
drop trigger if exists trg_bloco_consultoria on public.protocolo_blocos;
create trigger trg_bloco_consultoria before insert or update on public.protocolo_blocos
  for each row execute function public.set_bloco_consultoria();

create or replace function public.set_item_consultoria()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  select consultoria_id into new.consultoria_id from public.protocolo_blocos where id = new.bloco_id;
  if new.consultoria_id is null then raise exception 'bloco % inexistente', new.bloco_id; end if;
  return new;
end $$;
drop trigger if exists trg_item_consultoria on public.protocolo_itens;
create trigger trg_item_consultoria before insert or update on public.protocolo_itens
  for each row execute function public.set_item_consultoria();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.dietas           enable row level security;
alter table public.refeicoes        enable row level security;
alter table public.alimentos        enable row level security;
alter table public.protocolos       enable row level security;
alter table public.protocolo_blocos enable row level security;
alter table public.protocolo_itens  enable row level security;

-- ---------- dietas (raiz: aluno NÃO vê rascunho) ----------
drop policy if exists dietas_select on public.dietas;
create policy dietas_select on public.dietas for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
  or (public.auth_app_role() = 'aluno'     and aluno_id = public.current_aluno_id() and not rascunho)
);
drop policy if exists dietas_insert on public.dietas;
create policy dietas_insert on public.dietas for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
);
drop policy if exists dietas_update on public.dietas;
create policy dietas_update on public.dietas for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));
drop policy if exists dietas_delete on public.dietas;
create policy dietas_delete on public.dietas for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));

-- ---------- refeicoes (herda: aluno vê só de dieta dele não-rascunho) ----------
drop policy if exists refeicoes_select on public.refeicoes;
create policy refeicoes_select on public.refeicoes for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
  or (public.auth_app_role() = 'aluno' and consultoria_id = public.current_consultoria_id()
      and exists (
        select 1 from public.dietas d
        where d.id = refeicoes.dieta_id and d.aluno_id = public.current_aluno_id() and not d.rascunho
      ))
);
drop policy if exists refeicoes_insert on public.refeicoes;
create policy refeicoes_insert on public.refeicoes for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
);
drop policy if exists refeicoes_update on public.refeicoes;
create policy refeicoes_update on public.refeicoes for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));
drop policy if exists refeicoes_delete on public.refeicoes;
create policy refeicoes_delete on public.refeicoes for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));

-- ---------- alimentos (herda via refeicoes -> dietas) ----------
drop policy if exists alimentos_select on public.alimentos;
create policy alimentos_select on public.alimentos for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
  or (public.auth_app_role() = 'aluno' and consultoria_id = public.current_consultoria_id()
      and exists (
        select 1 from public.refeicoes r
        join public.dietas d on d.id = r.dieta_id
        where r.id = alimentos.refeicao_id and d.aluno_id = public.current_aluno_id() and not d.rascunho
      ))
);
drop policy if exists alimentos_insert on public.alimentos;
create policy alimentos_insert on public.alimentos for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
);
drop policy if exists alimentos_update on public.alimentos;
create policy alimentos_update on public.alimentos for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));
drop policy if exists alimentos_delete on public.alimentos;
create policy alimentos_delete on public.alimentos for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));

-- ---------- protocolos (raiz: aluno NÃO vê rascunho) ----------
drop policy if exists protocolos_select on public.protocolos;
create policy protocolos_select on public.protocolos for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
  or (public.auth_app_role() = 'aluno'     and aluno_id = public.current_aluno_id() and not rascunho)
);
drop policy if exists protocolos_insert on public.protocolos;
create policy protocolos_insert on public.protocolos for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
);
drop policy if exists protocolos_update on public.protocolos;
create policy protocolos_update on public.protocolos for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));
drop policy if exists protocolos_delete on public.protocolos;
create policy protocolos_delete on public.protocolos for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));

-- ---------- protocolo_blocos (herda) ----------
drop policy if exists blocos_select on public.protocolo_blocos;
create policy blocos_select on public.protocolo_blocos for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
  or (public.auth_app_role() = 'aluno' and consultoria_id = public.current_consultoria_id()
      and exists (
        select 1 from public.protocolos p
        where p.id = protocolo_blocos.protocolo_id and p.aluno_id = public.current_aluno_id() and not p.rascunho
      ))
);
drop policy if exists blocos_insert on public.protocolo_blocos;
create policy blocos_insert on public.protocolo_blocos for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
);
drop policy if exists blocos_update on public.protocolo_blocos;
create policy blocos_update on public.protocolo_blocos for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));
drop policy if exists blocos_delete on public.protocolo_blocos;
create policy blocos_delete on public.protocolo_blocos for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));

-- ---------- protocolo_itens (herda via blocos -> protocolos) ----------
drop policy if exists itens_select on public.protocolo_itens;
create policy itens_select on public.protocolo_itens for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
  or (public.auth_app_role() = 'aluno' and consultoria_id = public.current_consultoria_id()
      and exists (
        select 1 from public.protocolo_blocos b
        join public.protocolos p on p.id = b.protocolo_id
        where b.id = protocolo_itens.bloco_id and p.aluno_id = public.current_aluno_id() and not p.rascunho
      ))
);
drop policy if exists itens_insert on public.protocolo_itens;
create policy itens_insert on public.protocolo_itens for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
);
drop policy if exists itens_update on public.protocolo_itens;
create policy itens_update on public.protocolo_itens for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));
drop policy if exists itens_delete on public.protocolo_itens;
create policy itens_delete on public.protocolo_itens for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));

-- ============================================================================
-- GRANTS
-- ============================================================================
grant select, insert, update, delete on
  public.dietas, public.refeicoes, public.alimentos,
  public.protocolos, public.protocolo_blocos, public.protocolo_itens
  to authenticated;

-- ============================================================================
-- Recarrega o cache de schema do PostgREST (pra a API enxergar as tabelas já).
-- ============================================================================
notify pgrst, 'reload schema';

-- O SEED (dieta/protocolo da Ana) foi movido para seed_dieta_protocolo.sql,
-- pra a criação das tabelas NUNCA ser bloqueada por um erro de seed.

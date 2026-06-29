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
-- Mantém alunos.checkin_pendente = (existe check-in pendente do aluno).
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
     )
   where a.id = v_aluno;
  return null;
end $$;
drop trigger if exists trg_checkin_sync_pendente on public.checkins;
create trigger trg_checkin_sync_pendente
  after insert or update or delete on public.checkins
  for each row execute function public.sync_aluno_checkin_pendente();

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

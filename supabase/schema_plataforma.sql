-- ============================================================================
-- Revo — Taxa da plataforma (Fluxo 2 / split), configurável pelo admin.
--
-- Global (padrão) em `plataforma_config` (linha única) + override por
-- consultoria em `consultorias.taxa_plataforma_pct` (null = usa a global).
-- O split das cobranças do aluno lê a taxa EFETIVA (override → senão global).
--
-- Idempotente. Rode no SQL Editor DEPOIS do schema.sql.
-- ============================================================================

-- Config global (linha única id = 1).
create table if not exists public.plataforma_config (
  id                   int primary key default 1,
  taxa_plataforma_pct  numeric(5,2) not null default 10,
  updated_at           timestamptz not null default now(),
  constraint plataforma_config_singleton check (id = 1)
);
insert into public.plataforma_config (id, taxa_plataforma_pct)
  values (1, 10) on conflict (id) do nothing;

-- Override por consultoria (null = usa a taxa global).
alter table public.consultorias
  add column if not exists taxa_plataforma_pct numeric(5,2);

-- RLS: qualquer autenticado LÊ a taxa (para exibir). A escrita é feita pela
-- rota admin via service_role (que ignora RLS) — sem grant de update aqui.
alter table public.plataforma_config enable row level security;
drop policy if exists plataforma_config_select on public.plataforma_config;
create policy plataforma_config_select on public.plataforma_config for select using (true);
revoke all on public.plataforma_config from authenticated, anon;
grant select on public.plataforma_config to authenticated;

notify pgrst, 'reload schema';

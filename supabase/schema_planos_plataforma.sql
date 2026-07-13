-- ============================================================================
-- Revo — Planos SaaS da PLATAFORMA (o que a plataforma vende aos consultores).
--
-- Substitui o mock `planosPlataforma`. O `consultorias.plano` (free|pro|avancado)
-- referencia o `slug` desta tabela. O admin cria/edita/precifica aqui; o cadastro
-- do consultor e o /admin/planos leem daqui.
--
-- Idempotente. Rode no SQL Editor DEPOIS do schema.sql e schema_consultor_signup.sql
-- (usa is_admin()). Semeia os 3 tiers atuais (free R$0 / pro R$60 / avancado R$120).
-- ============================================================================

create table if not exists public.planos_plataforma (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,             -- free | pro | avancado (= consultorias.plano)
  nome          text not null,
  descricao     text,
  preco         numeric(10,2) not null default 0, -- mensal, o que o consultor paga
  limite_alunos int not null default 0,           -- 0 = ilimitado
  recursos      jsonb not null default '[]'::jsonb,
  destaque      boolean not null default false,
  ordem         int not null default 0,
  status        text not null default 'ativo' check (status in ('ativo','arquivado')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_planos_plataforma_updated on public.planos_plataforma;
create trigger trg_planos_plataforma_updated before update on public.planos_plataforma
  for each row execute function public.set_updated_at();

-- Seed dos tiers atuais (só insere se o slug ainda não existe — não sobrescreve
-- preços que o admin já ajustou).
insert into public.planos_plataforma (slug, nome, descricao, preco, limite_alunos, recursos, destaque, ordem)
values
  ('free', 'Gratuito', 'Para começar a consultoria.', 0, 5,
    '["Até 5 alunos","Treino e dieta","Check-in semanal"]'::jsonb, false, 0),
  ('pro', 'Revo Pro', 'Para consultorias em crescimento.', 60, 150,
    '["Até 150 alunos","Protocolos extras","Link de pagamento","Vitrine de planos","Suporte prioritário"]'::jsonb, true, 1),
  ('avancado', 'Revo Pro Max', 'Operações grandes, sem limites.', 120, 0,
    '["Alunos ilimitados","Checkout personalizado","Relatórios avançados","Gerente de conta"]'::jsonb, false, 2)
on conflict (slug) do nothing;

-- RLS: qualquer autenticado LÊ (cadastro/consultor precisam ver os planos); a
-- escrita é só do admin (is_admin()).
alter table public.planos_plataforma enable row level security;

drop policy if exists planos_plataforma_select on public.planos_plataforma;
create policy planos_plataforma_select on public.planos_plataforma for select using (true);

drop policy if exists planos_plataforma_insert on public.planos_plataforma;
create policy planos_plataforma_insert on public.planos_plataforma for insert with check (public.is_admin());

drop policy if exists planos_plataforma_update on public.planos_plataforma;
create policy planos_plataforma_update on public.planos_plataforma for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists planos_plataforma_delete on public.planos_plataforma;
create policy planos_plataforma_delete on public.planos_plataforma for delete using (public.is_admin());

revoke all on public.planos_plataforma from anon, authenticated;
grant select on public.planos_plataforma to anon, authenticated;
grant insert, update, delete on public.planos_plataforma to authenticated; -- gated pela RLS (is_admin)

notify pgrst, 'reload schema';

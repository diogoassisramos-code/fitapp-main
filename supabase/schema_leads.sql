-- ============================================================================
-- Revo — Leads de marketing: e-mails capturados no cadastro ANTES de virarem
-- conta (não têm senha/auth). Servem só pra marketing. Como não são contas
-- (auth.users), o mesmo e-mail continua livre pra criar conta enquanto for só
-- lead — o bloqueio de "e-mail já cadastrado" só vale quando existe conta real.
--
-- Escrita só via service_role (rota /api/lead). Admin lê via is_admin().
-- Idempotente. Rode no SQL Editor depois do schema.sql.
-- ============================================================================
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  nome        text,
  cpf         text,
  telefone    text,
  plano       text,
  origem      text default 'cadastro',
  -- Consentimento (base legal LGPD): aceite dos termos + quando aceitou.
  aceite_termos boolean not null default false,
  aceite_em     timestamptz,
  -- true quando o lead concluiu o signup (virou conta de verdade).
  virou_conta boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Idempotente: se a tabela já existia sem as colunas de aceite, adiciona.
alter table public.leads
  add column if not exists aceite_termos boolean not null default false,
  add column if not exists aceite_em     timestamptz;

alter table public.leads enable row level security;
revoke all on public.leads from anon, authenticated;
-- Só o admin lê (painel de marketing). Escrita é exclusiva do service_role.
drop policy if exists leads_admin_select on public.leads;
create policy leads_admin_select on public.leads for select using (public.is_admin());
grant select on public.leads to authenticated;

notify pgrst, 'reload schema';

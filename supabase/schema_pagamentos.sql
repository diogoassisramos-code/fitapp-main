-- ============================================================================
-- Revo — Pagamentos (Asaas): ids do gateway + tabelas de reconciliação.
--
-- Fonte de verdade financeira alimentada pelos WEBHOOKS do Asaas (via
-- service_role no handler /api/webhooks/asaas). O front NUNCA escreve aqui.
--
-- Idempotente. Rode no SQL Editor DEPOIS do schema.sql (usa is_admin(),
-- current_consultoria_id(), current_aluno_id(), auth_app_role()).
-- ============================================================================

-- 1) ids do Asaas nas entidades existentes -----------------------------------
-- Consultor como PAGADOR da assinatura SaaS (fluxo 1) e como RECEBEDOR/subconta
-- (fluxo 2). asaas_subaccount_key é a apiKey da subconta (mostrada 1x pelo
-- Asaas) — em produção, gravar CIFRADA (pgsodium/KMS), nunca em texto puro.
alter table public.consultorias
  add column if not exists asaas_customer_id      text,
  add column if not exists asaas_subscription_id  text,
  add column if not exists asaas_account_id       text,
  add column if not exists asaas_wallet_id         text,
  add column if not exists asaas_subaccount_key    text,
  add column if not exists asaas_onboarding_status text not null default 'nao_iniciado';
alter table public.consultorias drop constraint if exists consultorias_asaas_onboarding_chk;
alter table public.consultorias add  constraint consultorias_asaas_onboarding_chk
  check (asaas_onboarding_status in ('nao_iniciado','em_analise','aprovado','reprovado'));

-- Aluno como PAGADOR da mensalidade da consultoria (fluxo 2).
alter table public.alunos
  add column if not exists asaas_customer_id     text,
  add column if not exists asaas_subscription_id text;

-- 2) Ledger de idempotência dos webhooks -------------------------------------
-- O Asaas entrega "at least once" (o mesmo evento pode repetir). Cada evento
-- tem um id; processa uma vez só. processado_em nulo = recebido mas ainda não
-- processado (permite reprocessar em caso de falha antes de concluir).
create table if not exists public.webhook_events (
  id             uuid primary key default gen_random_uuid(),
  asaas_event_id text not null unique,
  event_type     text,
  payment_id     text,
  payload        jsonb,
  recebido_em    timestamptz not null default now(),
  processado_em  timestamptz
);

-- 3) Pagamentos (GMV/MRR reais) ----------------------------------------------
-- Uma linha por cobrança do Asaas (SaaS do consultor OU mensalidade do aluno),
-- mantida em dia pelo webhook. Substitui os mocks de transacoes/assinaturas.
create table if not exists public.pagamentos (
  id                    uuid primary key default gen_random_uuid(),
  asaas_payment_id      text unique,
  asaas_subscription_id text,
  consultoria_id        uuid references public.consultorias(id) on delete set null,
  aluno_id              uuid references public.alunos(id) on delete set null,
  fluxo                 text not null check (fluxo in ('saas','mensalidade')),
  billing_type          text,
  valor                 numeric(12,2),
  net_value             numeric(12,2),
  split_taxa            numeric(12,2),   -- taxa retida pela plataforma (fluxo 2)
  status                text,
  external_reference    text,
  criado_em             timestamptz not null default now(),
  confirmado_em         timestamptz,     -- PAYMENT_CONFIRMED
  recebido_em           timestamptz,     -- PAYMENT_RECEIVED (dinheiro disponível)
  updated_at            timestamptz not null default now()
);
create index if not exists idx_pagamentos_consultoria on public.pagamentos(consultoria_id);
create index if not exists idx_pagamentos_aluno        on public.pagamentos(aluno_id);
create index if not exists idx_pagamentos_assinatura   on public.pagamentos(asaas_subscription_id);
drop trigger if exists trg_pagamentos_updated on public.pagamentos;
create trigger trg_pagamentos_updated before update on public.pagamentos
  for each row execute function public.set_updated_at();

-- 4) RLS ---------------------------------------------------------------------
-- webhook_events: SÓ service_role (o handler do webhook). Nenhum acesso a
-- authenticated/anon — service_role ignora RLS por padrão.
alter table public.webhook_events enable row level security;
revoke all on public.webhook_events from authenticated, anon;

-- pagamentos: leitura pelo dono (admin | consultor do tenant | aluno dono).
-- Escrita SÓ via service_role (webhook / rotas server) — sem policy de write
-- para authenticated, e grant só de SELECT.
alter table public.pagamentos enable row level security;
drop policy if exists pagamentos_select on public.pagamentos;
create policy pagamentos_select on public.pagamentos for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
  or (public.auth_app_role() = 'aluno'     and aluno_id = public.current_aluno_id())
);
revoke all on public.pagamentos from authenticated, anon;
grant select on public.pagamentos to authenticated;

-- Recarrega o cache de schema do PostgREST.
notify pgrst, 'reload schema';

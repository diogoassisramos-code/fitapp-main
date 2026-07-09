-- ============================================================================
-- Revo — Convites de compra (Fluxo 2 · onboarding self-service do aluno).
--
-- O coach define sua MENSALIDADE e gera um link (`/onboarding/[token]`). O aluno
-- abre o link (público), vê coach + preço e paga (com split). O token mapeia o
-- convite → consultoria + valor. A resolução pública é via RPC SECURITY DEFINER
-- que devolve só campos seguros (não expõe a tabela inteira ao anon).
--
-- Idempotente. Rode no SQL Editor DEPOIS do schema.sql / schema_pagamentos.sql /
-- schema_planos.sql (a FK plano_id abaixo exige a tabela public.planos).
-- ============================================================================

-- Preço da mensalidade que o coach cobra dos alunos (o "produto" dele).
alter table public.consultorias
  add column if not exists mensalidade_valor numeric(12,2);

-- Convites (um por aluno convidado).
create table if not exists public.convites (
  id              uuid primary key default gen_random_uuid(),
  token           text not null unique,
  consultoria_id  uuid not null references public.consultorias(id) on delete cascade,
  aluno_nome      text,
  valor           numeric(12,2) not null,   -- snapshot do preço no momento do convite
  descricao       text,
  status          text not null default 'pendente' check (status in ('pendente','usado','cancelado')),
  aluno_id        uuid references public.alunos(id) on delete set null,
  created_at      timestamptz not null default now(),
  used_at         timestamptz
);
-- ids do Asaas gerados no pagamento do onboarding (idempotente p/ tabela já criada).
-- plano_id: qual PLANO o convite vende (o aluno herda no pagamento → conta como
-- assinante daquele plano). Nulo = mensalidade avulsa (sem plano).
alter table public.convites
  add column if not exists asaas_customer_id     text,
  add column if not exists asaas_subscription_id text,
  add column if not exists plano_id              uuid;
-- FK só quando a tabela planos existe (ordena migrations sem quebrar reruns).
do $$ begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'planos')
     and not exists (select 1 from pg_constraint where conname = 'convites_plano_fk') then
    alter table public.convites
      add constraint convites_plano_fk foreign key (plano_id)
      references public.planos(id) on delete set null;
  end if;
end $$;
create index if not exists idx_convites_consultoria on public.convites(consultoria_id);

-- RLS: o consultor gerencia os convites do próprio tenant.
alter table public.convites enable row level security;
drop policy if exists convites_all on public.convites;
create policy convites_all on public.convites for all
  using (
    public.is_admin()
    or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
  )
  with check (
    public.is_admin()
    or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
  );
grant select, insert, update, delete on public.convites to authenticated;

-- Resolução PÚBLICA do token (anon): devolve só o necessário para a tela de
-- compra. SECURITY DEFINER pra ler apesar da RLS; expõe campos seguros.
-- drop necessário porque a assinatura do retorno mudou (novo aluno_nome).
drop function if exists public.resolver_convite(text);
create or replace function public.resolver_convite(p_token text)
returns table (consultoria_id uuid, coach_nome text, aluno_nome text, valor numeric, descricao text, status text)
language sql security definer set search_path = public, pg_temp as $$
  select c.consultoria_id,
         coalesce(k.nome_negocio, k.nome) as coach_nome,
         c.aluno_nome,
         c.valor, c.descricao, c.status
    from public.convites c
    join public.consultorias k on k.id = c.consultoria_id
   where c.token = p_token;
$$;
revoke all on function public.resolver_convite(text) from public;
grant execute on function public.resolver_convite(text) to anon, authenticated;

-- Checagem PÚBLICA de identidade no checkout: o e-mail já tem login (auth.users)?
-- o CPF já consta como aluno? Usado para, ANTES de cobrar, mandar quem já tem
-- conta fazer login em vez de criar uma nova (evita "pagou e não entra").
-- SECURITY DEFINER pra ler auth.users apesar da RLS; devolve só booleanos.
create or replace function public.identidade_existe(p_email text, p_cpf text)
returns table (email_existe boolean, cpf_existe boolean)
language sql security definer set search_path = public, auth, pg_temp as $$
  select
    exists (select 1 from auth.users u where lower(u.email) = lower(trim(coalesce(p_email, '')))
              and coalesce(trim(p_email), '') <> ''),
    exists (select 1 from public.alunos a
             where a.cpf = regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g')
               and regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g') <> '');
$$;
revoke all on function public.identidade_existe(text, text) from public;
grant execute on function public.identidade_existe(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

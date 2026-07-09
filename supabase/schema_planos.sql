-- ============================================================================
-- Revo — Planos (produtos do consultor): tabela real + RLS multi-tenant.
--
-- Substitui os planos mock de data.ts. Cada consultoria tem seus planos; o
-- aluno pode ler os planos ATIVOS do seu tenant (para o app/checkout). Escrita
-- só pelo consultor dono (ou admin). Campos aninhados (incluso, visibilidade,
-- formas de pagamento, checkin, upsell, checkout) ficam em jsonb para espelhar
-- o tipo Plano do front sem explodir em dezenas de colunas.
--
-- Idempotente. Rodar no SQL Editor DEPOIS do schema.sql (usa is_admin(),
-- auth_app_role(), current_consultoria_id(), current_aluno_id(), set_updated_at()).
-- ============================================================================

create table if not exists public.planos (
  id                   uuid primary key default gen_random_uuid(),
  consultoria_id       uuid not null references public.consultorias(id) on delete cascade,
  nome                 text not null,
  descricao            text,
  imagem_capa          text,
  tipo_cobranca        text not null default 'recorrente'
                         check (tipo_cobranca in ('recorrente','pacote','avulso')),
  modalidade           text check (modalidade in ('online','personal','consulta')),
  prazo_valor          integer,
  prazo_unidade        text check (prazo_unidade in ('horas','dias_uteis')),
  incluso              jsonb not null default
                         '{"treino":true,"dieta":true,"protocolos":false,"checkin":true,"chat":true}'::jsonb,
  preco                numeric(10,2) not null default 0,
  periodo_recorrencia  text check (periodo_recorrencia in ('semanal','mensal','trimestral','anual')),
  formas_pagamento     jsonb not null default '["cartao","pix"]'::jsonb,
  parcelamento_max     integer,
  solicitar_documentos boolean not null default false,
  agendar_checkins     boolean not null default false,
  checkin_config       jsonb,
  upsell               jsonb,
  visibilidade         jsonb not null default '{"venda":true,"vitrine":false,"renovacao":true}'::jsonb,
  checkout_custom      jsonb,
  slug                 text,
  status               text not null default 'ativo' check (status in ('ativo','pausado')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_planos_consultoria on public.planos(consultoria_id);

drop trigger if exists trg_planos_updated on public.planos;
create trigger trg_planos_updated before update on public.planos
  for each row execute function public.set_updated_at();

-- FK que faltava: alunos.plano_id -> planos.id (a coluna já existia sem FK).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'alunos_plano_fk') then
    alter table public.alunos
      add constraint alunos_plano_fk foreign key (plano_id)
      references public.planos(id) on delete set null;
  end if;
end $$;

-- RLS -------------------------------------------------------------------------
alter table public.planos enable row level security;

drop policy if exists planos_select on public.planos;
create policy planos_select on public.planos for select using (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
  or (public.auth_app_role() = 'aluno'     and consultoria_id = public.current_consultoria_id() and status = 'ativo')
);
drop policy if exists planos_insert on public.planos;
create policy planos_insert on public.planos for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id())
);
drop policy if exists planos_update on public.planos;
create policy planos_update on public.planos for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));
drop policy if exists planos_delete on public.planos;
create policy planos_delete on public.planos for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id()));

grant select, insert, update, delete on public.planos to authenticated;

notify pgrst, 'reload schema';

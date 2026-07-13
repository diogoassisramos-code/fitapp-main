-- ============================================================================
-- Revo — Check-ins automáticos (pg_cron).
--
-- Liga o "encanamento" que já existe (alunos.checkin_solicitado + aviso na home
-- do app do aluno) a um AGENDADOR real. De 15 em 15 min, varre os planos com
-- `checkin_config` e, para os alunos cujo dia/horário/frequência batem com o
-- "agora" (fuso America/Sao_Paulo), marca checkin_solicitado = true — o mesmo
-- efeito de o coach clicar "Solicitar check-in", só que automático.
--
-- "Agendar check-ins" está LIGADO quando planos.checkin_config não é nulo
-- (é assim que o editor de plano grava — ver src/lib/db.ts).
--
-- Idempotente. Rodar no SQL Editor DEPOIS de schema.sql + schema_planos.sql +
-- schema_checkin.sql. Requer a extensão pg_cron (Supabase: Database → Extensions
-- → pg_cron; ou o CREATE EXTENSION abaixo, que funciona no SQL Editor).
-- ============================================================================

-- 1) Marca do último disparo AUTOMÁTICO. Gate de cadência independente de o aluno
--    já ter respondido (checkin_solicitado é limpo no envio; este não).
alter table public.alunos
  add column if not exists checkin_auto_em timestamptz;

-- 2) Função do agendador ------------------------------------------------------
create or replace function public.solicitar_checkins_agendados()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  agora     timestamptz := now();
  loc       timestamp   := now() at time zone 'America/Sao_Paulo';
  dow       int  := extract(dow  from loc)::int;   -- 0=Dom .. 6=Sáb (= JS getDay)
  hoje      date := loc::date;
  min_agora int  := extract(hour from loc)::int * 60 + extract(minute from loc)::int;
  n         int;
begin
  with alvo as (
    select a.id
    from public.alunos a
    join public.planos p on p.id = a.plano_id
    where coalesce(p.agendar_checkins, false) = true          -- "agendar check-ins" ligado
      and p.checkin_config is not null
      and p.status = 'ativo'                                  -- plano ativo (não pausado)
      and a.status_pagamento is distinct from 'novo'          -- aluno já ativo
      and coalesce(a.checkin_solicitado, false) = false        -- ainda não pedido
      -- dia da semana configurado (diasSemana é um array jsonb de inteiros 0..6)
      and (p.checkin_config->'diasSemana') @> to_jsonb(dow)
      -- já passou do horário configurado hoje (HH:MM → minutos)
      and min_agora >= coalesce(
              nullif(split_part(p.checkin_config->>'horario', ':', 1), '')::int * 60
            + nullif(split_part(p.checkin_config->>'horario', ':', 2), '')::int, 0)
      -- no máximo 1 disparo por dia por aluno
      and (a.checkin_auto_em is null
           or (a.checkin_auto_em at time zone 'America/Sao_Paulo')::date < hoje)
      -- janela de frequência (semanal = todo dia configurado)
      and case p.checkin_config->>'frequencia'
            when 'quinzenal' then
              ((hoje - coalesce(a.inicio, date '2024-01-01')) / 7) % 2 = 0
            when 'mensal' then
              extract(day from loc)::int <= 7      -- 1ª ocorrência do dia no mês
            else true
          end
  )
  update public.alunos a
     set checkin_solicitado      = true,
         checkin_solicitado_em   = agora,
         checkin_auto_em         = agora,
         checkin_solicitacao_msg = null
    from alvo
   where a.id = alvo.id;

  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

comment on function public.solicitar_checkins_agendados() is
  'Cron: marca checkin_solicitado nos alunos cujo plano.checkin_config casa com agora (America/Sao_Paulo).';

-- Só service_role (testes) e o dono (cron) executam — nunca anon/authenticated.
revoke all on function public.solicitar_checkins_agendados() from public, anon, authenticated;
grant execute on function public.solicitar_checkins_agendados() to service_role;

-- 3) Agenda no pg_cron (a cada 15 min) ---------------------------------------
create extension if not exists pg_cron;

-- Recria o job de forma idempotente.
select cron.unschedule('checkins-agendados')
  where exists (select 1 from cron.job where jobname = 'checkins-agendados');

select cron.schedule(
  'checkins-agendados',
  '*/15 * * * *',
  $cron$ select public.solicitar_checkins_agendados(); $cron$
);

notify pgrst, 'reload schema';

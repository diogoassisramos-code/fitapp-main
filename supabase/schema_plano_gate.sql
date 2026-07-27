-- ============================================================================
-- Revo — Gate do plano (server-side / RLS). O consultor NUNCA perde a conta,
-- mas com o plano lapsado não pode ESCREVER (CRUD de aluno/produto). Leitura e
-- saque seguem liberados. Enforcement de verdade fica aqui na RLS (o front só
-- melhora a UX).
--
-- Regra "ativo o suficiente": plano_status in ('ativo','trial') OU (cancelado e
-- ainda dentro do ciclo pago — now() < plano_ate). 'inadimplente' não tem grace.
--
-- Idempotente. Rode DEPOIS de schema.sql, schema_planos.sql e schema_membership.sql.
-- ============================================================================

-- 1) Até quando o acesso vale num plano cancelado (fim do ciclo pago).
alter table public.consultorias
  add column if not exists plano_ate timestamptz;

-- 2) O plano do consultor logado está ativo (ou em grace)?
create or replace function public.plano_ativo()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.consultorias c
    where c.id = public.current_consultoria_id()
      and (
        c.plano_status in ('ativo', 'trial')
        or (c.plano_status = 'cancelado' and c.plano_ate is not null and now() < c.plano_ate)
      )
  );
$$;
grant execute on function public.plano_ativo() to authenticated;

-- 3) Reescreve as policies de ESCRITA de alunos + planos acrescentando o gate no
--    ramo do consultor. Admin e SELECT ficam iguais (leitura sempre liberada).

-- alunos --------------------------------------------------------------------
drop policy if exists alunos_insert on public.alunos;
create policy alunos_insert on public.alunos for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id() and public.plano_ativo())
);
drop policy if exists alunos_update on public.alunos;
create policy alunos_update on public.alunos for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(id) and public.plano_ativo()))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(id) and public.plano_ativo()));
drop policy if exists alunos_delete on public.alunos;
create policy alunos_delete on public.alunos for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and public.consultor_tem_vinculo(id) and public.plano_ativo()));

-- planos (produtos do consultor) --------------------------------------------
drop policy if exists planos_insert on public.planos;
create policy planos_insert on public.planos for insert with check (
  public.is_admin()
  or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id() and public.plano_ativo())
);
drop policy if exists planos_update on public.planos;
create policy planos_update on public.planos for update
  using  (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id() and public.plano_ativo()))
  with check (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id() and public.plano_ativo()));
drop policy if exists planos_delete on public.planos;
create policy planos_delete on public.planos for delete
  using (public.is_admin() or (public.auth_app_role() = 'consultor' and consultoria_id = public.current_consultoria_id() and public.plano_ativo()));

notify pgrst, 'reload schema';

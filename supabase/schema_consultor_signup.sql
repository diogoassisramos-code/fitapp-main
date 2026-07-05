-- ============================================================================
-- Revo — Cadastro do consultor (persistência real do signup).
--
-- O schema.sql já cria consultoria + profile no signup via handle_new_user.
-- Esta migration COMPLETA isso pra o fluxo de /cadastro:
--   1) adiciona à consultoria os campos que faltavam: telefone e o PLANO da
--      plataforma escolhido no cadastro (free | pro | avancado);
--   2) reescreve handle_new_user pra gravar, no signup do consultor, o CPF
--      (documento), o telefone e o plano — lidos do raw_user_meta_data.
--
-- O frontend (/cadastro) deve chamar:
--   supabase.auth.signUp({ email, password, options: { data: {
--     role: 'consultor', nome, cpf, telefone, plano } } })
-- (verificação de e-mail = ligar "Confirm email" em Auth → Providers → Email.)
--
-- Idempotente. Rode no SQL Editor DEPOIS do schema.sql principal.
-- ============================================================================

-- 1) Campos que faltavam na consultoria: contato + plano da plataforma ---------
alter table public.consultorias
  add column if not exists telefone     text,
  add column if not exists plano        text not null default 'free',   -- free | pro | avancado
  add column if not exists plano_status text not null default 'ativo';  -- ativo | trial | inadimplente | cancelado

-- Constraints de domínio (o valor vem de metadata do client no signup; sem CHECK
-- a coluna aceitaria qualquer texto). Idempotente.
alter table public.consultorias drop constraint if exists consultorias_plano_chk;
alter table public.consultorias add  constraint consultorias_plano_chk
  check (plano in ('free','pro','avancado'));
alter table public.consultorias drop constraint if exists consultorias_plano_status_chk;
alter table public.consultorias add  constraint consultorias_plano_status_chk
  check (plano_status in ('ativo','trial','inadimplente','cancelado'));

-- 2) Signup do consultor passa a gravar CPF, telefone e plano escolhido --------
-- (mesma função do schema.sql, com as 3 colunas novas no INSERT da consultoria;
--  os ramos de admin/aluno seguem idênticos.)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role  app_role := coalesce((new.raw_user_meta_data->>'role')::app_role, 'consultor');
  v_cid   uuid := nullif(new.raw_user_meta_data->>'consultoria_id','')::uuid;
  v_aid   uuid := nullif(new.raw_user_meta_data->>'aluno_id','')::uuid;
  v_nome  text := new.raw_user_meta_data->>'nome';
  v_cpf   text := new.raw_user_meta_data->>'cpf';
  v_tel   text := new.raw_user_meta_data->>'telefone';
  -- Plano vem 100% do client (options.data do signUp). NÃO confiar nele para
  -- conceder entitlement pago: whitelist + qualquer plano pago nasce como
  -- 'trial' (não 'ativo') até um caminho confiável confirmar o pagamento
  -- (webhook do gateway / Edge Function com service role).
  v_plano text := coalesce(nullif(new.raw_user_meta_data->>'plano',''), 'free');
  v_plano_status text;
  v_aluno_cid uuid;
begin
  if v_plano not in ('free','pro','avancado') then
    v_plano := 'free';
  end if;
  v_plano_status := case when v_plano = 'free' then 'ativo' else 'trial' end;

  if v_role = 'admin' then
    raise exception 'admin nao pode ser criado via signup';
  elsif v_role = 'consultor' then
    if v_cid is not null then raise exception 'consultor nao pode escolher consultoria existente'; end if;
    insert into public.consultorias (nome, nome_negocio, documento, telefone, plano, plano_status)
      values (coalesce(v_nome, new.email), coalesce(v_nome, new.email), v_cpf, v_tel, v_plano, v_plano_status)
      returning id into v_cid;
    v_aid := null;
  elsif v_role = 'aluno' then
    if v_cid is null or v_aid is null then
      raise exception 'aluno signup requires consultoria_id and aluno_id';
    end if;
    select consultoria_id into v_aluno_cid from public.alunos where id = v_aid;
    if v_aluno_cid is null or v_aluno_cid <> v_cid then
      raise exception 'aluno_id nao pertence a consultoria informada';
    end if;
    if exists (select 1 from public.profiles where aluno_id = v_aid) then
      raise exception 'aluno ja possui conta';
    end if;
  end if;

  insert into public.profiles (id, role, consultoria_id, aluno_id, nome, email)
    values (new.id, v_role, v_cid, v_aid, v_nome, new.email);
  return new;
end $$;

-- Trigger (recria por garantia — igual ao schema.sql).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Recarrega o cache de schema do PostgREST (pras colunas novas aparecerem já).
notify pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- Conferência rápida (opcional): depois de um cadastro real, deve aparecer 1
-- consultoria + 1 profile com role='consultor'.
--   select nome, documento, telefone, plano from public.consultorias order by created_at desc limit 5;
--   select role, nome, email, consultoria_id from public.profiles order by created_at desc limit 5;
-- ----------------------------------------------------------------------------

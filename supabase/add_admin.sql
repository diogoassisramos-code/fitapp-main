-- ============================================================================
-- Cria a conta de SUPER-ADMIN (painel master). Rode 1x no SQL Editor.
-- O signup bloqueia role=admin de propósito (segurança), então criamos aqui.
--
-- SEGURANÇA:
--  * Nenhuma senha fica no arquivo. Uma senha aleatória é gerada na execução e
--    IMPRESSA em "Messages"/NOTICE ao rodar — copie-a e troque no 1º acesso.
--  * Ajuste `v_email`/`v_nome` abaixo para os dados reais do admin antes de rodar.
-- ============================================================================
do $$
declare
  v_id    uuid := '44444444-4444-4444-4444-444444444444';
  v_email text := 'admin@revo.app';                         -- << troque pelo e-mail real
  v_nome  text := 'Admin Revo';
  v_pwd   text := encode(gen_random_bytes(12), 'base64');   -- senha aleatória (não commitada)
begin
  perform set_config('session_replication_role', 'replica', true); -- não dispara o trigger de signup

  delete from auth.users where id = v_id;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new)
  values ('00000000-0000-0000-0000-000000000000', v_id,
    'authenticated', 'authenticated', v_email, crypt(v_pwd, gen_salt('bf')), now(),
    now(), now(), '{"provider":"email","providers":["email"]}',
    jsonb_build_object('nome', v_nome, 'role', 'admin'),
    '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email), 'email', now(), now(), now());

  -- admin: sem consultoria nem aluno (atende a constraint profiles_role_shape)
  insert into public.profiles (id, role, nome, email)
  values (v_id, 'admin', v_nome, v_email);

  raise notice '──────────────────────────────────────────────────────';
  raise notice 'Admin criado: %', v_email;
  raise notice 'Senha temporária: %   (troque no primeiro acesso)', v_pwd;
  raise notice '──────────────────────────────────────────────────────';
end $$;

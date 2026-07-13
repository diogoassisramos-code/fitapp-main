-- ============================================================================
-- Revo — Torna diogoassisramos@gmail.com o SUPER-ADMIN do painel.
--
-- O acesso ao /admin é decidido por E-MAIL (allowlist em src/lib/adminAccess.ts).
-- Mas o painel LÊ dados via RLS `is_admin()`, que exige profiles.role='admin'.
-- Este script garante isso no banco. Rode 1x no SQL Editor do Supabase.
--
-- Idempotente e cobre os dois casos:
--   • conta JÁ existe (você já se cadastrou com esse e-mail) → PROMOVE a admin;
--   • conta NÃO existe → CRIA com senha aleatória (impressa em NOTICE ao rodar).
--
-- ⚠️ ATENÇÃO: um perfil admin NÃO tem consultoria nem aluno (constraint
--    profiles_role_shape). Se este e-mail hoje é um CONSULTOR com dados, ao
--    virar admin ele se desvincula da consultoria (a consultoria e os alunos
--    permanecem, só deixam de estar ligados a este perfil). Se você quer manter
--    esse e-mail como consultor de teste, use OUTRO e-mail para o admin e ajuste
--    ADMIN_EMAILS em src/lib/adminAccess.ts.
--
-- Depois de rodar: FAÇA LOGOUT e LOGIN de novo (o middleware lê o papel do JWT,
-- que só atualiza numa nova sessão).
-- ============================================================================
do $$
declare
  v_email text := 'diogoassisramos@gmail.com';
  v_nome  text := 'Diogo Ramos';
  v_id    uuid;
  v_pwd   text;
begin
  select id into v_id from auth.users where lower(email) = lower(v_email);

  if v_id is null then
    -- Conta não existe: cria com senha aleatória (não fica no arquivo).
    v_id  := gen_random_uuid();
    v_pwd := encode(gen_random_bytes(12), 'base64');
    perform set_config('session_replication_role', 'replica', true); -- não dispara o trigger de signup

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

    raise notice '──────────────────────────────────────────────────────';
    raise notice 'Admin CRIADO: %', v_email;
    raise notice 'Senha temporária: %   (troque no primeiro acesso)', v_pwd;
    raise notice '──────────────────────────────────────────────────────';
  else
    -- Conta já existe: promove a admin (papel no JWT + metadata).
    update auth.users
      set raw_user_meta_data =
        coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', 'admin', 'nome', v_nome)
      where id = v_id;
    raise notice 'Conta % promovida a admin (id %). Faça logout/login.', v_email, v_id;
  end if;

  -- Perfil admin puro (sem consultoria/aluno) — satisfaz profiles_role_shape.
  insert into public.profiles (id, role, nome, email, consultoria_id, aluno_id)
  values (v_id, 'admin', v_nome, v_email, null, null)
  on conflict (id) do update
    set role = 'admin', consultoria_id = null, aluno_id = null,
        nome = excluded.nome, email = excluded.email;
end $$;

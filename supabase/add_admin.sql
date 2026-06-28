-- ============================================================================
-- Cria a conta de SUPER-ADMIN (painel master). Rode 1x no SQL Editor.
-- O signup bloqueia role=admin de propósito (segurança), então criamos aqui.
-- Login: admin@coachfit.com / coachfit123
-- ============================================================================
begin;
set local session_replication_role = replica;   -- não dispara o trigger de signup

delete from auth.users where id = '44444444-4444-4444-4444-444444444444';

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444',
  'authenticated', 'authenticated', 'admin@coachfit.com', crypt('coachfit123', gen_salt('bf')), now(),
  now(), now(), '{"provider":"email","providers":["email"]}', '{"nome":"Admin CoachFit","role":"admin"}',
  '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444',
  '{"sub":"44444444-4444-4444-4444-444444444444","email":"admin@coachfit.com"}', 'email', now(), now(), now());

-- admin: sem consultoria nem aluno (atende a constraint profiles_role_shape)
insert into public.profiles (id, role, nome, email)
values ('44444444-4444-4444-4444-444444444444', 'admin', 'Admin CoachFit', 'admin@coachfit.com');

set local session_replication_role = origin;
commit;

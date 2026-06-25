-- ============================================================================
-- CoachFit — Seed de demonstração (rode DEPOIS do schema.sql)
--
-- Cria, com IDs fixos e contas de login prontas:
--   • 1 consultoria (CoachFit / Rafael Mendes)
--   • 1 consultor  -> login: rafael@coachfit.com / coachfit123
--   • 3 alunos (Ana em dia, Bruno pendente, Carla atrasado)
--   • 1 aluno com login (Ana) -> login: ana@coachfit.com / coachfit123
--   • Treino A da Ana com exercícios (inclui detalhamento de séries)
--
-- Usa session_replication_role = replica p/ inserir auth.users + profiles
-- com IDs fixos SEM disparar o trigger de signup. Rode no SQL Editor.
-- Idempotente: limpa os registros demo antes de reinserir.
-- ============================================================================

begin;
set local session_replication_role = replica;   -- desliga triggers nesta transação

-- ids fixos
-- consultoria 11111111… | consultor 22222222… | aluno-auth 33333333…
-- alunos a0000000…0001/2/3 | treino b0000000…0001

-- limpeza (ordem importa por causa das FKs; casc ade cobre filhos)
delete from auth.users   where id in ('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333');
delete from public.consultorias where id = '11111111-1111-1111-1111-111111111111';

-- ---------------- consultoria (tenant) ----------------
insert into public.consultorias (id, nome, conselho_tipo, conselho_numero, nome_negocio, especialidade, saldo, a_liberar)
values ('11111111-1111-1111-1111-111111111111', 'Rafael Mendes', 'CREF', '123456-G/SP', 'CoachFit', 'Hipertrofia & emagrecimento', 4820.50, 1980.00);

-- ---------------- consultor (auth.users + identity + profile) ----------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
  'authenticated', 'authenticated', 'rafael@coachfit.com', crypt('coachfit123', gen_salt('bf')), now(),
  now(), now(), '{"provider":"email","providers":["email"]}', '{"nome":"Rafael Mendes","role":"consultor"}',
  '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
  '{"sub":"22222222-2222-2222-2222-222222222222","email":"rafael@coachfit.com"}', 'email', now(), now(), now());
insert into public.profiles (id, role, consultoria_id, nome, email)
values ('22222222-2222-2222-2222-222222222222', 'consultor', '11111111-1111-1111-1111-111111111111', 'Rafael Mendes', 'rafael@coachfit.com');

-- ---------------- alunos ----------------
insert into public.alunos (id, consultoria_id, nome, cpf, email, objetivo, status_pagamento, proximo_vencimento, inicio, peso_inicial, peso_atual, aderencia_treino, checkin_pendente)
values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Ana Paula Souza',  '111.111.111-11', 'ana@coachfit.com',   'Hipertrofia',   'em_dia',   '2026-06-28', '2026-05-10', 62.0, 60.4, 92, true),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Bruno Lima',       '222.222.222-22', 'bruno@exemplo.com',  'Emagrecimento', 'pendente', '2026-06-22', '2026-04-01', 88.0, 84.2, 70, true),
  ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Carla Reis',       '333.333.333-33', 'carla@exemplo.com',  'Avaliação',     'atrasado', '2026-06-14', '2026-03-15', 70.0, 69.1, 55, false);

-- ---------------- aluno com login (Ana) ----------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333',
  'authenticated', 'authenticated', 'ana@coachfit.com', crypt('coachfit123', gen_salt('bf')), now(),
  now(), now(), '{"provider":"email","providers":["email"]}', '{"nome":"Ana Paula Souza","role":"aluno"}',
  '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333',
  '{"sub":"33333333-3333-3333-3333-333333333333","email":"ana@coachfit.com"}', 'email', now(), now(), now());
insert into public.profiles (id, role, consultoria_id, aluno_id, nome, email)
values ('33333333-3333-3333-3333-333333333333', 'aluno', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'Ana Paula Souza', 'ana@coachfit.com');

-- ---------------- treino da Ana (publicado) ----------------
insert into public.treinos (id, consultoria_id, aluno_id, nome, rascunho)
values ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'Treino A — Superiores', false);

insert into public.exercicios (treino_id, consultoria_id, ordem, nome, grupo, series, reps, descanso_seg, video_origem, observacoes, series_detalhe)
values
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 1, 'Supino reto com barra', 'Peito',  4, '8-10', 90, 'biblioteca',
    'Desça controlado (2s na excêntrica) até tocar o peito. Cotovelos a ~45°.',
    '[{"rotulo":"Aquecimento","reps":"12","descansoSeg":30,"obs":"Carga leve, só pra ativar o peito."},{"rotulo":"Válida","reps":"8-10","descansoSeg":90},{"rotulo":"Válida","reps":"8-10","descansoSeg":90},{"rotulo":"Top set","reps":"6-8","descansoSeg":120,"obs":"Pode subir a carga. Leve até a falha técnica."}]'::jsonb),
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 2, 'Crucifixo com halteres', 'Peito',  3, '10-12', 60, 'biblioteca', null, '[]'::jsonb),
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 3, 'Puxada frontal',        'Costas', 4, '10-12', 75, 'biblioteca', null, '[]'::jsonb),
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 4, 'Remada curvada',        'Costas', 3, '8-10',  90, 'vazio',      null, '[]'::jsonb),
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 5, 'Desenvolvimento militar','Ombros', 3, '10-12', 60, 'biblioteca', null, '[]'::jsonb);

set local session_replication_role = origin;   -- reativa triggers
commit;

-- Logins prontos:
--   Consultor (dashboard): rafael@coachfit.com / coachfit123
--   Aluno (app mobile):    ana@coachfit.com    / coachfit123

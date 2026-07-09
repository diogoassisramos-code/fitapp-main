-- ============================================================================
-- Revo — Anamnese: config por consultoria + respostas por aluno.
--
-- Gating do consultor: pra criar plano precisa ter recebimento ativo E a
-- anamnese "decidida" — anamnese_ativa = true (criou perguntas) OU false (optou
-- por não ter). null = ainda não decidiu (bloqueado).
--
-- Aluno: no 1º acesso responde a anamnese (quando a consultoria tem uma) antes
-- de liberar o check-in. anamnese_respondida marca isso.
--
-- Idempotente. Rodar no SQL Editor DEPOIS do schema.sql.
-- ============================================================================

alter table public.consultorias
  add column if not exists anamnese_ativa     boolean,
  add column if not exists anamnese_perguntas jsonb not null default '[]'::jsonb;

alter table public.alunos
  add column if not exists anamnese_respondida boolean not null default false,
  add column if not exists anamnese_respostas  jsonb;

notify pgrst, 'reload schema';

-- ============================================================================
-- Revo — Configurações: cor de destaque do checkout na consultoria.
-- (As demais configs — perfil, dados do profissional, recebimento e
--  notificações — já têm colunas no schema.sql.)
-- Idempotente. Rode no SQL Editor.
-- ============================================================================
alter table public.consultorias
  add column if not exists checkout_cor text;

notify pgrst, 'reload schema';

-- Adiciona a coluna telefone aos alunos (rode 1x no SQL Editor do Supabase).
-- O grant de UPDATE/INSERT em alunos é por tabela, então a nova coluna já é
-- coberta — não precisa de grant extra.
alter table public.alunos add column if not exists telefone text;

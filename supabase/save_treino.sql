-- ============================================================================
-- save_treino — salvar treino + substituir exercícios de forma ATÔMICA.
--
-- Opcional (upgrade): hoje o app usa delete-then-insert no client (src/lib/db.ts
-- saveTreino), que tem uma pequena janela de escrita parcial. Rodando esta RPC
-- e trocando saveTreino para supabase.rpc("save_treino", ...), tudo vira UMA
-- transação (delete + insert juntos → rollback se algo falhar).
--
-- security invoker: roda como o consultor logado → a RLS continua valendo
-- (não fura o isolamento por consultoria). consultoria_id é setado pelos
-- triggers das tabelas — nunca enviamos do client.
-- ============================================================================
create or replace function public.save_treino(
  p_aluno_id   uuid,
  p_treino_id  uuid,
  p_nome       text,
  p_rascunho   boolean,
  p_exercicios jsonb            -- [{ordem,nome,grupo,series,reps,descanso_seg,video_origem,video_url,observacoes,series_detalhe}]
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_treino_id uuid;
begin
  if p_treino_id is null then
    insert into treinos (aluno_id, nome, rascunho)
    values (p_aluno_id, coalesce(nullif(trim(p_nome), ''), 'Novo treino'), p_rascunho)
    returning id into v_treino_id;            -- consultoria_id via trigger
  else
    update treinos
       set nome = coalesce(nullif(trim(p_nome), ''), 'Novo treino'),
           rascunho = p_rascunho
     where id = p_treino_id                    -- RLS: só se for da consultoria
    returning id into v_treino_id;
    if v_treino_id is null then
      raise exception 'treino % não encontrado ou sem permissão', p_treino_id;
    end if;
  end if;

  -- replace atômico dos exercícios
  delete from exercicios where treino_id = v_treino_id;

  insert into exercicios
    (treino_id, ordem, nome, grupo, series, reps, descanso_seg,
     video_origem, video_url, observacoes, series_detalhe)
  select
    v_treino_id,
    (e->>'ordem')::int,
    e->>'nome',
    e->>'grupo',
    nullif(e->>'series', '')::int,
    e->>'reps',
    nullif(e->>'descanso_seg', '')::int,
    coalesce(e->>'video_origem', 'vazio')::video_origem,
    e->>'video_url',
    e->>'observacoes',
    coalesce(e->'series_detalhe', '[]'::jsonb)
  from jsonb_array_elements(p_exercicios) as e;

  return v_treino_id;
end;
$$;

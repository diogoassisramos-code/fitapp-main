-- ============================================================================
-- save_dieta — salva dieta + substitui refeições/alimentos de forma ATÔMICA.
-- Opcional (upgrade do delete-then-insert do client em db.ts saveDieta).
-- Rode 1x e troque saveDieta para supabase.rpc("save_dieta", {...}).
-- security invoker: roda como o consultor → RLS continua valendo.
-- ============================================================================
create or replace function public.save_dieta(
  p_aluno_id   uuid,
  p_dieta_id   uuid,
  p_meta_kcal  int,
  p_rascunho   boolean,
  p_refeicoes  jsonb  -- [{nome,horario,observacoes,alimentos:[{nome,quantidade:{valor,unidade},macros:{kcal,p,c,g},substituicoes,custom,semMacros,observacoes}]}]
) returns uuid
language plpgsql security invoker set search_path = public
as $$
declare v_dieta uuid; v_ref uuid; r jsonb; i int := 0;
begin
  if p_dieta_id is null then
    insert into dietas (aluno_id, meta_kcal, rascunho)
      values (p_aluno_id, coalesce(p_meta_kcal,0), p_rascunho) returning id into v_dieta;
  else
    update dietas set meta_kcal = coalesce(p_meta_kcal,0), rascunho = p_rascunho
      where id = p_dieta_id returning id into v_dieta;
    if v_dieta is null then raise exception 'dieta % nao encontrada/sem permissao', p_dieta_id; end if;
  end if;

  delete from refeicoes where dieta_id = v_dieta;  -- cascata limpa alimentos

  for r in select * from jsonb_array_elements(coalesce(p_refeicoes,'[]'::jsonb)) loop
    insert into refeicoes (dieta_id, ordem, nome, horario, observacoes)
      values (v_dieta, i, r->>'nome', r->>'horario', r->>'observacoes') returning id into v_ref;

    insert into alimentos (refeicao_id, ordem, nome, qtd_valor, qtd_unidade, kcal, p, c, g, substituicoes, custom, sem_macros, observacoes)
    select v_ref, (a.idx - 1), a.e->>'nome',
      nullif(a.e#>>'{quantidade,valor}','')::numeric, a.e#>>'{quantidade,unidade}',
      nullif(a.e#>>'{macros,kcal}','')::numeric, nullif(a.e#>>'{macros,p}','')::numeric,
      nullif(a.e#>>'{macros,c}','')::numeric, nullif(a.e#>>'{macros,g}','')::numeric,
      coalesce((select array_agg(x) from jsonb_array_elements_text(a.e->'substituicoes') x), '{}'),
      coalesce((a.e->>'custom')::boolean, false), coalesce((a.e->>'semMacros')::boolean, false), a.e->>'observacoes'
    from jsonb_array_elements(coalesce(r->'alimentos','[]'::jsonb)) with ordinality as a(e, idx);
    i := i + 1;
  end loop;
  return v_dieta;
end $$;

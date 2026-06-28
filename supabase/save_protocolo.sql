-- ============================================================================
-- save_protocolo — salva protocolo + substitui blocos/itens de forma ATÔMICA.
-- Opcional (upgrade do delete-then-insert do client em db.ts saveProtocolo).
-- Rode 1x e troque saveProtocolo para supabase.rpc("save_protocolo", {...}).
-- ============================================================================
create or replace function public.save_protocolo(
  p_aluno_id      uuid,
  p_protocolo_id  uuid,
  p_rascunho      boolean,
  p_blocos        jsonb  -- [{nome, itens:[{nome,dose,horario,observacoes,comoUsar,comOQue,beneficio,duracao}]}]
) returns uuid
language plpgsql security invoker set search_path = public
as $$
declare v_proto uuid; v_blk uuid; b jsonb; i int := 0;
begin
  if p_protocolo_id is null then
    insert into protocolos (aluno_id, rascunho)
      values (p_aluno_id, p_rascunho) returning id into v_proto;
  else
    update protocolos set rascunho = p_rascunho
      where id = p_protocolo_id returning id into v_proto;
    if v_proto is null then raise exception 'protocolo % nao encontrado/sem permissao', p_protocolo_id; end if;
  end if;

  delete from protocolo_blocos where protocolo_id = v_proto;  -- cascata limpa itens

  for b in select * from jsonb_array_elements(coalesce(p_blocos,'[]'::jsonb)) loop
    insert into protocolo_blocos (protocolo_id, ordem, nome)
      values (v_proto, i, b->>'nome') returning id into v_blk;

    insert into protocolo_itens (bloco_id, ordem, nome, dose, horario, observacoes, como_usar, com_o_que, beneficio, duracao)
    select v_blk, (it.idx - 1), it.e->>'nome', it.e->>'dose', it.e->>'horario', it.e->>'observacoes',
      it.e->>'comoUsar', it.e->>'comOQue', it.e->>'beneficio', it.e->>'duracao'
    from jsonb_array_elements(coalesce(b->'itens','[]'::jsonb)) with ordinality as it(e, idx);
    i := i + 1;
  end loop;
  return v_proto;
end $$;

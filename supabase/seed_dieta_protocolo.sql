-- ============================================================================
-- SEED — dieta + protocolo da Ana. Rode DEPOIS do schema_dieta_protocolo.sql.
-- Idempotente (pais antes dos filhos; IDs fixos). Opcional — só pra demo.
-- ============================================================================
do $$
declare
  v_aluno uuid := 'a0000000-0000-0000-0000-000000000001';
  v_dieta uuid := 'd1000000-0000-0000-0000-000000000001';
  v_ref1  uuid := 'd1000000-0000-0000-0000-0000000000a1';
  v_ref2  uuid := 'd1000000-0000-0000-0000-0000000000a2';
  v_proto uuid := 'c1000000-0000-0000-0000-000000000001';
  v_blk1  uuid := 'c1000000-0000-0000-0000-0000000000b1';
  v_blk2  uuid := 'c1000000-0000-0000-0000-0000000000b2';
begin
  insert into public.dietas (id, aluno_id, meta_kcal, rascunho)
    values (v_dieta, v_aluno, 2200, false)
    on conflict (id) do update set meta_kcal = excluded.meta_kcal, rascunho = excluded.rascunho;
  delete from public.refeicoes where dieta_id = v_dieta;

  insert into public.refeicoes (id, dieta_id, ordem, nome, horario, observacoes) values
    (v_ref1, v_dieta, 0, 'Café da manhã', '07:00', 'Mastigue devagar.'),
    (v_ref2, v_dieta, 1, 'Almoço',        '12:30', null);

  insert into public.alimentos
    (refeicao_id, ordem, nome, qtd_valor, qtd_unidade, kcal, p, c, g, substituicoes, custom, sem_macros, observacoes) values
    (v_ref1, 0, 'Ovos',            3,   'unid', 210, 18, 1,  15, '{Claras}',               false, false, null),
    (v_ref1, 1, 'Aveia',           40,  'g',    150, 5,  27, 3,  '{Tapioca,Pão integral}', false, false, 'Com água.'),
    (v_ref2, 0, 'Frango grelhado', 150, 'g',    240, 45, 0,  6,  '{Patinho,Tilápia}',      false, false, null),
    (v_ref2, 1, 'Arroz integral',  120, 'g',    160, 3,  34, 1,  '{Batata doce}',          false, false, null);

  insert into public.protocolos (id, aluno_id, rascunho)
    values (v_proto, v_aluno, false)
    on conflict (id) do update set rascunho = excluded.rascunho;
  delete from public.protocolo_blocos where protocolo_id = v_proto;

  insert into public.protocolo_blocos (id, protocolo_id, ordem, nome) values
    (v_blk1, v_proto, 0, 'Suplementos'),
    (v_blk2, v_proto, 1, 'Manipulados');

  insert into public.protocolo_itens
    (bloco_id, ordem, nome, dose, horario, observacoes, como_usar, com_o_que, beneficio, duracao) values
    (v_blk1, 0, 'Creatina',    '5 g',     'Qualquer horário', null,            'Dissolva e tome.', '250 ml de água', 'Força e volume', 'Contínuo'),
    (v_blk1, 1, 'Whey',        '30 g',    'Pós-treino',       null,            null,               'Água ou leite',  'Proteína',       'Contínuo'),
    (v_blk2, 0, 'Vitamina D3', '2000 UI', 'Café da manhã',    'Com gordura.',  null,               'Refeição',       'Imunidade',      '8 semanas');
end $$;

-- ============================================================================
-- Revo — RPCs de anamnese/perfil para o APP DO ALUNO (mobile).
--
-- O mobile não tem service_role e a RLS não deixa o aluno LER a consultoria
-- (consultorias_select = admin/consultor) nem ESCREVER na própria linha de
-- alunos (alunos_update = admin/consultor). Então o contexto do aluno (nome da
-- consultoria/consultor/plano + anamnese) e a resposta da anamnese passam por
-- funções SECURITY DEFINER, sempre escopadas em current_aluno_id() — o aluno só
-- enxerga/mexe no que é dele. Mesmo padrão do enviar_checkin.
--
-- Idempotente. Rodar DEPOIS de schema.sql e schema_anamnese.sql.
-- ============================================================================

-- Dados PARCIAIS do cartão que o aluno cadastrou na compra (nunca o número
-- completo) — pra a tela de pagamento do app mostrar "•••• 4242 / Visa".
alter table public.alunos
  add column if not exists cartao_final    text,
  add column if not exists cartao_bandeira text,
  add column if not exists cartao_titular  text,
  add column if not exists cartao_validade text;

-- meu_perfil(): tudo que a home/perfil/pagamento do app precisam, em 1 chamada.
create or replace function public.meu_perfil()
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'nome',                a.nome,
    'objetivo',            a.objetivo,
    'peso_atual',          a.peso_atual,
    'peso_inicial',        a.peso_inicial,
    'status_pagamento',    a.status_pagamento::text,
    'proximo_vencimento',  a.proximo_vencimento::text,
    'anamnese_respondida', coalesce(a.anamnese_respondida, false),
    'consultoria',         coalesce(c.nome_negocio, c.nome),
    'consultor', (
      select p.nome from public.profiles p
       where p.consultoria_id = a.consultoria_id and p.role = 'consultor'
       order by p.nome limit 1
    ),
    'plano',               pl.nome,
    'plano_valor',         pl.preco,
    'plano_recorrencia',   pl.periodo_recorrencia,
    'cartao_final',        a.cartao_final,
    'cartao_bandeira',     a.cartao_bandeira,
    'cartao_titular',      a.cartao_titular,
    'cartao_validade',     a.cartao_validade,
    'anamnese_ativa',      c.anamnese_ativa,
    'anamnese_perguntas',  coalesce(c.anamnese_perguntas, '[]'::jsonb)
  )
  from public.alunos a
  join public.consultorias c on c.id = a.consultoria_id
  left join public.planos pl on pl.id = a.plano_id
  where a.id = public.current_aluno_id();
$$;

revoke execute on function public.meu_perfil() from anon, public;
grant  execute on function public.meu_perfil() to authenticated;

-- responder_anamnese(): grava as respostas do aluno logado. Valida no servidor
-- que a anamnese está ativa e que todas as obrigatórias vieram preenchidas —
-- o cliente não é confiável.
create or replace function public.responder_anamnese(p_respostas jsonb)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_aluno     uuid := public.current_aluno_id();
  v_ativa     boolean;
  v_perguntas jsonb;
  v_faltando  text;
begin
  if v_aluno is null then
    raise exception 'sem aluno na sessão';
  end if;
  if p_respostas is null or jsonb_typeof(p_respostas) <> 'object' then
    raise exception 'respostas inválidas';
  end if;

  select c.anamnese_ativa, coalesce(c.anamnese_perguntas, '[]'::jsonb)
    into v_ativa, v_perguntas
    from public.alunos a
    join public.consultorias c on c.id = a.consultoria_id
   where a.id = v_aluno;

  if v_ativa is not true then
    raise exception 'anamnese não está ativa';
  end if;

  -- 1ª obrigatória sem resposta não-vazia → erro (texto pra mensagem útil).
  select (q->>'texto') into v_faltando
    from jsonb_array_elements(v_perguntas) q
   where coalesce((q->>'obrigatoria')::boolean, false)
     and coalesce(btrim(p_respostas->>(q->>'id')), '') = ''
   limit 1;
  if v_faltando is not null then
    raise exception 'responda: %', v_faltando;
  end if;

  update public.alunos
     set anamnese_respondida = true,
         anamnese_respostas  = p_respostas
   where id = v_aluno;
end $$;

revoke execute on function public.responder_anamnese(jsonb) from anon, public;
grant  execute on function public.responder_anamnese(jsonb) to authenticated;

notify pgrst, 'reload schema';

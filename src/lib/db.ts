/**
 * Acesso a dados via Supabase (usado quando `supabaseEnabled`). Mapeia as
 * colunas snake_case do banco para os tipos camelCase do app, então as telas
 * não mudam de forma. Enquanto o Supabase não está configurado, as telas usam
 * os acessores mock de `data.ts`.
 */
import { createClient } from "@/utils/supabase/client";
import { dataLocalYMD } from "./format";
import type {
  Aluno,
  Treino,
  Exercicio,
  Dieta,
  Refeicao,
  Alimento,
  Protocolo,
  ProtocoloBloco,
  ProtocoloItem,
  CheckIn,
  FotoCheckin,
  Plano,
  PlanoIncluso,
  FormaPagamento,
  CheckinConfig,
  TipoCobranca,
  StatusPlano,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * true quando o erro é "função RPC inexistente" (PGRST202) — ou seja, a
 * migration da RPC ainda não rodou no banco. Usado para cair no fallback
 * delete-then-insert sem quebrar quem ainda não aplicou os supabase/save_*.sql.
 */
function isMissingRpc(
  error: { code?: string; message?: string } | null,
  nome: string
): boolean {
  if (!error) return false;
  return error.code === "PGRST202" || new RegExp(nome, "i").test(error.message ?? "");
}

function mapAluno(r: any): Aluno {
  return {
    id: r.id,
    planoId: r.plano_id ?? "",
    nome: r.nome,
    cpf: r.cpf ?? "",
    email: r.email ?? "",
    objetivo: r.objetivo ?? "",
    statusPagamento: r.status_pagamento,
    proximoVencimento: r.proximo_vencimento ?? "",
    inicio: r.inicio ?? "",
    pesoInicial: Number(r.peso_inicial ?? 0),
    pesoAtual: Number(r.peso_atual ?? 0),
    aderenciaTreino: r.aderencia_treino ?? 0,
    checkinPendente: !!r.checkin_pendente,
    aguardandoProtocolo: !!r.aguardando_protocolo,
    checkinSolicitado: !!r.checkin_solicitado,
    checkinSolicitacaoMsg: r.checkin_solicitacao_msg ?? undefined,
  };
}

/** Consultor solicita um check-in ao aluno (flag + mensagem opcional). */
export async function solicitarCheckin(
  alunoId: string,
  mensagem?: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("alunos")
    .update({
      checkin_solicitado: true,
      checkin_solicitado_em: new Date().toISOString(),
      checkin_solicitacao_msg: mensagem?.trim() || null,
    })
    .eq("id", alunoId);
  if (error) throw error;
}

/** Cancela a solicitação de check-in (consultor). */
export async function cancelarSolicitacaoCheckin(alunoId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("alunos")
    .update({ checkin_solicitado: false, checkin_solicitacao_msg: null })
    .eq("id", alunoId);
  if (error) throw error;
}

function mapExercicio(r: any): Exercicio {
  return {
    id: r.id,
    ordem: r.ordem ?? 0,
    nome: r.nome,
    grupo: r.grupo ?? "",
    series: r.series ?? 0,
    reps: r.reps ?? "",
    descansoSeg: r.descanso_seg ?? 0,
    video: { origem: r.video_origem ?? "vazio", url: r.video_url ?? undefined },
    observacoes: r.observacoes ?? undefined,
    seriesDetalhe:
      Array.isArray(r.series_detalhe) && r.series_detalhe.length
        ? r.series_detalhe
        : undefined,
  };
}

/** consultoria_id do usuário logado (lido do próprio profile via RLS). */
export async function getMyConsultoriaId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // Propaga o erro (não engole): uma falha de rede/RLS aqui não deve virar
  // "sem consultoria" silencioso — quem chama distingue vazio de falha.
  const { data, error } = await supabase
    .from("profiles")
    .select("consultoria_id")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.consultoria_id ?? null;
}

/** Resumo financeiro da consultoria logada (saldo / a liberar). Zero se nova. */
export async function fetchConsultoriaResumo(): Promise<{
  saldo: number;
  aLiberar: number;
}> {
  const supabase = createClient();
  const cid = await getMyConsultoriaId();
  if (!cid) return { saldo: 0, aLiberar: 0 };
  const { data, error } = await supabase
    .from("consultorias")
    .select("saldo, a_liberar")
    .eq("id", cid)
    .maybeSingle();
  if (error) throw error; // não mascarar falha como saldo R$ 0
  return {
    saldo: Number(data?.saldo ?? 0),
    aLiberar: Number(data?.a_liberar ?? 0),
  };
}

export type FinanceiroReal = {
  saldo: number;
  aLiberar: number;
  recebidoMes: number;
  mrr: number;
  alunosAtivos: number;
  inadimplenciaValor: number;
  inadimplenciaAlunos: number;
  faturamento: { mes: string; valor: number }[];
  extrato: {
    id: string;
    alunoNome: string;
    valor: number;
    metodo: string;
    data: string;
    status: string;
  }[];
};

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Financeiro REAL da consultoria logada (sem mock): saldo, alunos e pagamentos
 * vindos do banco. Conta nova → tudo zero/vazio (é o estado honesto).
 */
export async function fetchFinanceiro(): Promise<FinanceiroReal> {
  const supabase = createClient();
  const cid = await getMyConsultoriaId();
  const vazio: FinanceiroReal = {
    saldo: 0, aLiberar: 0, recebidoMes: 0, mrr: 0,
    alunosAtivos: 0, inadimplenciaValor: 0, inadimplenciaAlunos: 0,
    faturamento: [], extrato: [],
  };
  if (!cid) return vazio;

  const { data: cons } = await supabase
    .from("consultorias")
    .select("saldo, a_liberar, mensalidade_valor")
    .eq("id", cid)
    .maybeSingle();
  const mensalidade = Number(cons?.mensalidade_valor ?? 0);

  const { data: alunosData } = await supabase.from("alunos").select("status_pagamento");
  const alunos = alunosData ?? [];
  const alunosAtivos = alunos.filter((a) => a.status_pagamento !== "novo").length;
  const inad = alunos.filter((a) => a.status_pagamento === "atrasado" || a.status_pagamento === "pendente");

  const { data: pagData } = await supabase
    .from("pagamentos")
    .select("id, valor, billing_type, status, confirmado_em, recebido_em, criado_em, aluno_id, alunos(nome)")
    .eq("fluxo", "mensalidade")
    .order("criado_em", { ascending: false });
  const pagamentos = (pagData ?? []) as any[];

  const agoraMes = dataLocalYMD(new Date()).slice(0, 7); // YYYY-MM
  const recebidoMes = pagamentos
    .filter((p) => ["CONFIRMED", "RECEIVED", "confirmado", "recebido"].includes(String(p.status)))
    .filter((p) => dataLocalYMD(p.recebido_em ?? p.confirmado_em ?? p.criado_em).slice(0, 7) === agoraMes)
    .reduce((s, p) => s + Number(p.valor ?? 0), 0);

  // Faturamento dos últimos 6 meses a partir dos pagamentos confirmados.
  const porMes = new Map<string, number>();
  for (const p of pagamentos) {
    const ymd = dataLocalYMD(p.confirmado_em ?? p.recebido_em ?? p.criado_em);
    if (!ymd) continue;
    const chave = ymd.slice(0, 7);
    porMes.set(chave, (porMes.get(chave) ?? 0) + Number(p.valor ?? 0));
  }
  const faturamento = [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([chave, valor]) => ({ mes: MESES_CURTOS[Number(chave.slice(5, 7)) - 1], valor }));

  const extrato = pagamentos.slice(0, 30).map((p) => ({
    id: p.id,
    alunoNome: p.alunos?.nome ?? "Aluno",
    valor: Number(p.valor ?? 0),
    metodo: p.billing_type ?? "—",
    data: dataLocalYMD(p.confirmado_em ?? p.criado_em),
    status: String(p.status ?? ""),
  }));

  return {
    saldo: Number(cons?.saldo ?? 0),
    aLiberar: Number(cons?.a_liberar ?? 0),
    recebidoMes,
    mrr: alunosAtivos * mensalidade,
    alunosAtivos,
    inadimplenciaValor: inad.length * mensalidade,
    inadimplenciaAlunos: inad.length,
    faturamento,
    extrato,
  };
}

/** Cadastra um aluno na consultoria do consultor logado (RLS valida o tenant). */
export async function createAluno(input: {
  nome: string;
  email?: string;
  objetivo?: string;
  cpf?: string;
  telefone?: string;
}): Promise<Aluno> {
  const supabase = createClient();
  const consultoria_id = await getMyConsultoriaId();
  if (!consultoria_id) throw new Error("sem consultoria");
  // CPF sempre persistido só com dígitos (identidade global): evita que
  // "123.456.789-09" e "12345678909" burlem o índice único e a busca do admin.
  const cpfDigitos = (input.cpf ?? "").replace(/\D/g, "");
  const { data, error } = await supabase
    .from("alunos")
    .insert({
      consultoria_id,
      nome: input.nome,
      email: input.email || null,
      objetivo: input.objetivo || null,
      cpf: cpfDigitos || null,
      telefone: input.telefone || null,
      status_pagamento: "novo",
    })
    .select()
    .single();
  if (error) throw error;
  return mapAluno(data);
}

// ── Admin: vincular/trocar treinador de um aluno ───────────────────────────
// (funciona só com sessão de admin — a RLS is_admin() libera cross-tenant)

export type AdminAlunoResult = {
  id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  objetivo: string | null;
  consultoriaId: string | null;
  consultoriaNome: string | null;
};

export type AdminConsultoria = { id: string; nome: string };

/** Busca alunos por CPF (parcial) OU id exato. Admin enxerga todos (RLS). */
export async function adminFindAluno(q: string): Promise<AdminAlunoResult[]> {
  const supabase = createClient();
  const termo = q.trim();
  if (!termo) return [];
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(termo);
  let req = supabase
    .from("alunos")
    .select("id,nome,cpf,email,objetivo,consultoria_id,consultorias(nome,nome_negocio)");
  req = isUuid ? req.eq("id", termo) : req.ilike("cpf", `%${termo}%`);
  const { data, error } = await req.limit(20);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    nome: r.nome,
    cpf: r.cpf ?? null,
    email: r.email ?? null,
    objetivo: r.objetivo ?? null,
    consultoriaId: r.consultoria_id ?? null,
    consultoriaNome: r.consultorias?.nome_negocio ?? r.consultorias?.nome ?? null,
  }));
}

/** Lista as consultorias (treinadores) pra o admin escolher. */
export async function adminListConsultorias(): Promise<AdminConsultoria[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("consultorias")
    .select("id,nome,nome_negocio")
    .order("nome");
  if (error) throw error;
  return (data ?? []).map((c: any) => ({
    id: c.id,
    nome: c.nome_negocio || c.nome,
  }));
}

/**
 * Troca o treinador do aluno. Modelo membership: a RPC `trocar_consultor` fecha
 * o vínculo atual e abre um novo, PRESERVANDO o histórico (sem reescrever dados).
 * Fallback pré-migration: enquanto `schema_membership.sql` não rodou, faz o
 * UPDATE direto antigo (que após a migration falha — coluna read-only).
 */
export async function adminSetAlunoConsultoria(
  alunoId: string,
  consultoriaId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("trocar_consultor", {
    p_aluno: alunoId,
    p_nova_consultoria: consultoriaId,
  });
  if (!error) return;
  // PGRST202 = função inexistente (migration ainda não rodou) → fallback.
  const semRpc =
    (error as { code?: string }).code === "PGRST202" ||
    /trocar_consultor/i.test(error.message ?? "");
  if (!semRpc) throw error;
  const { error: e2 } = await supabase
    .from("alunos")
    .update({ consultoria_id: consultoriaId })
    .eq("id", alunoId);
  if (e2) throw e2;
}

// ── Vínculo (membership) aluno↔consultoria — pareia schema_membership.sql ────

export type Vinculo = {
  id: string;
  alunoId: string;
  consultoriaId: string;
  status: "ativa" | "encerrada" | "cancelada";
  inicio: string;
  fim: string | null;
  canceladoEm: string | null;
  motivoCancelamento: string | null;
};

function mapVinculo(r: any): Vinculo {
  return {
    id: r.id,
    alunoId: r.aluno_id,
    consultoriaId: r.consultoria_id,
    status: r.status,
    inicio: r.inicio ?? "",
    fim: r.fim ?? null,
    canceladoEm: r.cancelado_em ?? null,
    motivoCancelamento: r.motivo_cancelamento ?? null,
  };
}

/** Vínculo ativo do aluno (ou null). */
export async function fetchVinculoAtivo(alunoId: string): Promise<Vinculo | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("aluno_consultoria")
    .select("*")
    .eq("aluno_id", alunoId)
    .eq("status", "ativa")
    .maybeSingle();
  if (error) throw error;
  return data ? mapVinculo(data) : null;
}

/** Histórico de vínculos do aluno (RLS filtra o que o usuário pode ver). */
export async function fetchVinculosDoAluno(alunoId: string): Promise<Vinculo[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("aluno_consultoria")
    .select("*")
    .eq("aluno_id", alunoId)
    .order("inicio", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapVinculo);
}

/** (Re)abre um vínculo para um aluno existente (anti-takeover na RPC). */
export async function vincularAluno(alunoId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("vincular_aluno", { p_aluno: alunoId });
  if (error) throw error;
}

/** Cancela o acompanhamento (fim de ciclo: acesso até o vencimento; mantém conta). */
export async function cancelarVinculo(
  alunoId: string,
  motivo?: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("cancelar_vinculo", {
    p_aluno: alunoId,
    p_motivo: motivo ?? null,
  });
  if (error) throw error;
}

/** Lista os alunos da consultoria do usuário logado (RLS filtra o tenant). */
export async function fetchAlunos(): Promise<Aluno[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("alunos")
    .select("*")
    .order("nome");
  if (error) throw error;
  return (data ?? []).map(mapAluno);
}

/** Busca um aluno por id. */
export async function fetchAluno(id: string): Promise<Aluno | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("alunos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapAluno(data) : null;
}

// ── Planos (produtos do consultor) ────────────────────────────────────────────
// Espelha o tipo Plano do §4. Campos aninhados vêm em jsonb do banco. Campos
// derivados: `assinantesAtivos` (contagem de alunos no plano) e `linkPagamento`
// (gerado sob demanda por convite, fora daqui).

function mapPlano(r: any, assinantes = 0): Plano {
  return {
    id: r.id,
    nome: r.nome,
    descricao: r.descricao ?? "",
    imagemCapa: r.imagem_capa ?? undefined,
    tipoCobranca: (r.tipo_cobranca as TipoCobranca) ?? "recorrente",
    modalidade: r.modalidade ?? undefined,
    prazoEntrega: {
      valor: Number(r.prazo_valor ?? 0),
      unidade: r.prazo_unidade === "horas" ? "horas" : "dias_uteis",
    },
    incluso: (r.incluso as PlanoIncluso) ?? {
      treino: false,
      dieta: false,
      protocolos: false,
      checkin: false,
      chat: false,
    },
    preco: Number(r.preco ?? 0),
    periodoRecorrencia: r.periodo_recorrencia ?? undefined,
    formasPagamento: (r.formas_pagamento as FormaPagamento[]) ?? [],
    parcelamentoMax: r.parcelamento_max ?? undefined,
    solicitarDocumentos: !!r.solicitar_documentos,
    agendarCheckins: !!r.agendar_checkins,
    checkinConfig: (r.checkin_config as CheckinConfig) ?? undefined,
    upsell: r.upsell ?? undefined,
    visibilidade: r.visibilidade ?? { venda: true, vitrine: false, renovacao: true },
    checkoutCustom: r.checkout_custom ?? undefined,
    slug: r.slug ?? "",
    linkPagamento: "",
    status: (r.status as StatusPlano) ?? "ativo",
    assinantesAtivos: assinantes,
  };
}

/** Campos gravados de um plano (sem os derivados id/link/assinantes). */
export type PlanoInput = Omit<Plano, "id" | "linkPagamento" | "assinantesAtivos">;

/** Descarta os campos derivados de um Plano, deixando só o que é gravável. */
export function toPlanoInput(p: Plano): PlanoInput {
  return {
    nome: p.nome,
    descricao: p.descricao,
    imagemCapa: p.imagemCapa,
    tipoCobranca: p.tipoCobranca,
    modalidade: p.modalidade,
    prazoEntrega: p.prazoEntrega,
    incluso: p.incluso,
    preco: p.preco,
    periodoRecorrencia: p.periodoRecorrencia,
    formasPagamento: p.formasPagamento,
    parcelamentoMax: p.parcelamentoMax,
    solicitarDocumentos: p.solicitarDocumentos,
    agendarCheckins: p.agendarCheckins,
    checkinConfig: p.checkinConfig,
    upsell: p.upsell,
    visibilidade: p.visibilidade,
    checkoutCustom: p.checkoutCustom,
    slug: p.slug,
    status: p.status,
  };
}

function planoToRow(input: PlanoInput): Record<string, unknown> {
  return {
    nome: input.nome,
    descricao: input.descricao || null,
    imagem_capa: input.imagemCapa || null,
    tipo_cobranca: input.tipoCobranca,
    modalidade: input.modalidade || null,
    prazo_valor: input.prazoEntrega?.valor ?? null,
    prazo_unidade: input.prazoEntrega?.unidade ?? null,
    incluso: input.incluso,
    preco: input.preco,
    periodo_recorrencia:
      input.tipoCobranca === "recorrente" ? input.periodoRecorrencia ?? "mensal" : null,
    formas_pagamento: input.formasPagamento,
    parcelamento_max: input.tipoCobranca !== "recorrente" ? input.parcelamentoMax ?? null : null,
    solicitar_documentos: input.solicitarDocumentos,
    agendar_checkins: input.agendarCheckins,
    checkin_config: input.agendarCheckins ? input.checkinConfig ?? null : null,
    upsell: input.upsell ?? null,
    visibilidade: input.visibilidade,
    checkout_custom: input.checkoutCustom ?? null,
    slug: input.slug || null,
    status: input.status,
  };
}

/** Planos do consultor logado, com contagem de assinantes por plano. RLS filtra o tenant. */
export async function fetchPlanosConsultor(): Promise<Plano[]> {
  const supabase = createClient();
  const [planosRes, alunosRes] = await Promise.all([
    supabase.from("planos").select("*").order("created_at"),
    supabase.from("alunos").select("plano_id, status_pagamento"),
  ]);
  if (planosRes.error) throw planosRes.error;
  const counts = new Map<string, number>();
  for (const a of alunosRes.data ?? []) {
    // "Assinante" = aluno vinculado ao plano com pagamento não-encerrado.
    if (a.plano_id && ["em_dia", "pendente", "atrasado", "novo"].includes(a.status_pagamento)) {
      counts.set(a.plano_id, (counts.get(a.plano_id) ?? 0) + 1);
    }
  }
  return (planosRes.data ?? []).map((r) => mapPlano(r, counts.get(r.id) ?? 0));
}

/** Um plano por id (para o editor). RLS garante que é do tenant. */
export async function fetchPlanoById(id: string): Promise<Plano | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("planos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapPlano(data) : null;
}

/** Cria (id ausente) ou atualiza um plano. Retorna o plano salvo. */
export async function savePlano(input: PlanoInput, id?: string): Promise<Plano> {
  const supabase = createClient();
  const row = planoToRow(input);
  if (id) {
    const { data, error } = await supabase
      .from("planos")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return mapPlano(data);
  }
  const consultoria_id = await getMyConsultoriaId();
  if (!consultoria_id) throw new Error("sem consultoria");
  const { data, error } = await supabase
    .from("planos")
    .insert({ ...row, consultoria_id })
    .select()
    .single();
  if (error) throw error;
  return mapPlano(data);
}

/** Alterna ativo/pausado. */
export async function setPlanoStatus(id: string, status: StatusPlano): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("planos").update({ status }).eq("id", id);
  if (error) throw error;
}

/** Exclui um plano. */
export async function deletePlano(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("planos").delete().eq("id", id);
  if (error) throw error;
}

/** Busca o treino (com exercícios ordenados) de um aluno. */
export async function fetchTreinoByAluno(
  alunoId: string
): Promise<Treino | null> {
  const supabase = createClient();
  const { data: treino, error } = await supabase
    .from("treinos")
    .select("*")
    .eq("aluno_id", alunoId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!treino) return null;

  const { data: exs, error: exErr } = await supabase
    .from("exercicios")
    .select("*")
    .eq("treino_id", treino.id)
    .order("ordem");
  if (exErr) throw exErr;

  return {
    id: treino.id,
    alunoId: treino.aluno_id,
    nome: treino.nome,
    atualizadoEm: treino.updated_at,
    rascunho: !!treino.rascunho,
    exercicios: (exs ?? []).map(mapExercicio),
  };
}

/**
 * TODOS os treinos do aluno (o "split": Treino A, B, C…), ordenados por criação.
 * Uma query para os treinos + uma para os exercícios (agrupados por treino).
 */
export async function fetchTreinosByAluno(alunoId: string): Promise<Treino[]> {
  const supabase = createClient();
  const { data: treinos, error } = await supabase
    .from("treinos")
    .select("*")
    .eq("aluno_id", alunoId)
    .order("created_at");
  if (error) throw error;
  if (!treinos || treinos.length === 0) return [];

  const ids = treinos.map((t) => t.id);
  const { data: exs, error: exErr } = await supabase
    .from("exercicios")
    .select("*")
    .in("treino_id", ids)
    .order("ordem");
  if (exErr) throw exErr;

  const porTreino = new Map<string, Exercicio[]>();
  for (const e of exs ?? []) {
    const arr = porTreino.get(e.treino_id) ?? [];
    arr.push(mapExercicio(e));
    porTreino.set(e.treino_id, arr);
  }
  return treinos.map((t) => ({
    id: t.id,
    alunoId: t.aluno_id,
    nome: t.nome,
    atualizadoEm: t.updated_at,
    rascunho: !!t.rascunho,
    exercicios: porTreino.get(t.id) ?? [],
  }));
}

/** Busca um treino por id (com exercícios ordenados). */
export async function fetchTreinoById(treinoId: string): Promise<Treino | null> {
  const supabase = createClient();
  const { data: treino, error } = await supabase
    .from("treinos")
    .select("*")
    .eq("id", treinoId)
    .maybeSingle();
  if (error) throw error;
  if (!treino) return null;
  const { data: exs, error: exErr } = await supabase
    .from("exercicios")
    .select("*")
    .eq("treino_id", treino.id)
    .order("ordem");
  if (exErr) throw exErr;
  return {
    id: treino.id,
    alunoId: treino.aluno_id,
    nome: treino.nome,
    atualizadoEm: treino.updated_at,
    rascunho: !!treino.rascunho,
    exercicios: (exs ?? []).map(mapExercicio),
  };
}

/** Serializa o estado do construtor → colunas (ordem = índice do array). */
function exerciciosToRows(treinoId: string, exercicios: Exercicio[]) {
  return exercicios.map((ex, i) => ({
    treino_id: treinoId,
    ordem: i, // posição visual; ignora ex.ordem (defasado pós-reorder)
    nome: ex.nome,
    grupo: ex.grupo || null,
    series: ex.series ?? null,
    reps: ex.reps || null,
    descanso_seg: ex.descansoSeg ?? null,
    video_origem: ex.video?.origem ?? "vazio",
    video_url: ex.video?.url || null,
    observacoes: ex.observacoes || null,
    series_detalhe: ex.seriesDetalhe ?? [],
    // sem id (gen_random_uuid) e sem consultoria_id (trigger preenche)
  }));
}

/**
 * Salva o treino do aluno e SUBSTITUI seus exercícios. consultoria_id é setado
 * por trigger (não enviamos). Usa a RPC ATÔMICA `save_treino` (delete+insert na
 * mesma transação → rollback se algo falhar, sem risco de apagar o treino real
 * numa falha parcial). Fallback delete-then-insert quando a RPC não existe.
 */
export async function saveTreino(
  alunoId: string,
  treino: { id?: string; nome: string; rascunho?: boolean; exercicios: Exercicio[] }
): Promise<Treino> {
  const supabase = createClient();
  const nomeFinal = treino.nome?.trim() || "Novo treino";
  const p_exercicios = treino.exercicios.map((ex, i) => ({
    ordem: i,
    nome: ex.nome,
    grupo: ex.grupo || null,
    series: ex.series ?? null,
    reps: ex.reps || null,
    descanso_seg: ex.descansoSeg ?? null,
    video_origem: ex.video?.origem ?? "vazio",
    video_url: ex.video?.url || null,
    observacoes: ex.observacoes || null,
    series_detalhe: ex.seriesDetalhe ?? [],
  }));
  const { data: rpcId, error: rpcErr } = await supabase.rpc("save_treino", {
    p_aluno_id: alunoId,
    p_treino_id: treino.id ?? null,
    p_nome: nomeFinal,
    p_rascunho: treino.rascunho ?? false,
    p_exercicios,
  });
  if (!rpcErr) {
    const saved = await fetchTreinoById(rpcId as string);
    if (!saved) throw new Error("treino não encontrado após salvar");
    return saved;
  }
  if (!isMissingRpc(rpcErr, "save_treino")) throw rpcErr;
  return saveTreinoFallback(alunoId, treino);
}

/** Fallback delete-then-insert (pré-migration da RPC atômica). */
async function saveTreinoFallback(
  alunoId: string,
  treino: { id?: string; nome: string; rascunho?: boolean; exercicios: Exercicio[] }
): Promise<Treino> {
  const supabase = createClient();
  const nomeFinal = treino.nome?.trim() || "Novo treino";
  let treinoId: string;

  if (!treino.id) {
    const { data, error } = await supabase
      .from("treinos")
      .insert({ aluno_id: alunoId, nome: nomeFinal, rascunho: treino.rascunho ?? false })
      .select("id")
      .single();
    if (error) throw error;
    treinoId = data.id;
  } else {
    const { error } = await supabase
      .from("treinos")
      .update({ nome: nomeFinal, rascunho: treino.rascunho ?? false })
      .eq("id", treino.id);
    if (error) throw error;
    treinoId = treino.id;
  }

  const { error: delErr } = await supabase
    .from("exercicios")
    .delete()
    .eq("treino_id", treinoId);
  if (delErr) throw delErr;

  const rows = exerciciosToRows(treinoId, treino.exercicios);
  if (rows.length) {
    const { error: insErr } = await supabase.from("exercicios").insert(rows);
    if (insErr) throw insErr;
  }

  const saved = await fetchTreinoById(treinoId);
  if (!saved) throw new Error("treino não encontrado após salvar");
  return saved;
}

/** Exclui um treino (e seus exercícios). Usado quando o coach remove um treino do split. */
export async function deleteTreino(treinoId: string): Promise<void> {
  const supabase = createClient();
  // Remove os exercícios primeiro (caso não haja ON DELETE CASCADE) e o treino depois.
  await supabase.from("exercicios").delete().eq("treino_id", treinoId);
  const { error } = await supabase.from("treinos").delete().eq("id", treinoId);
  if (error) throw error;
}

/**
 * Salva o SPLIT inteiro do aluno: faz upsert de cada treino da lista e exclui os
 * treinos removidos no editor (`removidos`). Cada treino é salvo atomicamente
 * (RPC save_treino); as exclusões rodam antes.
 */
export async function saveTreinos(
  alunoId: string,
  treinos: { id?: string; nome: string; exercicios: Exercicio[] }[],
  removidos: string[] = []
): Promise<Treino[]> {
  for (const rid of removidos) await deleteTreino(rid);
  const out: Treino[] = [];
  for (const t of treinos) {
    out.push(
      await saveTreino(alunoId, {
        id: t.id,
        nome: t.nome,
        rascunho: false,
        exercicios: t.exercicios,
      })
    );
  }
  return out;
}

// ── Dieta ──────────────────────────────────────────────────────────────────
function mapAlimento(r: any): Alimento {
  return {
    id: r.id,
    nome: r.nome,
    quantidade: { valor: Number(r.qtd_valor ?? 0), unidade: r.qtd_unidade ?? "" },
    macros: {
      kcal: Number(r.kcal ?? 0),
      p: Number(r.p ?? 0),
      c: Number(r.c ?? 0),
      g: Number(r.g ?? 0),
    },
    substituicoes: Array.isArray(r.substituicoes) ? r.substituicoes : [],
    custom: r.custom || undefined,
    semMacros: r.sem_macros || undefined,
    observacoes: r.observacoes ?? undefined,
  };
}

function mapRefeicao(r: any, alimentos: any[]): Refeicao {
  return {
    id: r.id,
    ordem: r.ordem ?? 0,
    nome: r.nome,
    horario: r.horario ?? "",
    observacoes: r.observacoes ?? undefined,
    alimentos: alimentos.filter((a) => a.refeicao_id === r.id).map(mapAlimento),
  };
}

/** Dieta do aluno com refeições e alimentos ordenados. */
export async function fetchDietaByAluno(alunoId: string): Promise<Dieta | null> {
  const supabase = createClient();
  const { data: dieta, error } = await supabase
    .from("dietas")
    .select("*")
    .eq("aluno_id", alunoId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!dieta) return null;

  const { data: refs, error: rErr } = await supabase
    .from("refeicoes")
    .select("*")
    .eq("dieta_id", dieta.id)
    .order("ordem");
  if (rErr) throw rErr;

  const refIds = (refs ?? []).map((r) => r.id);
  let alimentos: any[] = [];
  if (refIds.length) {
    const { data: al, error: aErr } = await supabase
      .from("alimentos")
      .select("*")
      .in("refeicao_id", refIds)
      .order("ordem");
    if (aErr) throw aErr;
    alimentos = al ?? [];
  }

  return {
    id: dieta.id,
    alunoId: dieta.aluno_id,
    metaKcal: Number(dieta.meta_kcal ?? 0),
    rascunho: !!dieta.rascunho,
    refeicoes: (refs ?? []).map((r) => mapRefeicao(r, alimentos)),
  };
}

function alimentosToRows(refeicaoId: string, alimentos: Alimento[]) {
  return alimentos.map((a, i) => ({
    refeicao_id: refeicaoId,
    ordem: i,
    nome: a.nome,
    qtd_valor: a.quantidade?.valor ?? null,
    qtd_unidade: a.quantidade?.unidade || null,
    kcal: a.macros?.kcal ?? null,
    p: a.macros?.p ?? null,
    c: a.macros?.c ?? null,
    g: a.macros?.g ?? null,
    substituicoes: a.substituicoes ?? [],
    custom: a.custom ?? false,
    sem_macros: a.semMacros ?? false,
    observacoes: a.observacoes || null,
  }));
}

/**
 * Salva a dieta e SUBSTITUI refeições + alimentos. Usa a RPC ATÔMICA
 * `save_dieta` (tudo numa transação); fallback delete-then-insert quando a RPC
 * ainda não existe. O fallback tinha o risco de apagar a dieta real do aluno
 * numa falha entre o DELETE e os INSERTs.
 */
export async function saveDieta(
  alunoId: string,
  dieta: { id?: string; metaKcal: number; rascunho?: boolean; refeicoes: Refeicao[] }
): Promise<Dieta> {
  const supabase = createClient();
  const p_refeicoes = (dieta.refeicoes ?? []).map((r) => ({
    nome: r.nome,
    horario: r.horario || null,
    observacoes: r.observacoes || null,
    alimentos: (r.alimentos ?? []).map((a) => ({
      nome: a.nome,
      quantidade: { valor: a.quantidade?.valor ?? null, unidade: a.quantidade?.unidade || null },
      macros: { kcal: a.macros?.kcal ?? null, p: a.macros?.p ?? null, c: a.macros?.c ?? null, g: a.macros?.g ?? null },
      substituicoes: a.substituicoes ?? [],
      custom: a.custom ?? false,
      semMacros: a.semMacros ?? false,
      observacoes: a.observacoes || null,
    })),
  }));
  const { error: rpcErr } = await supabase.rpc("save_dieta", {
    p_aluno_id: alunoId,
    p_dieta_id: dieta.id ?? null,
    p_meta_kcal: dieta.metaKcal ?? 0,
    p_rascunho: dieta.rascunho ?? false,
    p_refeicoes,
  });
  if (!rpcErr) {
    const saved = await fetchDietaByAluno(alunoId);
    if (!saved) throw new Error("dieta não encontrada após salvar");
    return saved;
  }
  if (!isMissingRpc(rpcErr, "save_dieta")) throw rpcErr;
  return saveDietaFallback(alunoId, dieta);
}

/** Fallback delete-then-insert (pré-migration da RPC atômica). */
async function saveDietaFallback(
  alunoId: string,
  dieta: { id?: string; metaKcal: number; rascunho?: boolean; refeicoes: Refeicao[] }
): Promise<Dieta> {
  const supabase = createClient();
  let dietaId: string;

  if (!dieta.id) {
    const { data, error } = await supabase
      .from("dietas")
      .insert({ aluno_id: alunoId, meta_kcal: dieta.metaKcal ?? 0, rascunho: dieta.rascunho ?? false })
      .select("id")
      .single();
    if (error) throw error;
    dietaId = data.id;
  } else {
    const { error } = await supabase
      .from("dietas")
      .update({ meta_kcal: dieta.metaKcal ?? 0, rascunho: dieta.rascunho ?? false })
      .eq("id", dieta.id);
    if (error) throw error;
    dietaId = dieta.id;
  }

  const { error: delErr } = await supabase.from("refeicoes").delete().eq("dieta_id", dietaId);
  if (delErr) throw delErr;

  for (let i = 0; i < dieta.refeicoes.length; i++) {
    const r = dieta.refeicoes[i];
    const { data: ref, error: rErr } = await supabase
      .from("refeicoes")
      .insert({ dieta_id: dietaId, ordem: i, nome: r.nome, horario: r.horario || null, observacoes: r.observacoes || null })
      .select("id")
      .single();
    if (rErr) throw rErr;
    const rows = alimentosToRows(ref.id, r.alimentos ?? []);
    if (rows.length) {
      const { error: aErr } = await supabase.from("alimentos").insert(rows);
      if (aErr) throw aErr;
    }
  }

  const saved = await fetchDietaByAluno(alunoId);
  if (!saved) throw new Error("dieta não encontrada após salvar");
  return saved;
}

// ── Protocolo ──────────────────────────────────────────────────────────────
function mapItem(r: any): ProtocoloItem {
  return {
    id: r.id,
    ordem: r.ordem ?? 0,
    nome: r.nome,
    dose: r.dose ?? "",
    horario: r.horario ?? undefined,
    observacoes: r.observacoes ?? undefined,
    comoUsar: r.como_usar ?? undefined,
    comOQue: r.com_o_que ?? undefined,
    beneficio: r.beneficio ?? undefined,
    duracao: r.duracao ?? undefined,
  };
}

export async function fetchProtocoloByAluno(
  alunoId: string
): Promise<Protocolo | null> {
  const supabase = createClient();
  const { data: proto, error } = await supabase
    .from("protocolos")
    .select("*")
    .eq("aluno_id", alunoId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!proto) return null;

  const { data: blocos, error: bErr } = await supabase
    .from("protocolo_blocos")
    .select("*")
    .eq("protocolo_id", proto.id)
    .order("ordem");
  if (bErr) throw bErr;

  const blocoIds = (blocos ?? []).map((b) => b.id);
  let itens: any[] = [];
  if (blocoIds.length) {
    const { data: it, error: iErr } = await supabase
      .from("protocolo_itens")
      .select("*")
      .in("bloco_id", blocoIds)
      .order("ordem");
    if (iErr) throw iErr;
    itens = it ?? [];
  }

  return {
    id: proto.id,
    alunoId: proto.aluno_id,
    rascunho: !!proto.rascunho,
    blocos: (blocos ?? []).map(
      (b): ProtocoloBloco => ({
        id: b.id,
        ordem: b.ordem ?? 0,
        nome: b.nome,
        itens: itens.filter((x) => x.bloco_id === b.id).map(mapItem),
      })
    ),
  };
}

function itensToRows(blocoId: string, itens: ProtocoloItem[]) {
  return itens.map((it, i) => ({
    bloco_id: blocoId,
    ordem: i,
    nome: it.nome,
    dose: it.dose || null,
    horario: it.horario || null,
    observacoes: it.observacoes || null,
    como_usar: it.comoUsar || null,
    com_o_que: it.comOQue || null,
    beneficio: it.beneficio || null,
    duracao: it.duracao || null,
  }));
}

/**
 * Salva o protocolo e SUBSTITUI blocos/itens. Usa a RPC ATÔMICA `save_protocolo`
 * (transação única); fallback delete-then-insert quando a RPC não existe.
 */
export async function saveProtocolo(
  alunoId: string,
  proto: { id?: string; rascunho?: boolean; blocos: ProtocoloBloco[] }
): Promise<Protocolo> {
  const supabase = createClient();
  const p_blocos = (proto.blocos ?? []).map((b) => ({
    nome: b.nome,
    itens: (b.itens ?? []).map((it) => ({
      nome: it.nome,
      dose: it.dose || null,
      horario: it.horario || null,
      observacoes: it.observacoes || null,
      comoUsar: it.comoUsar || null,
      comOQue: it.comOQue || null,
      beneficio: it.beneficio || null,
      duracao: it.duracao || null,
    })),
  }));
  const { error: rpcErr } = await supabase.rpc("save_protocolo", {
    p_aluno_id: alunoId,
    p_protocolo_id: proto.id ?? null,
    p_rascunho: proto.rascunho ?? false,
    p_blocos,
  });
  if (!rpcErr) {
    const saved = await fetchProtocoloByAluno(alunoId);
    if (!saved) throw new Error("protocolo não encontrado após salvar");
    return saved;
  }
  if (!isMissingRpc(rpcErr, "save_protocolo")) throw rpcErr;
  return saveProtocoloFallback(alunoId, proto);
}

/** Fallback delete-then-insert (pré-migration da RPC atômica). */
async function saveProtocoloFallback(
  alunoId: string,
  proto: { id?: string; rascunho?: boolean; blocos: ProtocoloBloco[] }
): Promise<Protocolo> {
  const supabase = createClient();
  let protoId: string;

  if (!proto.id) {
    const { data, error } = await supabase
      .from("protocolos")
      .insert({ aluno_id: alunoId, rascunho: proto.rascunho ?? false })
      .select("id")
      .single();
    if (error) throw error;
    protoId = data.id;
  } else {
    const { error } = await supabase
      .from("protocolos")
      .update({ rascunho: proto.rascunho ?? false })
      .eq("id", proto.id);
    if (error) throw error;
    protoId = proto.id;
  }

  const { error: delErr } = await supabase
    .from("protocolo_blocos")
    .delete()
    .eq("protocolo_id", protoId);
  if (delErr) throw delErr;

  for (let i = 0; i < proto.blocos.length; i++) {
    const b = proto.blocos[i];
    const { data: bloco, error: bErr } = await supabase
      .from("protocolo_blocos")
      .insert({ protocolo_id: protoId, ordem: i, nome: b.nome })
      .select("id")
      .single();
    if (bErr) throw bErr;
    const rows = itensToRows(bloco.id, b.itens ?? []);
    if (rows.length) {
      const { error: iErr } = await supabase.from("protocolo_itens").insert(rows);
      if (iErr) throw iErr;
    }
  }

  const saved = await fetchProtocoloByAluno(alunoId);
  if (!saved) throw new Error("protocolo não encontrado após salvar");
  return saved;
}

// ── Check-in ─────────────────────────────────────────────────────────────────
function mapCheckin(r: any): CheckIn {
  const fotos = Array.isArray(r.fotos) ? (r.fotos as FotoCheckin[]) : [];
  return {
    id: r.id,
    alunoId: r.aluno_id,
    semana: r.semana ?? 0,
    // enviado_em é timestamptz; converte pro dia LOCAL (não trunca em UTC).
    enviadoEm: dataLocalYMD(r.enviado_em ?? r.created_at),
    // peso é opcional no envio; null → undefined (não coagir para 0 kg).
    peso: r.peso == null ? undefined : Number(r.peso),
    fotos,
    // fotos_count vem das listagens leves (sem baixar o payload das fotos).
    fotosCount: r.fotos_count ?? fotos.length,
    avaliacoes: {
      energia: r.energia ?? 0,
      sono: r.sono ?? 0,
      dieta: r.dieta ?? 0,
    },
    treinosFeitos: r.treinos_feitos ?? 0,
    treinosTotais: r.treinos_totais ?? 0,
    comentario: r.comentario ?? "",
    respostaCoach: r.resposta_coach ?? undefined,
    status: r.status === "respondido" ? "respondido" : "pendente",
  };
}

// Colunas de listagem SEM o payload das fotos (só a contagem via fotos_count).
// Histórico e home só precisam de metadados — baixar `fotos` (data URLs de
// vários MB) em toda leitura é a maior fonte de custo do check-in.
const CHECKIN_COLS_LEVES =
  "id,aluno_id,semana,enviado_em,created_at,peso,fotos_count,energia,sono,dieta,treinos_feitos,treinos_totais,comentario,resposta_coach,status";

/**
 * Check-ins de um aluno, ordenados por semana (mais antiga primeiro).
 * Por padrão NÃO baixa as fotos (só `fotos_count`); passe `comFotos` para as
 * telas que exibem as imagens (ex.: revisão do check-in com comparação).
 */
export async function fetchCheckinsByAluno(
  alunoId: string,
  comFotos = false
): Promise<CheckIn[]> {
  const supabase = createClient();
  const run = (cols: string) =>
    supabase.from("checkins").select(cols).eq("aluno_id", alunoId).order("semana");

  let { data, error } = await run(comFotos ? "*" : CHECKIN_COLS_LEVES);
  // Tolera banco sem a coluna gerada `fotos_count` (schema_checkin.sql antigo):
  // refaz baixando `fotos` e deriva a contagem em mapCheckin. Rode a migration
  // schema_checkin.sql para voltar ao caminho leve (sem baixar as imagens).
  if (
    error &&
    !comFotos &&
    (error.code === "42703" || /fotos_count/.test(error.message ?? ""))
  ) {
    ({ data, error } = await run(CHECKIN_COLS_LEVES.replace("fotos_count", "fotos")));
  }
  if (error) throw error;
  return (data ?? []).map(mapCheckin);
}

/** Busca um check-in específico (aluno + semana). */
export async function fetchCheckinBySemana(
  alunoId: string,
  semana: number
): Promise<CheckIn | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("checkins")
    .select("*")
    .eq("aluno_id", alunoId)
    .eq("semana", semana)
    .maybeSingle();
  if (error) throw error;
  return data ? mapCheckin(data) : null;
}

export type NovoCheckinInput = {
  semana?: number; // se ausente, = última semana + 1
  peso?: number;
  fotos?: FotoCheckin[];
  energia: number;
  sono: number;
  dieta: number;
  treinosFeitos: number;
  treinosTotais: number;
  comentario?: string;
};

/**
 * Envia o check-in da semana (lado do ALUNO). consultoria_id vem por trigger.
 * Se `semana` não for informado, usa a próxima após o último check-in do aluno.
 */
export async function saveCheckin(
  alunoId: string,
  input: NovoCheckinInput
): Promise<CheckIn> {
  const supabase = createClient();
  let semana = input.semana;
  if (!semana) {
    const existentes = await fetchCheckinsByAluno(alunoId);
    semana = existentes.length
      ? Math.max(...existentes.map((c) => c.semana)) + 1
      : 1;
  }
  const { data, error } = await supabase
    .from("checkins")
    .insert({
      aluno_id: alunoId,
      semana,
      peso: input.peso ?? null,
      fotos: input.fotos ?? [],
      energia: input.energia,
      sono: input.sono,
      dieta: input.dieta,
      treinos_feitos: input.treinosFeitos,
      treinos_totais: input.treinosTotais,
      comentario: input.comentario || null,
      status: "pendente",
    })
    .select()
    .single();
  if (error) throw error;
  return mapCheckin(data);
}

/** Consultor responde ao check-in (UPDATE de resposta + status). */
export async function responderCheckin(
  checkinId: string,
  resposta: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("checkins")
    .update({ resposta_coach: resposta, status: "respondido" })
    .eq("id", checkinId);
  if (error) throw error;
}

/** aluno_id do usuário logado (quando o perfil é do tipo aluno). */
export async function getMyAlunoId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // Propaga o erro: engolir aqui faz um aluno REAL cair no modo protótipo (Ana)
  // e enviar o check-in para o localStorage em vez do banco. `null` deve
  // significar "não é aluno", nunca "a consulta falhou".
  const { data, error } = await supabase
    .from("profiles")
    .select("aluno_id")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.aluno_id ?? null;
}

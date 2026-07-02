/**
 * Acesso a dados via Supabase (usado quando `supabaseEnabled`). Mapeia as
 * colunas snake_case do banco para os tipos camelCase do app, então as telas
 * não mudam de forma. Enquanto o Supabase não está configurado, as telas usam
 * os acessores mock de `data.ts`.
 */
import { createClient } from "@/utils/supabase/client";
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
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

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
  const { data } = await supabase
    .from("profiles")
    .select("consultoria_id")
    .eq("id", user.id)
    .maybeSingle();
  return data?.consultoria_id ?? null;
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
  const { data, error } = await supabase
    .from("alunos")
    .insert({
      consultoria_id,
      nome: input.nome,
      email: input.email || null,
      objetivo: input.objetivo || null,
      cpf: input.cpf || null,
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
 * por trigger (não enviamos). Estratégia delete-then-insert (protótipo); a
 * versão atômica via RPC está em supabase/save_treino.sql.
 */
export async function saveTreino(
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
 * Salva a dieta e SUBSTITUI refeições + alimentos (replace de 2 níveis via
 * cascata). consultoria_id via trigger. delete-then-insert (RPC atômica
 * opcional em supabase/save_dieta.sql).
 */
export async function saveDieta(
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

export async function saveProtocolo(
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
  return {
    id: r.id,
    alunoId: r.aluno_id,
    semana: r.semana ?? 0,
    // enviado_em é timestamptz; o app exibe data-only (YYYY-MM-DD).
    enviadoEm: String(r.enviado_em ?? r.created_at ?? "").slice(0, 10),
    peso: Number(r.peso ?? 0),
    fotos: Array.isArray(r.fotos) ? (r.fotos as FotoCheckin[]) : [],
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

/** Check-ins de um aluno, ordenados por semana (mais antiga primeiro). */
export async function fetchCheckinsByAluno(alunoId: string): Promise<CheckIn[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("checkins")
    .select("*")
    .eq("aluno_id", alunoId)
    .order("semana");
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
  const { data } = await supabase
    .from("profiles")
    .select("aluno_id")
    .eq("id", user.id)
    .maybeSingle();
  return data?.aluno_id ?? null;
}

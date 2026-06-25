/**
 * Acesso a dados via Supabase (usado quando `supabaseEnabled`). Mapeia as
 * colunas snake_case do banco para os tipos camelCase do app, então as telas
 * não mudam de forma. Enquanto o Supabase não está configurado, as telas usam
 * os acessores mock de `data.ts`.
 */
import { createClient } from "@/utils/supabase/client";
import type { Aluno, Treino, Exercicio } from "./types";

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
  };
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
      status_pagamento: "novo",
    })
    .select()
    .single();
  if (error) throw error;
  return mapAluno(data);
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

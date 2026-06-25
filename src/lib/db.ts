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

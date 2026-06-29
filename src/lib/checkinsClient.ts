"use client";

import type { CheckIn, FotoCheckin } from "./types";
import { getCheckins } from "./data";
import {
  fetchCheckinsByAluno,
  saveCheckin,
  responderCheckin,
  type NovoCheckinInput,
} from "./db";
import {
  mergeCheckins,
  addLocalCheckin,
  responderLocalCheckin,
} from "./localCheckins";
import { supabaseEnabled } from "./supabaseEnabled";

export type Modo = "real" | "proto";

/** Lê os check-ins de um aluno na fonte certa para o modo. */
export async function resolveCheckins(
  alunoId: string,
  modo: Modo
): Promise<CheckIn[]> {
  if (modo === "real" && supabaseEnabled) {
    return fetchCheckinsByAluno(alunoId);
  }
  return mergeCheckins(getCheckins(alunoId), alunoId);
}

export type EnviarCheckinInput = {
  peso?: number;
  fotos?: FotoCheckin[];
  energia: number;
  sono: number;
  dieta: number;
  treinosFeitos: number;
  treinosTotais: number;
  comentario?: string;
};

/** Envia o check-in da semana atual no modo certo. Retorna o check-in salvo. */
export async function enviarCheckin(
  alunoId: string,
  modo: Modo,
  semanaAtual: number,
  input: EnviarCheckinInput
): Promise<CheckIn> {
  if (modo === "real" && supabaseEnabled) {
    const payload: NovoCheckinInput = { semana: semanaAtual, ...input };
    return saveCheckin(alunoId, payload);
  }
  return addLocalCheckin(alunoId, { semana: semanaAtual, ...input });
}

/** Consultor responde ao check-in no modo certo. */
export async function responder(
  checkin: CheckIn,
  modo: Modo,
  resposta: string
): Promise<void> {
  if (modo === "real" && supabaseEnabled) {
    await responderCheckin(checkin.id, resposta);
    return;
  }
  responderLocalCheckin(checkin.id, resposta);
}

// ── Lado do CONSULTOR (lê check-ins de qualquer aluno) ──────────────────────

/**
 * Resolve os check-ins de um aluno para as telas do consultor. Para alunos
 * reais (com linhas no banco) usa o Supabase; para alunos de exemplo (seed) ou
 * submissões de protótipo, usa mock + localStorage. `fromDb` indica a fonte
 * (necessário para responder no lugar certo).
 */
export async function resolveCheckinsConsultor(
  alunoId: string
): Promise<{ checkins: CheckIn[]; fromDb: boolean }> {
  if (supabaseEnabled) {
    try {
      const db = await fetchCheckinsByAluno(alunoId);
      if (db.length) return { checkins: db, fromDb: true };
    } catch {
      /* cai no mock/local */
    }
  }
  return {
    checkins: mergeCheckins(getCheckins(alunoId), alunoId),
    fromDb: false,
  };
}

/** Consultor responde, persistindo na fonte de onde veio o check-in. */
export async function responderConsultor(
  checkin: CheckIn,
  fromDb: boolean,
  resposta: string
): Promise<void> {
  if (fromDb && supabaseEnabled) {
    await responderCheckin(checkin.id, resposta);
    return;
  }
  responderLocalCheckin(checkin.id, resposta);
}

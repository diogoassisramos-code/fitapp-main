// ============================================================
// CoachFit — Check-ins de PROTÓTIPO (sem backend / sem login de aluno).
// Persistidos no localStorage. Servem para demonstrar o fluxo ponta a ponta
// (aluno envia → consultor recebe/responde) enquanto o login real do aluno não
// existe. Quando há sessão real de aluno, o app usa `saveCheckin` (Supabase).
//
// Guarda DUAS coisas:
//   1. submissões novas do aluno (lista de CheckIn).
//   2. respostas do coach a check-ins de SEED (mock) — overrides por id.
//
// Escrita só em event handlers (client). Leitura via useEffect/no cliente.
// ============================================================
import type { CheckIn, FotoCheckin } from "./types";

const KEY_ENVIOS = "coachfit:checkins";
const KEY_RESPOSTAS = "coachfit:checkin-respostas";

type RespostaOverride = { resposta: string };

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** Todas as submissões locais (de todos os alunos de protótipo). */
function allEnvios(): CheckIn[] {
  return read<CheckIn[]>(KEY_ENVIOS, []);
}

/** Mapa { checkinId: { resposta } } com respostas a check-ins de seed. */
function allRespostas(): Record<string, RespostaOverride> {
  return read<Record<string, RespostaOverride>>(KEY_RESPOSTAS, {});
}

/** Submissões locais de um aluno, ordenadas por semana. */
export function getLocalCheckins(alunoId: string): CheckIn[] {
  return allEnvios()
    .filter((c) => c.alunoId === alunoId)
    .sort((a, b) => a.semana - b.semana);
}

export type NovoCheckinLocal = {
  semana: number;
  peso?: number;
  fotos?: FotoCheckin[];
  energia: number;
  sono: number;
  dieta: number;
  treinosFeitos: number;
  treinosTotais: number;
  comentario?: string;
};

/** Cria uma submissão local de check-in. Chamar só em event handlers. */
export function addLocalCheckin(
  alunoId: string,
  input: NovoCheckinLocal
): CheckIn {
  const checkin: CheckIn = {
    id: `local-${alunoId}-s${input.semana}-${Date.now()}`,
    alunoId,
    semana: input.semana,
    // data-only (YYYY-MM-DD) para casar com o formatador dataLonga.
    enviadoEm: new Date().toISOString().slice(0, 10),
    peso: input.peso ?? 0,
    fotos: input.fotos ?? [],
    avaliacoes: {
      energia: input.energia,
      sono: input.sono,
      dieta: input.dieta,
    },
    treinosFeitos: input.treinosFeitos,
    treinosTotais: input.treinosTotais,
    comentario: input.comentario ?? "",
    status: "pendente",
  };
  // remove qualquer submissão anterior da MESMA semana (reenvio sobrescreve).
  const restante = allEnvios().filter(
    (c) => !(c.alunoId === alunoId && c.semana === input.semana)
  );
  write(KEY_ENVIOS, [...restante, checkin]);
  return checkin;
}

/**
 * Registra a resposta do coach a um check-in. Se for uma submissão local,
 * atualiza-a in place; senão guarda como override (para check-ins de seed).
 */
export function responderLocalCheckin(checkinId: string, resposta: string): void {
  const envios = allEnvios();
  const idx = envios.findIndex((c) => c.id === checkinId);
  if (idx >= 0) {
    envios[idx] = { ...envios[idx], respostaCoach: resposta, status: "respondido" };
    write(KEY_ENVIOS, envios);
    return;
  }
  const respostas = allRespostas();
  respostas[checkinId] = { resposta };
  write(KEY_RESPOSTAS, respostas);
}

/** Aplica a um check-in (de seed) a resposta override, se houver. */
export function aplicarResposta(checkin: CheckIn): CheckIn {
  const ov = allRespostas()[checkin.id];
  if (!ov) return checkin;
  return { ...checkin, respostaCoach: ov.resposta, status: "respondido" };
}

/**
 * Mescla os check-ins de seed (mock) de um aluno com as submissões locais e
 * aplica respostas-override. Usado pelas telas do consultor no modo protótipo.
 */
export function mergeCheckins(seed: CheckIn[], alunoId: string): CheckIn[] {
  const locais = getLocalCheckins(alunoId);
  const seedAplicado = seed.map(aplicarResposta);
  // submissão local da mesma semana tem prioridade sobre o seed.
  const semanasLocais = new Set(locais.map((c) => c.semana));
  const seedFiltrado = seedAplicado.filter((c) => !semanasLocais.has(c.semana));
  return [...seedFiltrado, ...locais].sort((a, b) => a.semana - b.semana);
}

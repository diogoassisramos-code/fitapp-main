// ============================================================================
// Planos SaaS da plataforma — FONTE ÚNICA = tabela `planos_plataforma`.
//
// Quem consome: /cadastro (vitrine + escolha), /api/asaas/assinatura-consultor
// (valor cobrado — nunca vem do cliente), /api/convites (limite de alunos) e o
// painel admin (/admin/planos edita; salvar preço propaga às assinaturas).
// Sem Supabase (protótipo) ou se a leitura falhar, cai no FALLBACK abaixo.
// ============================================================================
import type { SupabaseClient } from "@supabase/supabase-js";

export type PlanoSaaS = {
  slug: string;
  nome: string;
  descricao: string;
  /** Preço mensal (R$). 0 = gratuito. */
  preco: number;
  /** 0 = ilimitado. */
  limiteAlunos: number;
  recursos: string[];
  destaque: boolean;
  status: "ativo" | "arquivado";
  ordem: number;
};

/** Espelho dos 3 planos iniciais (mesmos slugs do seed de planos_plataforma). */
export const PLANOS_FALLBACK: PlanoSaaS[] = [
  {
    slug: "free",
    nome: "Gratuito",
    descricao: "",
    preco: 0,
    limiteAlunos: 10,
    recursos: [
      "Treino, dieta e protocolo",
      "Recebimento de check-in",
      "Recebimento pela plataforma (cartão recorrente do aluno)",
    ],
    destaque: false,
    status: "ativo",
    ordem: 0,
  },
  {
    slug: "pro",
    nome: "Revo Pro",
    descricao: "",
    preco: 60,
    limiteAlunos: 150,
    recursos: [
      "Tudo do Gratuito",
      "Recebimento pela plataforma (cartão recorrente do aluno)",
      "Suporte exclusivo com o time",
    ],
    destaque: true,
    status: "ativo",
    ordem: 1,
  },
  {
    slug: "avancado",
    nome: "Revo Pro Max",
    descricao: "",
    preco: 120,
    limiteAlunos: 0,
    recursos: [
      "Tudo do Revo Pro",
      "Recebimento pela plataforma (cartão recorrente do aluno)",
      "Suporte exclusivo 24 horas",
    ],
    destaque: false,
    status: "ativo",
    ordem: 2,
  },
];

/** Linha do banco → PlanoSaaS. Recursos vazios herdam os do fallback (mesmo slug). */
export function mapPlanoRow(p: Record<string, unknown>): PlanoSaaS {
  const slug = String(p.slug ?? "");
  const fb = PLANOS_FALLBACK.find((f) => f.slug === slug);
  const recursos = Array.isArray(p.recursos) ? (p.recursos as string[]).filter(Boolean) : [];
  return {
    slug,
    nome: String(p.nome ?? fb?.nome ?? slug),
    descricao: String(p.descricao ?? ""),
    preco: Number(p.preco ?? 0),
    limiteAlunos: Number(p.limite_alunos ?? 0),
    recursos: recursos.length > 0 ? recursos : fb?.recursos ?? [],
    destaque: !!p.destaque,
    status: p.status === "arquivado" ? "arquivado" : "ativo",
    ordem: Number(p.ordem ?? 0),
  };
}

/**
 * Lê os planos da tabela com o client informado (browser anon, server ou admin —
 * a tabela tem SELECT público). Em erro/vazio devolve o fallback.
 */
export async function fetchPlanosSaaS(supabase: SupabaseClient): Promise<PlanoSaaS[]> {
  try {
    const { data, error } = await supabase.from("planos_plataforma").select("*").order("ordem");
    if (error || !data || data.length === 0) return PLANOS_FALLBACK;
    return data.map(mapPlanoRow);
  } catch {
    return PLANOS_FALLBACK;
  }
}

/** Plano por slug (do banco, senão do fallback). `null` se não existir em nenhum. */
export async function fetchPlanoSaaS(
  supabase: SupabaseClient,
  slug: string
): Promise<PlanoSaaS | null> {
  const todos = await fetchPlanosSaaS(supabase);
  return todos.find((p) => p.slug === slug) ?? PLANOS_FALLBACK.find((p) => p.slug === slug) ?? null;
}

/** Texto do limite pra vitrine. */
export function limiteLabel(limiteAlunos: number): string {
  return limiteAlunos > 0 ? `Até ${limiteAlunos} alunos` : "Alunos ilimitados";
}

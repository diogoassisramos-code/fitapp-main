// ============================================================================
// Camada de dados REAL do painel admin (persona super-admin). Lê/escreve via a
// sessão do admin no browser — a RLS `is_admin()` libera CRUD cross-tenant em
// consultorias/alunos/planos/planos_plataforma. Substitui o mock `@/lib/admin`.
//
// Os tipos espelham os shapes do mock para as telas mudarem só a FONTE (de
// acessor síncrono para fetch assíncrono), não a forma.
// ============================================================================
import { createClient } from "@/utils/supabase/client";
import { dataLocalYMD } from "./format";
import type { StatusConsultoria } from "./admin";

/* eslint-disable @typescript-eslint/no-explicit-any */

const ymd = (v: any): string => (v ? dataLocalYMD(v) : "");

// ── Tipos (espelham @/lib/admin) ─────────────────────────────────────────────
export type AdminConsultoria = {
  id: string;
  consultor: string;
  nomeNegocio: string;
  email: string;
  telefone: string;
  conselho: string;
  cidade: string;
  planoSlug: string; // free | pro | avancado
  status: StatusConsultoria;
  alunosAtivos: number;
  mrr: number;
  faturamentoMensal: number; // GMV do mês
  criadoEm: string;
};

export type AdminAluno = {
  id: string;
  nome: string;
  consultoriaId: string;
  consultor: string;
  objetivo: string;
  status: "ativo" | "inativo";
  desde: string;
  email: string;
  cpf: string;
  telefone: string;
  statusPagamento: string;
};

export type AdminProduto = {
  id: string;
  consultoriaId: string;
  nome: string;
  preco: number;
  tipoCobranca: string;
  periodoRecorrencia?: string;
  status: "ativo" | "pausado";
  assinantes: number;
};

export type PlanoPlataforma = {
  id: string;
  slug: string;
  nome: string;
  descricao: string;
  preco: number;
  limiteAlunos: number;
  recursos: string[];
  destaque: boolean;
  status: "ativo" | "arquivado";
  ordem: number;
  assinantes: number; // derivado (consultorias no tier)
};

export type AdminAssinatura = {
  id: string; // = consultoriaId
  consultoriaId: string;
  nomeNegocio: string;
  consultor: string;
  planoSlug: string;
  status: StatusConsultoria;
  valor: number;
  metodo: string;
  proximaCobranca: string;
  asaasSubscriptionId: string | null;
  criadoEm: string;
};

export type AdminStats = {
  totalConsultorias: number;
  consultoriasAtivas: number;
  totalAlunos: number;
  mrrPlataforma: number;
  volumeProcessadoMes: number;
  novasConsultoriasMes: number;
  inadimplentes: number;
};

// plano_status do banco → StatusConsultoria da UI.
function statusDe(planoStatus?: string): StatusConsultoria {
  switch (planoStatus) {
    case "ativo":
      return "ativo";
    case "trial":
      return "trial";
    case "inadimplente":
      return "inadimplente";
    case "cancelado":
      return "cancelado";
    default:
      return "trial";
  }
}

const STATUS_ATIVO = ["em_dia", "pendente", "atrasado"]; // aluno "ativo" (não 'novo')
const PAGO = ["CONFIRMED", "RECEIVED", "confirmado", "recebido"];

/**
 * Junta consultorias + consultor (profiles) + contagem de alunos + preço do tier
 * + GMV do mês (pagamentos). Uma leitura por tabela; agrega em memória. RLS admin
 * enxerga tudo.
 */
export async function adminFetchConsultorias(): Promise<AdminConsultoria[]> {
  const supabase = createClient();
  const [consRes, profRes, alunosRes, planosRes, pagRes] = await Promise.all([
    supabase.from("consultorias").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("consultoria_id, nome, email").eq("role", "consultor"),
    supabase.from("alunos").select("consultoria_id, status_pagamento"),
    supabase.from("planos_plataforma").select("slug, preco"),
    supabase.from("pagamentos").select("consultoria_id, valor, status, fluxo, confirmado_em, recebido_em, criado_em"),
  ]);
  if (consRes.error) throw consRes.error;

  const consultorPorTenant = new Map<string, { nome: string; email: string }>();
  for (const p of profRes.data ?? []) {
    if (p.consultoria_id && !consultorPorTenant.has(p.consultoria_id)) {
      consultorPorTenant.set(p.consultoria_id, { nome: p.nome ?? "", email: p.email ?? "" });
    }
  }

  const alunosCount = new Map<string, number>();
  for (const a of alunosRes.data ?? []) {
    if (a.consultoria_id && STATUS_ATIVO.includes(a.status_pagamento)) {
      alunosCount.set(a.consultoria_id, (alunosCount.get(a.consultoria_id) ?? 0) + 1);
    }
  }

  const precoTier = new Map<string, number>();
  for (const p of planosRes.data ?? []) precoTier.set(p.slug, Number(p.preco ?? 0));

  // GMV do mês por consultoria (mensalidades pagas no mês corrente).
  const mesAtual = dataLocalYMD(new Date()).slice(0, 7);
  const gmv = new Map<string, number>();
  for (const p of pagRes.data ?? []) {
    if (p.fluxo !== "mensalidade" || !p.consultoria_id) continue;
    if (!PAGO.includes(String(p.status))) continue;
    const quando = ymd(p.recebido_em ?? p.confirmado_em ?? p.criado_em).slice(0, 7);
    if (quando !== mesAtual) continue;
    gmv.set(p.consultoria_id, (gmv.get(p.consultoria_id) ?? 0) + Number(p.valor ?? 0));
  }

  return (consRes.data ?? []).map((c: any): AdminConsultoria => {
    const consultor = consultorPorTenant.get(c.id);
    const status = statusDe(c.plano_status);
    const mrr =
      status === "ativo" || status === "trial" ? precoTier.get(c.plano ?? "free") ?? 0 : 0;
    const conselho =
      c.conselho_tipo && c.conselho_numero ? `${c.conselho_tipo} ${c.conselho_numero}` : "";
    return {
      id: c.id,
      consultor: consultor?.nome || c.nome || "—",
      nomeNegocio: c.nome_negocio || c.nome || "—",
      email: consultor?.email || "",
      telefone: c.telefone ?? "",
      conselho,
      cidade: "",
      planoSlug: c.plano ?? "free",
      status,
      alunosAtivos: alunosCount.get(c.id) ?? 0,
      mrr,
      faturamentoMensal: gmv.get(c.id) ?? 0,
      criadoEm: ymd(c.created_at),
    };
  });
}

export async function adminFetchConsultoria(id: string): Promise<AdminConsultoria | null> {
  const todas = await adminFetchConsultorias();
  return todas.find((c) => c.id === id) ?? null;
}

/** Alunos de todas as consultorias (ou de uma), com nome do consultor. */
export async function adminFetchAlunos(consultoriaId?: string): Promise<AdminAluno[]> {
  const supabase = createClient();
  let q = supabase
    .from("alunos")
    .select("id, nome, consultoria_id, objetivo, status_pagamento, inicio, email, cpf, telefone")
    .order("nome");
  if (consultoriaId) q = q.eq("consultoria_id", consultoriaId);
  const [alunosRes, profRes] = await Promise.all([
    q,
    supabase.from("profiles").select("consultoria_id, nome").eq("role", "consultor"),
  ]);
  if (alunosRes.error) throw alunosRes.error;

  const consultorPorTenant = new Map<string, string>();
  for (const p of profRes.data ?? []) {
    if (p.consultoria_id && !consultorPorTenant.has(p.consultoria_id)) {
      consultorPorTenant.set(p.consultoria_id, p.nome ?? "");
    }
  }

  return (alunosRes.data ?? []).map((a: any): AdminAluno => ({
    id: a.id,
    nome: a.nome,
    consultoriaId: a.consultoria_id ?? "",
    consultor: consultorPorTenant.get(a.consultoria_id) ?? "",
    objetivo: a.objetivo ?? "",
    status: a.status_pagamento === "novo" ? "inativo" : "ativo",
    desde: ymd(a.inicio),
    email: a.email ?? "",
    cpf: a.cpf ?? "",
    telefone: a.telefone ?? "",
    statusPagamento: a.status_pagamento ?? "novo",
  }));
}

export async function adminFetchAluno(id: string): Promise<AdminAluno | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("alunos")
    .select("id, nome, consultoria_id, objetivo, status_pagamento, inicio, email, cpf, telefone")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  let consultor = "";
  if (data.consultoria_id) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("nome")
      .eq("role", "consultor")
      .eq("consultoria_id", data.consultoria_id)
      .maybeSingle();
    consultor = prof?.nome ?? "";
  }
  return {
    id: data.id,
    nome: data.nome,
    consultoriaId: data.consultoria_id ?? "",
    consultor,
    objetivo: data.objetivo ?? "",
    status: data.status_pagamento === "novo" ? "inativo" : "ativo",
    desde: ymd(data.inicio),
    email: data.email ?? "",
    cpf: data.cpf ?? "",
    telefone: data.telefone ?? "",
    statusPagamento: data.status_pagamento ?? "novo",
  };
}

/** Produtos (planos) de uma consultoria, com contagem de assinantes. */
export async function adminFetchProdutos(consultoriaId: string): Promise<AdminProduto[]> {
  const supabase = createClient();
  const [planosRes, alunosRes] = await Promise.all([
    supabase.from("planos").select("*").eq("consultoria_id", consultoriaId).order("created_at"),
    supabase.from("alunos").select("plano_id, status_pagamento").eq("consultoria_id", consultoriaId),
  ]);
  if (planosRes.error) throw planosRes.error;
  const counts = new Map<string, number>();
  for (const a of alunosRes.data ?? []) {
    if (a.plano_id && STATUS_ATIVO.concat("novo").includes(a.status_pagamento)) {
      counts.set(a.plano_id, (counts.get(a.plano_id) ?? 0) + 1);
    }
  }
  return (planosRes.data ?? []).map((p: any): AdminProduto => ({
    id: p.id,
    consultoriaId: p.consultoria_id,
    nome: p.nome,
    preco: Number(p.preco ?? 0),
    tipoCobranca: p.tipo_cobranca ?? "recorrente",
    periodoRecorrencia: p.periodo_recorrencia ?? undefined,
    status: p.status === "pausado" ? "pausado" : "ativo",
    assinantes: counts.get(p.id) ?? 0,
  }));
}

/** Assinaturas SaaS (consultorias que pagam a plataforma). */
export async function adminFetchAssinaturas(): Promise<AdminAssinatura[]> {
  const supabase = createClient();
  const [consRes, profRes, planosRes] = await Promise.all([
    supabase.from("consultorias").select("id, nome, nome_negocio, plano, plano_status, created_at, asaas_subscription_id").order("created_at", { ascending: false }),
    supabase.from("profiles").select("consultoria_id, nome").eq("role", "consultor"),
    supabase.from("planos_plataforma").select("slug, preco"),
  ]);
  if (consRes.error) throw consRes.error;
  const consultorPorTenant = new Map<string, string>();
  for (const p of profRes.data ?? []) {
    if (p.consultoria_id && !consultorPorTenant.has(p.consultoria_id)) {
      consultorPorTenant.set(p.consultoria_id, p.nome ?? "");
    }
  }
  const precoTier = new Map<string, number>();
  for (const p of planosRes.data ?? []) precoTier.set(p.slug, Number(p.preco ?? 0));

  return (consRes.data ?? []).map((c: any): AdminAssinatura => ({
    id: c.id,
    consultoriaId: c.id,
    nomeNegocio: c.nome_negocio || c.nome || "—",
    consultor: consultorPorTenant.get(c.id) ?? "",
    planoSlug: c.plano ?? "free",
    status: statusDe(c.plano_status),
    valor: precoTier.get(c.plano ?? "free") ?? 0,
    metodo: c.asaas_subscription_id ? "Asaas" : "—",
    proximaCobranca: "",
    asaasSubscriptionId: c.asaas_subscription_id ?? null,
    criadoEm: ymd(c.created_at),
  }));
}

/** Planos SaaS da plataforma (tabela planos_plataforma) + nº de assinantes. */
export async function adminFetchPlanosPlataforma(): Promise<PlanoPlataforma[]> {
  const supabase = createClient();
  const [planosRes, consRes] = await Promise.all([
    supabase.from("planos_plataforma").select("*").order("ordem"),
    supabase.from("consultorias").select("plano, plano_status"),
  ]);
  if (planosRes.error) throw planosRes.error;
  const counts = new Map<string, number>();
  for (const c of consRes.data ?? []) {
    if (c.plano && c.plano_status !== "cancelado") {
      counts.set(c.plano, (counts.get(c.plano) ?? 0) + 1);
    }
  }
  return (planosRes.data ?? []).map((p: any): PlanoPlataforma => ({
    id: p.id,
    slug: p.slug,
    nome: p.nome,
    descricao: p.descricao ?? "",
    preco: Number(p.preco ?? 0),
    limiteAlunos: p.limite_alunos ?? 0,
    recursos: Array.isArray(p.recursos) ? p.recursos : [],
    destaque: !!p.destaque,
    status: p.status === "arquivado" ? "arquivado" : "ativo",
    ordem: p.ordem ?? 0,
    assinantes: counts.get(p.slug) ?? 0,
  }));
}

/** KPIs da visão geral, derivados das consultorias reais. */
export async function adminFetchStats(): Promise<AdminStats> {
  const cons = await adminFetchConsultorias();
  const mesAtual = dataLocalYMD(new Date()).slice(0, 7);
  return {
    totalConsultorias: cons.length,
    consultoriasAtivas: cons.filter((c) => c.status === "ativo" || c.status === "trial").length,
    totalAlunos: cons.reduce((s, c) => s + c.alunosAtivos, 0),
    mrrPlataforma: cons.reduce((s, c) => s + c.mrr, 0),
    volumeProcessadoMes: cons.reduce((s, c) => s + c.faturamentoMensal, 0),
    novasConsultoriasMes: cons.filter((c) => c.criadoEm.slice(0, 7) === mesAtual).length,
    inadimplentes: cons.filter((c) => c.status === "inadimplente").length,
  };
}

/**
 * Taxa EFETIVA do gateway (Asaas), derivada dos pagamentos reais: para cada
 * cobrança paga com net_value, a taxa do Asaas = valor − net_value. Retorna o %
 * médio sobre o bruto e o valor médio absoluto. feePct = null quando ainda não
 * há cobranças pagas (aí a projeção usa uma estimativa editável).
 */
export type AsaasFeeInfo = {
  feePct: number | null;
  feeMedioAbs: number | null;
  amostra: number;
};

export async function adminFetchAsaasFee(): Promise<AsaasFeeInfo> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pagamentos")
    .select("valor, net_value, status")
    .not("net_value", "is", null);
  if (error) return { feePct: null, feeMedioAbs: null, amostra: 0 };
  const pagas = (data ?? []).filter(
    (p) => PAGO.includes(String(p.status)) && Number(p.valor) > 0 && p.net_value != null
  );
  if (pagas.length === 0) return { feePct: null, feeMedioAbs: null, amostra: 0 };
  const somaBruto = pagas.reduce((s, p) => s + Number(p.valor), 0);
  const somaFee = pagas.reduce((s, p) => s + (Number(p.valor) - Number(p.net_value)), 0);
  return {
    feePct: somaBruto > 0 ? (somaFee / somaBruto) * 100 : null,
    feeMedioAbs: somaFee / pagas.length,
    amostra: pagas.length,
  };
}

// ── CRUD: consultoria ────────────────────────────────────────────────────────
export async function adminUpdateConsultoria(
  id: string,
  patch: {
    nome?: string;
    nomeNegocio?: string;
    telefone?: string;
    conselhoTipo?: string | null;
    conselhoNumero?: string | null;
    plano?: string;
    status?: StatusConsultoria;
  }
): Promise<void> {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (patch.nome !== undefined) row.nome = patch.nome;
  if (patch.nomeNegocio !== undefined) row.nome_negocio = patch.nomeNegocio;
  if (patch.telefone !== undefined) row.telefone = patch.telefone;
  if (patch.conselhoTipo !== undefined) row.conselho_tipo = patch.conselhoTipo || null;
  if (patch.conselhoNumero !== undefined) row.conselho_numero = patch.conselhoNumero || null;
  if (patch.plano !== undefined) row.plano = patch.plano;
  if (patch.status !== undefined) row.plano_status = patch.status;
  const { data, error } = await supabase
    .from("consultorias")
    .update(row)
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Nada atualizado (sem permissão/registro inexistente).");
}

export async function adminSetConsultoriaStatus(
  id: string,
  status: StatusConsultoria
): Promise<void> {
  return adminUpdateConsultoria(id, { status });
}

export async function adminDeleteConsultoria(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("consultorias").delete().eq("id", id);
  if (error) throw error;
}

/** Atualiza o nome de exibição do consultor (mora em profiles, não consultorias). */
export async function adminUpdateConsultorNome(
  consultoriaId: string,
  nome: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ nome })
    .eq("consultoria_id", consultoriaId)
    .eq("role", "consultor");
  if (error) throw error;
}

// ── CRUD: aluno ──────────────────────────────────────────────────────────────
export async function adminCreateAluno(input: {
  consultoriaId: string;
  nome: string;
  objetivo?: string;
  email?: string;
  telefone?: string;
  cpf?: string;
}): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("alunos")
    .insert({
      consultoria_id: input.consultoriaId,
      nome: input.nome,
      objetivo: input.objetivo || null,
      email: input.email || null,
      telefone: input.telefone || null,
      cpf: (input.cpf ?? "").replace(/\D/g, "") || null,
      status_pagamento: "novo",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function adminUpdateAluno(
  id: string,
  patch: { nome?: string; objetivo?: string; email?: string; telefone?: string; consultoriaId?: string }
): Promise<void> {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (patch.nome !== undefined) row.nome = patch.nome;
  if (patch.objetivo !== undefined) row.objetivo = patch.objetivo || null;
  if (patch.email !== undefined) row.email = patch.email || null;
  if (patch.telefone !== undefined) row.telefone = patch.telefone || null;
  if (patch.consultoriaId !== undefined) row.consultoria_id = patch.consultoriaId;
  const { data, error } = await supabase.from("alunos").update(row).eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Nada atualizado (sem permissão/registro inexistente).");
}

export async function adminDeleteAluno(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("alunos").delete().eq("id", id);
  if (error) throw error;
}

// ── CRUD: produto (planos do consultor) ──────────────────────────────────────
export async function adminSetProdutoStatus(
  id: string,
  status: "ativo" | "pausado"
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("planos").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function adminUpdateProduto(
  id: string,
  patch: { nome?: string; preco?: number }
): Promise<void> {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (patch.nome !== undefined) row.nome = patch.nome;
  if (patch.preco !== undefined) row.preco = patch.preco;
  const { data, error } = await supabase.from("planos").update(row).eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Nada atualizado (sem permissão/registro inexistente).");
}

export async function adminDeleteProduto(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("planos").delete().eq("id", id);
  if (error) throw error;
}

// ── CRUD: plano SaaS da plataforma ───────────────────────────────────────────
export type PlanoPlataformaInput = {
  slug: string;
  nome: string;
  descricao?: string;
  preco: number;
  limiteAlunos?: number;
  recursos?: string[];
  destaque?: boolean;
  status?: "ativo" | "arquivado";
  ordem?: number;
};

export async function adminSavePlanoPlataforma(
  input: PlanoPlataformaInput,
  id?: string
): Promise<void> {
  const supabase = createClient();
  const row = {
    slug: input.slug,
    nome: input.nome,
    descricao: input.descricao || null,
    preco: input.preco,
    limite_alunos: input.limiteAlunos ?? 0,
    recursos: input.recursos ?? [],
    destaque: input.destaque ?? false,
    status: input.status ?? "ativo",
    ordem: input.ordem ?? 0,
  };
  if (id) {
    const { error } = await supabase.from("planos_plataforma").update(row).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("planos_plataforma").insert(row);
    if (error) throw error;
  }
}

export async function adminDeletePlanoPlataforma(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("planos_plataforma").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================================
// POST /api/admin/asaas/sincronizar — reconciliação PULL da PLATAFORMA inteira.
//
// Versão admin da /api/asaas/sincronizar (que é só do consultor logado). Varre
// TODOS os tenants e faz upsert em `pagamentos` a partir do Asaas ao vivo:
//   • assinaturas SaaS dos consultores (fluxo 1 → receita da plataforma);
//   • mensalidades dos alunos (fluxo 2 → split_taxa = fatia da plataforma).
// Também atualiza consultorias.plano_status e alunos.status_pagamento.
// Idempotente. Admin-only. Complementa o webhook (fonte de verdade) quando uma
// entrega se perde ou em ambiente local sem túnel público.
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { guardAdmin } from "@/lib/apiAdmin";
import { createAdminClient } from "@/utils/supabase/admin";
import { listarCobrancasDaAssinatura, AsaasError } from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

const round2 = (n: number) => Math.round(n * 100) / 100;
const PAGO = ["CONFIRMED", "RECEIVED"];

/** Fatia da plataforma na mensalidade: netValue − split creditado ao coach;
 *  fallback netValue × taxa quando o split ainda não traz o totalValue. */
function splitTaxaDe(payment: any, net: number, taxa: number): number {
  const itens: any[] = Array.isArray(payment?.split) ? payment.split : [];
  const somaCoach = itens.reduce(
    (s, it) => s + (it?.totalValue != null ? Number(it.totalValue) : 0),
    0
  );
  if (somaCoach > 0) return round2(Math.max(0, net - somaCoach));
  return round2(net * (taxa / 100));
}

function statusAlunoDe(status: string): string | null {
  const u = String(status).toUpperCase();
  if (PAGO.includes(u)) return "em_dia";
  if (u === "OVERDUE") return "atrasado";
  if (u === "REFUNDED" || u === "REFUND_REQUESTED") return "pendente";
  return null;
}

function statusConsultoriaDe(status: string): string | null {
  const u = String(status).toUpperCase();
  if (PAGO.includes(u)) return "ativo";
  if (u === "OVERDUE") return "inadimplente";
  return null;
}

/** Faz upsert das cobranças de uma assinatura em `pagamentos`. Retorna quantas. */
async function upsertCobrancas(
  admin: ReturnType<typeof createAdminClient>,
  lista: any[],
  base: {
    fluxo: "saas" | "mensalidade";
    consultoriaId: string | null;
    alunoId: string | null;
    subId: string;
    taxa: number;
  }
): Promise<number> {
  let n = 0;
  for (const p of lista) {
    if (!p?.id) continue;
    const net = p.netValue != null ? Number(p.netValue) : null;
    const pago = PAGO.includes(String(p.status).toUpperCase());
    const quando = p.confirmedDate || p.paymentDate || p.dateCreated || null;
    const linha: Record<string, unknown> = {
      asaas_payment_id: p.id,
      asaas_subscription_id: base.subId,
      consultoria_id: base.consultoriaId,
      aluno_id: base.alunoId,
      fluxo: base.fluxo,
      billing_type: p.billingType ?? null,
      valor: p.value ?? null,
      net_value: net,
      // SaaS: receita da plataforma = net_value (sem split) → split_taxa null.
      // Mensalidade: split_taxa = fatia retida no split.
      split_taxa:
        base.fluxo === "mensalidade" && net != null
          ? splitTaxaDe(p, net, base.taxa)
          : null,
      status: p.status ?? null,
      external_reference: p.externalReference ?? null,
      updated_at: new Date().toISOString(),
    };
    if (pago && quando) linha.confirmado_em = quando;
    if (String(p.status).toUpperCase() === "RECEIVED" && quando) {
      linha.recebido_em = quando;
    }
    const up = await admin
      .from("pagamentos")
      .upsert(linha, { onConflict: "asaas_payment_id" });
    if (!up.error) n++;
  }
  return n;
}

/** Cobrança mais recente (por vencimento) de uma lista. */
function maisRecente(lista: any[]): any | null {
  return (
    [...lista].sort((x, y) =>
      String(y.dueDate ?? "").localeCompare(String(x.dueDate ?? ""))
    )[0] ?? null
  );
}

export async function POST() {
  const negado = await guardAdmin();
  if (negado) return negado;
  if (!asaasEnabled) {
    return NextResponse.json({ erro: "Asaas não configurado" }, { status: 503 });
  }

  const admin = createAdminClient();

  // Taxa efetiva por consultoria: override do coach → global → 10.
  const { data: cfg } = await admin
    .from("plataforma_config")
    .select("taxa_plataforma_pct")
    .eq("id", 1)
    .maybeSingle();
  const taxaGlobal = Number(cfg?.taxa_plataforma_pct ?? 10);

  const { data: consultorias } = await admin
    .from("consultorias")
    .select("id, asaas_subscription_id, taxa_plataforma_pct");
  const taxaDe = new Map<string, number>();
  for (const c of consultorias ?? []) {
    taxaDe.set(
      c.id as string,
      c.taxa_plataforma_pct != null ? Number(c.taxa_plataforma_pct) : taxaGlobal
    );
  }

  let pagamentos = 0;
  let consultoriasAtualizadas = 0;
  let alunosAtualizados = 0;

  try {
    // 1) Assinaturas SaaS dos consultores (fluxo 1 → receita da plataforma).
    for (const c of consultorias ?? []) {
      const subId = c.asaas_subscription_id as string | null;
      if (!subId) continue;
      const { data: cobrancas } = await listarCobrancasDaAssinatura(subId);
      const lista = (cobrancas ?? []) as any[];
      if (lista.length === 0) continue;
      pagamentos += await upsertCobrancas(admin, lista, {
        fluxo: "saas",
        consultoriaId: c.id as string,
        alunoId: null,
        subId,
        taxa: 0,
      });
      const recente = maisRecente(lista);
      const novo = recente ? statusConsultoriaDe(recente.status) : null;
      if (novo) {
        const r = await admin
          .from("consultorias")
          .update({ plano_status: novo })
          .eq("id", c.id);
        if (!r.error) consultoriasAtualizadas++;
      }
    }

    // 2) Mensalidades dos alunos (fluxo 2 → split_taxa da plataforma).
    const { data: alunos } = await admin
      .from("alunos")
      .select("id, consultoria_id, asaas_subscription_id")
      .not("asaas_subscription_id", "is", null);
    for (const a of alunos ?? []) {
      const subId = a.asaas_subscription_id as string;
      const consId = (a.consultoria_id as string) ?? null;
      const { data: cobrancas } = await listarCobrancasDaAssinatura(subId);
      const lista = (cobrancas ?? []) as any[];
      if (lista.length === 0) continue;
      pagamentos += await upsertCobrancas(admin, lista, {
        fluxo: "mensalidade",
        consultoriaId: consId,
        alunoId: a.id as string,
        subId,
        taxa: consId ? taxaDe.get(consId) ?? taxaGlobal : taxaGlobal,
      });
      const recente = maisRecente(lista);
      const novo = recente ? statusAlunoDe(recente.status) : null;
      if (novo) {
        const r = await admin
          .from("alunos")
          .update({ status_pagamento: novo })
          .eq("id", a.id);
        if (!r.error) alunosAtualizados++;
      }
    }

    return NextResponse.json({
      ok: true,
      pagamentos,
      consultoriasAtualizadas,
      alunosAtualizados,
    });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[admin/asaas/sincronizar] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao sincronizar" },
      { status }
    );
  }
}

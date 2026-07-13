// ============================================================================
// POST /api/asaas/sincronizar — reconciliação PULL dos recebimentos do consultor.
//
// O webhook é a fonte de verdade em produção, mas pode não chegar (ex.: ambiente
// local sem túnel público, ou uma entrega perdida). Esta rota consulta o Asaas
// ao vivo — para cada aluno do consultor com assinatura, lê as cobranças e faz
// upsert em `pagamentos` (mesma forma do webhook: consultoria_id + split_taxa a
// partir do split real) e atualiza alunos.status_pagamento. Idempotente.
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { listarCobrancasDaAssinatura, AsaasError } from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

const round2 = (n: number) => Math.round(n * 100) / 100;
const PAGO = ["CONFIRMED", "RECEIVED"];

/** Fatia da plataforma: netValue − split creditado ao coach (verdade do Asaas);
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

/** Status da cobrança → status_pagamento do aluno. */
function statusAlunoDe(status: string): string | null {
  const u = String(status).toUpperCase();
  if (PAGO.includes(u)) return "em_dia";
  if (u === "OVERDUE") return "atrasado";
  if (u === "REFUNDED" || u === "REFUND_REQUESTED") return "pendente";
  return null;
}

export async function POST() {
  if (!asaasEnabled) {
    return NextResponse.json({ erro: "Asaas não configurado" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  const { data: prof } = await supabase
    .from("profiles")
    .select("role, consultoria_id")
    .eq("id", user.id)
    .maybeSingle();
  if (prof?.role !== "consultor" || !prof.consultoria_id) {
    return NextResponse.json({ erro: "apenas consultor" }, { status: 403 });
  }
  const consId = prof.consultoria_id as string;

  const admin = createAdminClient();

  // Taxa efetiva (override do coach → global → 10).
  const { data: cons } = await admin
    .from("consultorias")
    .select("taxa_plataforma_pct")
    .eq("id", consId)
    .maybeSingle();
  const { data: cfg } = await admin
    .from("plataforma_config")
    .select("taxa_plataforma_pct")
    .eq("id", 1)
    .maybeSingle();
  const taxa =
    cons?.taxa_plataforma_pct != null
      ? Number(cons.taxa_plataforma_pct)
      : Number(cfg?.taxa_plataforma_pct ?? 10);

  // Alunos do tenant com assinatura no Asaas.
  const { data: alunos } = await admin
    .from("alunos")
    .select("id, asaas_subscription_id")
    .eq("consultoria_id", consId)
    .not("asaas_subscription_id", "is", null);

  let pagamentos = 0;
  let alunosAtualizados = 0;

  try {
    for (const a of alunos ?? []) {
      const subId = a.asaas_subscription_id as string;
      const { data: cobrancas } = await listarCobrancasDaAssinatura(subId);
      const lista = (cobrancas ?? []) as any[];
      if (lista.length === 0) continue;

      for (const p of lista) {
        if (!p?.id) continue;
        const net = p.netValue != null ? Number(p.netValue) : null;
        const pago = PAGO.includes(String(p.status).toUpperCase());
        const quando = p.confirmedDate || p.paymentDate || p.dateCreated || null;
        const linha: Record<string, unknown> = {
          asaas_payment_id: p.id,
          asaas_subscription_id: subId,
          consultoria_id: consId,
          aluno_id: a.id,
          fluxo: "mensalidade",
          billing_type: p.billingType ?? null,
          valor: p.value ?? null,
          net_value: net,
          split_taxa: net != null ? splitTaxaDe(p, net, taxa) : null,
          status: p.status ?? null,
          external_reference: p.externalReference ?? null,
          updated_at: new Date().toISOString(),
        };
        if (pago && quando) linha.confirmado_em = quando;
        if (String(p.status).toUpperCase() === "RECEIVED" && quando) linha.recebido_em = quando;

        const up = await admin
          .from("pagamentos")
          .upsert(linha, { onConflict: "asaas_payment_id" });
        if (!up.error) pagamentos++;
      }

      // Status do aluno pela cobrança mais recente (por vencimento).
      const maisRecente = [...lista].sort((x, y) =>
        String(y.dueDate ?? "").localeCompare(String(x.dueDate ?? ""))
      )[0];
      const novoStatus = maisRecente ? statusAlunoDe(maisRecente.status) : null;
      if (novoStatus) {
        const r = await admin
          .from("alunos")
          .update({ status_pagamento: novoStatus })
          .eq("id", a.id);
        if (!r.error) alunosAtualizados++;
      }
    }

    return NextResponse.json({ ok: true, pagamentos, alunosAtualizados });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[asaas/sincronizar] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao sincronizar" },
      { status }
    );
  }
}

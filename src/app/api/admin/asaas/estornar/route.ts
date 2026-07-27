// ============================================================================
// POST /api/admin/asaas/estornar — ADMIN estorna qualquer cobrança (Asaas). O
// split é revertido pelo gateway. Admin-only (guardAdmin). Reflete o estorno no
// ledger `pagamentos` (write via service_role) para a UI responder na hora.
//
// Body: { asaasPaymentId, valor? }  (valor ausente = estorno total)
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { guardAdmin } from "@/lib/apiAdmin";
import { createAdminClient } from "@/utils/supabase/admin";
import { estornarCobranca, AsaasError } from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const negado = await guardAdmin();
  if (negado) return negado;
  if (!asaasEnabled) {
    return NextResponse.json({ erro: "Asaas não configurado" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    asaasPaymentId?: string;
    valor?: number;
  };
  const paymentId = body.asaasPaymentId?.trim();
  if (!paymentId) {
    return NextResponse.json({ erro: "asaasPaymentId ausente" }, { status: 400 });
  }

  try {
    const r = await estornarCobranca(paymentId, body.valor);
    const admin = createAdminClient();
    await admin
      .from("pagamentos")
      .update({ status: r.status ?? "REFUNDED", updated_at: new Date().toISOString() })
      .eq("asaas_payment_id", paymentId);
    return NextResponse.json({ ok: true, status: r.status ?? "REFUNDED" });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[admin/asaas/estornar] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao estornar" },
      { status }
    );
  }
}

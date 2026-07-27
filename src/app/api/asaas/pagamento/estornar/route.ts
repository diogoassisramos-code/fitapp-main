// ============================================================================
// POST /api/asaas/pagamento/estornar — CONSULTOR estorna uma cobrança de aluno.
//
// Estorno via Asaas (o split é revertido automaticamente pelo gateway). O
// consultor só pode estornar cobranças de MENSALIDADE do PRÓPRIO tenant — a RLS
// de `pagamentos` já filtra por consultoria, e reforçamos fluxo='mensalidade'
// (para ele não estornar a própria assinatura SaaS, que é receita da plataforma).
//
// Body: { asaasPaymentId, valor? }  (valor ausente = estorno total)
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { estornarCobranca, AsaasError } from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

  // 1) Autentica o consultor.
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

  // 2) Ownership: a RLS deixa o consultor ver só pagamentos do próprio tenant.
  const { data: pag } = await supabase
    .from("pagamentos")
    .select("id, asaas_payment_id, consultoria_id, fluxo")
    .eq("asaas_payment_id", paymentId)
    .maybeSingle();
  if (!pag) {
    return NextResponse.json({ erro: "pagamento não encontrado" }, { status: 404 });
  }
  if (pag.consultoria_id !== prof.consultoria_id) {
    return NextResponse.json({ erro: "sem permissão" }, { status: 403 });
  }
  if (pag.fluxo !== "mensalidade") {
    return NextResponse.json(
      { erro: "só é possível estornar mensalidades de alunos" },
      { status: 400 }
    );
  }

  try {
    const r = await estornarCobranca(paymentId, body.valor);
    // Reflete o estorno no ledger (write só via service_role). O webhook
    // PAYMENT_REFUNDED também atualiza; aqui é para a UI responder na hora.
    const admin = createAdminClient();
    await admin
      .from("pagamentos")
      .update({ status: r.status ?? "REFUNDED", updated_at: new Date().toISOString() })
      .eq("asaas_payment_id", paymentId);
    return NextResponse.json({ ok: true, status: r.status ?? "REFUNDED" });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[pagamento/estornar] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao estornar" },
      { status }
    );
  }
}

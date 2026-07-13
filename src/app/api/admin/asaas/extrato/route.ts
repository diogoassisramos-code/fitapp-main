// ============================================================================
// GET /api/admin/asaas/extrato — extrato REAL (ledger de caixa) da conta MASTER.
//
// Diferente do extrato derivado de `pagamentos` (o que o webhook capturou), este
// é o statement de caixa do Asaas (GET /financialTransactions): entradas de
// pagamentos, débitos de split pagos às subcontas, taxas e saques. Admin-only.
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { guardAdmin } from "@/lib/apiAdmin";
import { listarTransacoesFinanceiras, AsaasError } from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const negado = await guardAdmin();
  if (negado) return negado;
  if (!asaasEnabled) {
    return NextResponse.json({ erro: "Asaas não configurado" }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50) || 50, 100);
  try {
    const r = await listarTransacoesFinanceiras({ limit });
    const lancamentos = (r.data ?? []).map((t) => ({
      id: t.id,
      valor: Number(t.value ?? 0),
      saldo: t.balance != null ? Number(t.balance) : null,
      tipo: t.type ?? "",
      descricao: t.description ?? "",
      data: t.date ?? "",
    }));
    return NextResponse.json({ ok: true, lancamentos, total: r.totalCount ?? null });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[admin/asaas/extrato] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao consultar extrato" },
      { status }
    );
  }
}

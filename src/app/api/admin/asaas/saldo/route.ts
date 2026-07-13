// ============================================================================
// GET /api/admin/asaas/saldo — saldo DISPONÍVEL da conta MASTER (plataforma).
//
// Consulta o Asaas ao vivo (GET /finance/balance com a chave master). É o caixa
// real da plataforma: assinaturas SaaS (100%) + fatia do split das mensalidades.
// Admin-only.
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { guardAdmin } from "@/lib/apiAdmin";
import { saldoMaster, AsaasError } from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const negado = await guardAdmin();
  if (negado) return negado;
  if (!asaasEnabled) {
    return NextResponse.json({ erro: "Asaas não configurado" }, { status: 503 });
  }
  try {
    const { balance } = await saldoMaster();
    return NextResponse.json({ ok: true, saldo: Number(balance ?? 0) });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[admin/asaas/saldo] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao consultar saldo" },
      { status }
    );
  }
}

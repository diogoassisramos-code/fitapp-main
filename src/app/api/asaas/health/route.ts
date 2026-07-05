// ============================================================================
// GET /api/asaas/health — smoke-test da credencial/ambiente do Asaas.
// Chama /myAccount com a chave configurada. Útil para validar sandbox → prod.
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { getMyAccount, AsaasError } from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!asaasEnabled) {
    return NextResponse.json(
      { ok: false, motivo: "ASAAS_API_KEY / ASAAS_BASE_URL não configurados" },
      { status: 503 }
    );
  }
  try {
    const conta = (await getMyAccount()) as Record<string, unknown>;
    return NextResponse.json({
      ok: true,
      ambiente: process.env.ASAAS_BASE_URL,
      conta: {
        email: conta.email,
        name: conta.name,
        walletId: conta.walletId,
      },
    });
  } catch (e) {
    const status = e instanceof AsaasError ? e.status : 502;
    return NextResponse.json(
      { ok: false, erro: e instanceof Error ? e.message : String(e) },
      { status }
    );
  }
}

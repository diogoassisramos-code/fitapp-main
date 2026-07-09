// ============================================================================
// GET /api/asaas/saldo — saldo DISPONÍVEL real da subconta do consultor no Asaas.
// O dinheiro do split cai direto na wallet do coach; o app não guarda esse saldo,
// então consultamos o Asaas ao vivo (GET /finance/balance) com a apiKey da subconta.
// "A liberar" (em processamento) não tem endpoint único de saldo — fica no card
// financeiro derivado dos pagamentos por enquanto.
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { createClient } from "@/utils/supabase/server";
import { saldoSubconta, AsaasError } from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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
  const { data: cons } = await supabase
    .from("consultorias")
    .select("asaas_subaccount_key")
    .eq("id", prof.consultoria_id)
    .maybeSingle();
  const key = cons?.asaas_subaccount_key as string | null;
  if (!key) {
    return NextResponse.json({ erro: "subconta ainda não criada" }, { status: 409 });
  }

  try {
    const { balance } = await saldoSubconta(key);
    return NextResponse.json({ ok: true, saldo: Number(balance ?? 0) });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[asaas/saldo] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao consultar saldo" },
      { status }
    );
  }
}

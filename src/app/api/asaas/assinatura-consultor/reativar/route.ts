// ============================================================================
// POST /api/asaas/assinatura-consultor/reativar — o CONSULTOR reativa o próprio
// plano SaaS cancelado. Reativa a assinatura no Asaas (status=ACTIVE) e marca
// consultorias.plano_status='ativo'. Sem assinatura no Asaas (nunca teve/plano
// free), devolve 409 pedindo para assinar de novo.
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { reativarAssinatura, AsaasError } from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
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
    .select("id, asaas_subscription_id")
    .eq("id", prof.consultoria_id)
    .maybeSingle();
  if (!cons) {
    return NextResponse.json({ erro: "consultoria não encontrada" }, { status: 404 });
  }
  if (!cons.asaas_subscription_id) {
    return NextResponse.json(
      { erro: "sem assinatura para reativar — assine novamente", precisaAssinar: true },
      { status: 409 }
    );
  }

  try {
    if (asaasEnabled) {
      await reativarAssinatura(cons.asaas_subscription_id as string);
    }
    const admin = createAdminClient();
    const r = await admin
      .from("consultorias")
      .update({ plano_status: "ativo" })
      .eq("id", cons.id);
    if (r.error) throw r.error;
    return NextResponse.json({ ok: true, planoStatus: "ativo" });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[assinatura-consultor/reativar] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao reativar plano" },
      { status }
    );
  }
}

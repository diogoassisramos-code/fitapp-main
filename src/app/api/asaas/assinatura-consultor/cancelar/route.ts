// ============================================================================
// POST /api/asaas/assinatura-consultor/cancelar — o CONSULTOR cancela o próprio
// plano SaaS. Suspende no fim do ciclo (status=INACTIVE) e MANTÉM a conta —
// marca consultorias.plano_status='cancelado'. Sem assinatura no Asaas (plano
// free), só ajusta o status.
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { suspenderAssinatura, getAssinatura, AsaasError } from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
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
  const { data: cons } = await supabase
    .from("consultorias")
    .select("id, asaas_subscription_id, plano_status")
    .eq("id", prof.consultoria_id)
    .maybeSingle();
  if (!cons) {
    return NextResponse.json({ erro: "consultoria não encontrada" }, { status: 404 });
  }
  if (cons.plano_status === "cancelado") {
    return NextResponse.json({ ok: true, jaCancelado: true });
  }

  try {
    // 2) Suspende no Asaas (se houver assinatura). Antes, pega o fim do ciclo
    //    pago (próximo vencimento) → o acesso vale até lá (grace).
    let planoAte: string | null = null;
    if (cons.asaas_subscription_id) {
      try {
        const a = await getAssinatura(cons.asaas_subscription_id as string);
        planoAte = a.nextDueDate ?? null;
      } catch {
        /* sem a data → sem grace, cancela na hora */
      }
      await suspenderAssinatura(cons.asaas_subscription_id as string);
    }
    // 3) Marca cancelado + data-limite (write via service_role).
    const admin = createAdminClient();
    const r = await admin
      .from("consultorias")
      .update({ plano_status: "cancelado", plano_ate: planoAte })
      .eq("id", cons.id);
    if (r.error) throw r.error;
    return NextResponse.json({ ok: true, planoStatus: "cancelado", planoAte });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[assinatura-consultor/cancelar] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao cancelar plano" },
      { status }
    );
  }
}

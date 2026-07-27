// ============================================================================
// POST /api/aluno/assinatura/cancelar — o ALUNO cancela a própria consultoria
// (mensalidade) pelo APP MOBILE. Suspende no Asaas no fim do ciclo (INACTIVE) e
// MANTÉM a conta — decisão travada. Autentica por Bearer (JWT do Supabase) ou
// cookie. CORS liberado (o app roda em outra origem).
//
// A confirmação por SENHA é feita no app (re-login antes de chamar aqui); esta
// rota exige apenas a sessão válida do próprio aluno.
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { suspenderAssinatura, AsaasError } from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status, headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  if (!asaasEnabled) {
    return json(503, { erro: "cancelamento indisponível" });
  }

  // 1) Autentica: Bearer (app) ou cookie (dashboard).
  const authz = request.headers.get("authorization") || "";
  const bearer = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : null;
  const admin = createAdminClient();
  let userId: string | null = null;
  if (bearer) {
    const { data } = await admin.auth.getUser(bearer);
    userId = data.user?.id ?? null;
  } else {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  }
  if (!userId) return json(401, { erro: "não autenticado" });

  // 2) Resolve o aluno (profiles.aluno_id).
  const { data: prof } = await admin
    .from("profiles")
    .select("role, aluno_id")
    .eq("id", userId)
    .maybeSingle();
  if (prof?.role !== "aluno" || !prof.aluno_id) {
    return json(403, { erro: "apenas aluno" });
  }
  const { data: al } = await admin
    .from("alunos")
    .select("id, asaas_subscription_id")
    .eq("id", prof.aluno_id)
    .maybeSingle();
  if (!al?.asaas_subscription_id) {
    return json(409, { erro: "você não tem uma assinatura ativa" });
  }

  try {
    const r = await suspenderAssinatura(al.asaas_subscription_id as string);
    return json(200, { ok: true, status: r.status ?? "INACTIVE" });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[aluno/assinatura/cancelar] falha", e);
    return json(status, { erro: e instanceof Error ? e.message : "falha ao cancelar" });
  }
}

// ============================================================================
// POST /api/asaas/aluno/[id]/cancelar — CONSULTOR cancela a mensalidade de um
// aluno. Segue a decisão travada: suspende a assinatura no FIM DO CICLO
// (status=INACTIVE) e MANTÉM a conta/acesso do aluno — não faz DELETE (que
// apagaria as cobranças pendentes) nem mexe no status_pagamento (o aluno segue
// em dia até o período pago acabar).
//
// A RLS de `alunos` garante que o consultor só enxerga alunos do próprio tenant.
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { createClient } from "@/utils/supabase/server";
import { suspenderAssinatura, AsaasError } from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!asaasEnabled) {
    return NextResponse.json({ erro: "Asaas não configurado" }, { status: 503 });
  }
  const { id: alunoId } = await params;

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

  // 2) Aluno do tenant (RLS filtra; a checagem explícita é defensiva).
  const { data: al } = await supabase
    .from("alunos")
    .select("id, asaas_subscription_id, consultoria_id")
    .eq("id", alunoId)
    .maybeSingle();
  if (!al) return NextResponse.json({ erro: "aluno não encontrado" }, { status: 404 });
  if (al.consultoria_id !== prof.consultoria_id) {
    return NextResponse.json({ erro: "sem permissão" }, { status: 403 });
  }
  if (!al.asaas_subscription_id) {
    return NextResponse.json(
      { erro: "aluno sem assinatura ativa" },
      { status: 409 }
    );
  }

  try {
    const r = await suspenderAssinatura(al.asaas_subscription_id as string);
    return NextResponse.json({ ok: true, status: r.status ?? "INACTIVE" });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[aluno/cancelar] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao cancelar assinatura" },
      { status }
    );
  }
}

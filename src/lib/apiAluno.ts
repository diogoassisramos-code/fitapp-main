// ============================================================================
// Auth compartilhada das rotas do ALUNO chamadas pelo APP MOBILE. O app fala por
// Bearer (JWT do Supabase, sem cookies); cai pra cookie se vier do dashboard.
// CORS liberado porque o app roda em outra origem.
// ============================================================================
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const CORS_ALUNO = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function jsonAluno(status: number, body: unknown) {
  return NextResponse.json(body, { status, headers: CORS_ALUNO });
}

export function optionsAluno() {
  return new NextResponse(null, { status: 204, headers: CORS_ALUNO });
}

export type AlunoRow = {
  id: string;
  asaas_subscription_id: string | null;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
};

type Autenticado = {
  erro?: NextResponse;
  admin: ReturnType<typeof createAdminClient>;
  aluno: AlunoRow | null;
};

/** Resolve o aluno logado (Bearer ou cookie). Em erro, `erro` traz a resposta. */
export async function autenticarAluno(request: Request): Promise<Autenticado> {
  const admin = createAdminClient();
  const authz = request.headers.get("authorization") || "";
  const bearer = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : null;

  let userId: string | null = null;
  if (bearer) {
    const { data } = await admin.auth.getUser(bearer);
    userId = data.user?.id ?? null;
  } else {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  }
  if (!userId) return { erro: jsonAluno(401, { erro: "não autenticado" }), admin, aluno: null };

  const { data: prof } = await admin
    .from("profiles")
    .select("role, aluno_id")
    .eq("id", userId)
    .maybeSingle();
  if (prof?.role !== "aluno" || !prof.aluno_id) {
    return { erro: jsonAluno(403, { erro: "apenas aluno" }), admin, aluno: null };
  }
  const { data: aluno } = await admin
    .from("alunos")
    .select("id, asaas_subscription_id, cpf, email, telefone")
    .eq("id", prof.aluno_id)
    .maybeSingle();
  return { admin, aluno: (aluno as AlunoRow) ?? null };
}

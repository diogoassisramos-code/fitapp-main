// ============================================================================
// POST /api/onboarding/checar-identidade — checagem de identidade no checkout.
// Recebe { token, email, cpf } e diz se já existe conta (login) e/ou aluno com
// o CPF. A tela de compra usa isso ANTES de cobrar: se a pessoa já tem conta,
// ela faz LOGIN em vez de criar uma nova (evita cobrar e o "criar senha" falhar).
//
// Só responde dentro de um checkout REAL: exige um `token` de convite válido —
// sem isso a rota seria um oráculo público de enumeração de e-mail/CPF (LGPD).
// ============================================================================
import { NextResponse } from "next/server";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAO = { emailExiste: false, cpfExiste: false };

export async function POST(request: Request) {
  if (!supabaseEnabled) return NextResponse.json(NAO);

  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    email?: string;
    cpf?: string;
  };
  const token = (body.token || "").trim();
  const email = (body.email || "").trim();
  const cpf = (body.cpf || "").replace(/\D/g, "");
  if (!token || (!email && !cpf)) return NextResponse.json(NAO);

  const admin = createAdminClient();

  // Gate: só checa dentro de um convite existente (checkout real).
  const { data: convite } = await admin
    .from("convites")
    .select("id")
    .eq("token", token)
    .maybeSingle();
  if (!convite) return NextResponse.json(NAO);

  const { data, error } = await admin.rpc("identidade_existe", {
    p_email: email,
    p_cpf: cpf,
  });
  const row = Array.isArray(data) ? data[0] : data;
  // Tolerante: se a migration da RPC ainda não rodou, não bloqueia o fluxo.
  if (error || !row) return NextResponse.json(NAO);

  return NextResponse.json({
    emailExiste: !!row.email_existe,
    cpfExiste: !!row.cpf_existe,
  });
}

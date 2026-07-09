// ============================================================================
// POST /api/onboarding/vincular — religa o perfil do usuário logado ao aluno da
// compra recém-concluída. Usado quando quem compra JÁ tem conta na Revo:
// depois de pagar e logar, o profile passa a apontar para o aluno recém-criado
// (não implementa membership multi-coach; segue a ÚLTIMA compra).
//
// Segurança: o alunoId é derivado NO SERVIDOR do TOKEN do convite (status='usado'
// = pagamento concluído) — nunca de um id vindo do cliente. Guard adicional: o
// e-mail do aluno bate com o e-mail do usuário logado.
// ============================================================================
import { NextResponse } from "next/server";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!supabaseEnabled) {
    return NextResponse.json({ erro: "indisponível" }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = (body.token || "").trim();
  if (!token) return NextResponse.json({ erro: "token ausente" }, { status: 400 });

  // 1) Usuário logado (a pessoa acabou de logar na tela de compra).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const admin = createAdminClient();

  // 2) Deriva o aluno do convite PAGO (não confia em id do cliente).
  const { data: convite } = await admin
    .from("convites")
    .select("aluno_id, consultoria_id, status")
    .eq("token", token)
    .maybeSingle();
  if (!convite || !convite.aluno_id || convite.status !== "usado") {
    return NextResponse.json({ erro: "compra não encontrada" }, { status: 404 });
  }

  // 3) Guard: o aluno dessa compra tem o e-mail do usuário logado.
  const { data: aluno } = await admin
    .from("alunos")
    .select("id, consultoria_id, email")
    .eq("id", convite.aluno_id)
    .maybeSingle();
  if (!aluno) return NextResponse.json({ erro: "aluno não encontrado" }, { status: 404 });

  const emailAluno = (aluno.email || "").trim().toLowerCase();
  const emailUser = (user.email || "").trim().toLowerCase();
  if (!emailAluno || emailAluno !== emailUser) {
    return NextResponse.json({ erro: "essa compra não é da sua conta" }, { status: 403 });
  }

  // 4) Religa o profile à última consultoria contratada.
  const { error } = await admin
    .from("profiles")
    .update({ aluno_id: aluno.id, consultoria_id: aluno.consultoria_id })
    .eq("id", user.id);
  if (error) {
    return NextResponse.json({ erro: "não foi possível vincular" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alunoId: aluno.id, consultoriaId: aluno.consultoria_id });
}

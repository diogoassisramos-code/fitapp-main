// ============================================================================
// /api/anamnese/aluno — anamnese do lado do ALUNO logado.
// GET  → { pendente, respondida, perguntas } (pendente = consultoria tem
//         anamnese ativa e o aluno ainda não respondeu).
// POST → { respostas } grava e marca anamnese_respondida=true.
// ============================================================================
import { NextResponse } from "next/server";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function alunoLogado() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "não autenticado", status: 401 as const };
  const { data: prof } = await supabase
    .from("profiles")
    .select("role, aluno_id, consultoria_id")
    .eq("id", user.id)
    .maybeSingle();
  if (prof?.role !== "aluno" || !prof.aluno_id) {
    return { erro: "apenas aluno", status: 403 as const };
  }
  return { alunoId: prof.aluno_id as string, consultoriaId: prof.consultoria_id as string };
}

export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ pendente: false, respondida: false, perguntas: [] });
  const r = await alunoLogado();
  if ("erro" in r) return NextResponse.json({ erro: r.erro }, { status: r.status });
  const admin = createAdminClient();
  const [{ data: cons }, { data: aluno }] = await Promise.all([
    admin.from("consultorias").select("anamnese_ativa, anamnese_perguntas").eq("id", r.consultoriaId).maybeSingle(),
    admin.from("alunos").select("anamnese_respondida").eq("id", r.alunoId).maybeSingle(),
  ]);
  const respondida = !!aluno?.anamnese_respondida;
  const ativa = cons?.anamnese_ativa === true;
  return NextResponse.json({
    pendente: ativa && !respondida,
    respondida,
    perguntas: ativa ? cons?.anamnese_perguntas ?? [] : [],
  });
}

export async function POST(request: Request) {
  if (!supabaseEnabled) return NextResponse.json({ erro: "indisponível" }, { status: 503 });
  const r = await alunoLogado();
  if ("erro" in r) return NextResponse.json({ erro: r.erro }, { status: r.status });
  const body = (await request.json().catch(() => ({}))) as { respostas?: unknown };

  const admin = createAdminClient();
  const { error } = await admin
    .from("alunos")
    .update({ anamnese_respondida: true, anamnese_respostas: body.respostas ?? {} })
    .eq("id", r.alunoId);
  if (error) return NextResponse.json({ erro: "não foi possível salvar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

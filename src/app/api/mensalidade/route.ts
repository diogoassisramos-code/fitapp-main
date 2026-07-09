// ============================================================================
// GET/POST /api/mensalidade — o CONSULTOR define/lê o preço da mensalidade que
// cobra dos alunos (consultorias.mensalidade_valor). Grava via service_role
// (a coluna não está no grant de update de consultorias após o membership).
// ============================================================================
import { NextResponse } from "next/server";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function consultoriaDoUsuario() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "não autenticado" as const, status: 401 };
  const { data: prof } = await supabase
    .from("profiles")
    .select("role, consultoria_id")
    .eq("id", user.id)
    .maybeSingle();
  if (prof?.role !== "consultor" || !prof.consultoria_id) {
    return { erro: "apenas consultor" as const, status: 403 };
  }
  return { consultoriaId: prof.consultoria_id, supabase };
}

export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ valor: null });
  const ctx = await consultoriaDoUsuario();
  if ("erro" in ctx) return NextResponse.json({ erro: ctx.erro }, { status: ctx.status });
  const { data } = await ctx.supabase
    .from("consultorias")
    .select("mensalidade_valor")
    .eq("id", ctx.consultoriaId)
    .maybeSingle();
  return NextResponse.json({ valor: data?.mensalidade_valor ?? null });
}

export async function POST(request: Request) {
  if (!supabaseEnabled) {
    return NextResponse.json({ erro: "Supabase não configurado" }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as { valor?: number };
  const valor = Number(body.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ erro: "valor inválido" }, { status: 400 });
  }
  const ctx = await consultoriaDoUsuario();
  if ("erro" in ctx) return NextResponse.json({ erro: ctx.erro }, { status: ctx.status });

  const admin = createAdminClient();
  const { error } = await admin
    .from("consultorias")
    .update({ mensalidade_valor: valor })
    .eq("id", ctx.consultoriaId);
  if (error) return NextResponse.json({ erro: "falha ao salvar" }, { status: 500 });
  return NextResponse.json({ ok: true, valor });
}

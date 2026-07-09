// ============================================================================
// /api/anamnese — config da anamnese da consultoria (lado consultor).
// GET  → { ativa, perguntas } da consultoria logada.
// POST → { perguntas } salva e marca ativa=true; { optOut:true } marca ativa=false.
// Usa service_role: anamnese_ativa/anamnese_perguntas ficam fora dos grants de
// UPDATE por coluna do client autenticado.
// ============================================================================
import { NextResponse } from "next/server";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function consultorLogado() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "não autenticado", status: 401 as const };
  const { data: prof } = await supabase
    .from("profiles")
    .select("role, consultoria_id")
    .eq("id", user.id)
    .maybeSingle();
  if (prof?.role !== "consultor" || !prof.consultoria_id) {
    return { erro: "apenas consultor", status: 403 as const };
  }
  return { consultoriaId: prof.consultoria_id as string };
}

export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ ativa: null, perguntas: [] });
  const r = await consultorLogado();
  if ("erro" in r) return NextResponse.json({ erro: r.erro }, { status: r.status });
  const admin = createAdminClient();
  const { data } = await admin
    .from("consultorias")
    .select("anamnese_ativa, anamnese_perguntas")
    .eq("id", r.consultoriaId)
    .maybeSingle();
  return NextResponse.json({
    ativa: data?.anamnese_ativa ?? null,
    perguntas: data?.anamnese_perguntas ?? [],
  });
}

export async function POST(request: Request) {
  if (!supabaseEnabled) return NextResponse.json({ erro: "indisponível" }, { status: 503 });
  const r = await consultorLogado();
  if ("erro" in r) return NextResponse.json({ erro: r.erro }, { status: r.status });
  const body = (await request.json().catch(() => ({}))) as {
    perguntas?: unknown[];
    optOut?: boolean;
  };

  const admin = createAdminClient();
  const patch = body.optOut
    ? { anamnese_ativa: false, anamnese_perguntas: [] }
    : { anamnese_ativa: true, anamnese_perguntas: Array.isArray(body.perguntas) ? body.perguntas : [] };
  const { error } = await admin.from("consultorias").update(patch).eq("id", r.consultoriaId);
  if (error) return NextResponse.json({ erro: "não foi possível salvar" }, { status: 500 });
  return NextResponse.json({ ok: true, ativa: patch.anamnese_ativa });
}

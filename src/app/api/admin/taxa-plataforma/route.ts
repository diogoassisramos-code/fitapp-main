// ============================================================================
// GET/POST /api/admin/taxa-plataforma — taxa global da plataforma (Fluxo 2).
// GET: qualquer autenticado lê. POST: só admin (grava via service_role).
// ============================================================================
import { NextResponse } from "next/server";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { guardAdmin } from "@/lib/apiAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!supabaseEnabled) {
    return NextResponse.json({ taxaPct: 10 });
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("plataforma_config")
    .select("taxa_plataforma_pct")
    .eq("id", 1)
    .maybeSingle();
  return NextResponse.json({ taxaPct: Number(data?.taxa_plataforma_pct ?? 10) });
}

export async function POST(request: Request) {
  if (!supabaseEnabled) {
    return NextResponse.json({ erro: "Supabase não configurado" }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as { pct?: number };
  const pct = Number(body.pct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    return NextResponse.json({ erro: "taxa inválida (0–100)" }, { status: 400 });
  }

  // Só admin (por e-mail) pode alterar.
  const negado = await guardAdmin();
  if (negado) return negado;

  // Grava via service_role (a tabela não tem grant de update para authenticated).
  const admin = createAdminClient();
  const { error } = await admin
    .from("plataforma_config")
    .update({ taxa_plataforma_pct: pct, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) {
    return NextResponse.json({ erro: "falha ao salvar" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, taxaPct: pct });
}

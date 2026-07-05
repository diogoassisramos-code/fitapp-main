// ============================================================================
// GET /api/onboarding/resolver?token=XXX — resolução PÚBLICA do convite.
// Devolve só campos seguros (coach + valor) via a RPC resolver_convite. É o que
// a tela pública /onboarding/[token] usa para montar o checkout com o preço real.
// ============================================================================
import { NextResponse } from "next/server";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token) return NextResponse.json({ erro: "token ausente" }, { status: 400 });
  if (!supabaseEnabled) {
    return NextResponse.json({ erro: "indisponível" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolver_convite", { p_token: token });
  const convite = Array.isArray(data) ? data[0] : data;
  if (error || !convite) {
    return NextResponse.json({ erro: "convite inválido ou expirado" }, { status: 404 });
  }
  if (convite.status !== "pendente") {
    return NextResponse.json({ erro: "convite já utilizado" }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    coachNome: convite.coach_nome,
    valor: Number(convite.valor),
    descricao: convite.descricao,
  });
}

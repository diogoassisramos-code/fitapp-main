// ============================================================================
// POST /api/convites — o CONSULTOR gera um link de convite/compra para um aluno.
// O link (/onboarding/[token]) leva o aluno ao checkout com split. O valor é a
// mensalidade do coach (consultorias.mensalidade_valor) ou o informado no body.
// ============================================================================
import { NextResponse } from "next/server";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!supabaseEnabled) {
    return NextResponse.json({ erro: "Supabase não configurado" }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    alunoNome?: string;
    valor?: number;
    descricao?: string;
    planoId?: string;
  };

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

  const { data: cons } = await supabase
    .from("consultorias")
    .select("id, nome_negocio, nome, mensalidade_valor, plano_status")
    .eq("id", prof.consultoria_id)
    .maybeSingle();
  if (!cons) return NextResponse.json({ erro: "consultoria não encontrada" }, { status: 404 });

  // Plano lapsado (cancelado/inadimplente): não gera link até reativar.
  const planoAtivo = cons.plano_status === "ativo" || cons.plano_status === "trial";
  if (!planoAtivo) {
    return NextResponse.json(
      { erro: "consultoria inativa — reative seu plano para gerar links", consultoriaInativa: true },
      { status: 402 }
    );
  }

  const valor = Number(body.valor ?? cons.mensalidade_valor ?? 0);
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json(
      { erro: "defina o valor da mensalidade antes de convidar" },
      { status: 400 }
    );
  }

  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  const { data: convite, error } = await supabase
    .from("convites")
    .insert({
      token,
      consultoria_id: cons.id,
      aluno_nome: body.alunoNome?.trim() || null,
      valor,
      descricao: body.descricao?.trim() || `Mensalidade · ${cons.nome_negocio || cons.nome}`,
      // Só grava plano_id quando o convite é de um plano — assim o convite avulso
      // (card da mensalidade) segue funcionando mesmo antes da migration da coluna.
      ...(body.planoId ? { plano_id: body.planoId } : {}),
    })
    .select("token")
    .single();
  if (error || !convite) {
    return NextResponse.json({ erro: "não foi possível gerar o convite" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, token: convite.token });
}

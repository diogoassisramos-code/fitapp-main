// ============================================================================
// POST /api/admin/asaas/assinatura — ADMIN cancela/reativa a assinatura SaaS de
// uma consultoria, ligando o Asaas de verdade (não só o status no banco):
//   • acao='cancelar' → suspende no Asaas (INACTIVE) + plano_status='cancelado'
//   • acao='reativar' → reativa no Asaas (ACTIVE)   + plano_status='ativo'
// Consultoria sem assinatura no Asaas (plano free): só ajusta o plano_status.
//
// Body: { consultoriaId, acao: 'cancelar' | 'reativar' }
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { guardAdmin } from "@/lib/apiAdmin";
import { createAdminClient } from "@/utils/supabase/admin";
import { suspenderAssinatura, reativarAssinatura, AsaasError } from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const negado = await guardAdmin();
  if (negado) return negado;

  const body = (await request.json().catch(() => ({}))) as {
    consultoriaId?: string;
    acao?: "cancelar" | "reativar";
  };
  const consultoriaId = body.consultoriaId?.trim();
  const acao = body.acao;
  if (!consultoriaId || (acao !== "cancelar" && acao !== "reativar")) {
    return NextResponse.json({ erro: "parâmetros inválidos" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: cons } = await admin
    .from("consultorias")
    .select("id, asaas_subscription_id")
    .eq("id", consultoriaId)
    .maybeSingle();
  if (!cons) {
    return NextResponse.json({ erro: "consultoria não encontrada" }, { status: 404 });
  }

  const novoStatus = acao === "cancelar" ? "cancelado" : "ativo";

  try {
    // Liga o Asaas quando houver assinatura; sem ela (free) só muda o status.
    if (cons.asaas_subscription_id && asaasEnabled) {
      if (acao === "cancelar") {
        await suspenderAssinatura(cons.asaas_subscription_id as string);
      } else {
        await reativarAssinatura(cons.asaas_subscription_id as string);
      }
    }
    const r = await admin
      .from("consultorias")
      .update({ plano_status: novoStatus })
      .eq("id", cons.id);
    if (r.error) throw r.error;
    return NextResponse.json({ ok: true, planoStatus: novoStatus });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[admin/asaas/assinatura] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao atualizar assinatura" },
      { status }
    );
  }
}

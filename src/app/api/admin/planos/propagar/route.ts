// ============================================================================
// POST /api/admin/planos/propagar — aplica o preço ATUAL de um plano SaaS
// (planos_plataforma.preco, editado em /admin/planos) às assinaturas desse plano
// no Asaas. Admin-only. Só consultorias com assinatura no gateway e plano não
// cancelado. Idempotente: PUT do mesmo valor não muda nada.
//
// Body: { slug }
// Resposta: { ok, slug, preco, total, atualizadas, falhas[] }
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { guardAdmin } from "@/lib/apiAdmin";
import { createAdminClient } from "@/utils/supabase/admin";
import { atualizarValorAssinatura, AsaasError } from "@/lib/asaas";
import { fetchPlanoSaaS } from "@/lib/planosPlataforma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const negado = await guardAdmin();
  if (negado) return negado;
  if (!asaasEnabled) {
    return NextResponse.json({ erro: "gateway não configurado" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { slug?: string };
  const slug = body.slug?.trim().toLowerCase();
  if (!slug) return NextResponse.json({ erro: "slug ausente" }, { status: 400 });

  const admin = createAdminClient();
  const plano = await fetchPlanoSaaS(admin, slug);
  if (!plano) return NextResponse.json({ erro: "plano não encontrado" }, { status: 404 });

  const { data: cons, error } = await admin
    .from("consultorias")
    .select("id, asaas_subscription_id, plano_status")
    .eq("plano", slug)
    .not("asaas_subscription_id", "is", null)
    .neq("plano_status", "cancelado");
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const alvo = (cons ?? []).filter((c) => !!c.asaas_subscription_id);
  const falhas: { consultoriaId: string; erro: string }[] = [];
  let atualizadas = 0;
  for (const c of alvo) {
    try {
      await atualizarValorAssinatura(c.asaas_subscription_id as string, plano.preco);
      atualizadas++;
    } catch (e) {
      falhas.push({
        consultoriaId: c.id,
        erro:
          e instanceof AsaasError
            ? `gateway ${e.status}`
            : e instanceof Error
              ? e.message
              : "falha",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    slug,
    preco: plano.preco,
    total: alvo.length,
    atualizadas,
    falhas,
  });
}

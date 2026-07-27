// ============================================================================
// /api/admin/asaas/webhook — registra/consulta o webhook do Asaas (conta master).
//
//   GET  → lista os webhooks cadastrados + diz se o nosso já está lá.
//   POST → registra o webhook apontando para <url>/api/webhooks/asaas com o
//          authToken = ASAAS_WEBHOOK_TOKEN e os eventos que o handler trata.
//          Idempotente: se já existe um webhook pra essa URL, devolve ele.
//
// A URL precisa ser PÚBLICA (o Asaas chama de fora) — em body.url, ou na env
// ASAAS_WEBHOOK_URL, ou derivada do host da requisição. localhost não funciona
// (o Asaas não alcança) → devolve aviso.
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { guardAdmin } from "@/lib/apiAdmin";
import { listarWebhooks, registrarWebhook, AsaasError } from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Eventos que o handler /api/webhooks/asaas processa hoje.
const EVENTOS = [
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "PAYMENT_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
  "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
];

function resolverUrl(request: Request, bodyUrl?: string): string {
  const bruto =
    bodyUrl?.trim() ||
    process.env.ASAAS_WEBHOOK_URL ||
    new URL(request.url).origin + "/api/webhooks/asaas";
  // Garante o path do handler.
  return /\/api\/webhooks\/asaas$/.test(bruto)
    ? bruto
    : bruto.replace(/\/$/, "") + "/api/webhooks/asaas";
}

const ehLocal = (u: string) => /localhost|127\.0\.0\.1|\[::1\]/.test(u);

export async function GET() {
  const negado = await guardAdmin();
  if (negado) return negado;
  if (!asaasEnabled) {
    return NextResponse.json({ erro: "Asaas não configurado" }, { status: 503 });
  }
  try {
    const { data } = await listarWebhooks();
    return NextResponse.json({
      ok: true,
      tokenConfigurado: !!process.env.ASAAS_WEBHOOK_TOKEN,
      webhooks: (data ?? []).map((w) => ({
        id: w.id,
        url: w.url,
        enabled: w.enabled ?? true,
        events: w.events ?? [],
      })),
    });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[admin/asaas/webhook GET] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao listar webhooks" },
      { status }
    );
  }
}

export async function POST(request: Request) {
  const negado = await guardAdmin();
  if (negado) return negado;
  if (!asaasEnabled) {
    return NextResponse.json({ erro: "Asaas não configurado" }, { status: 503 });
  }
  const token = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!token) {
    return NextResponse.json(
      { erro: "defina ASAAS_WEBHOOK_TOKEN no .env antes de registrar o webhook" },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { url?: string };
  const url = resolverUrl(request, body.url);

  try {
    // Idempotência: se já existe um webhook pra essa URL, não duplica.
    const { data } = await listarWebhooks();
    const existente = (data ?? []).find((w) => w.url === url);
    if (existente) {
      return NextResponse.json({
        ok: true,
        jaExistia: true,
        webhook: { id: existente.id, url: existente.url, enabled: existente.enabled ?? true },
        aviso: ehLocal(url)
          ? "URL local — o Asaas não alcança localhost. Use um domínio público ou túnel (ngrok)."
          : undefined,
      });
    }

    const criado = await registrarWebhook({
      name: "Revo",
      url,
      authToken: token,
      events: EVENTOS,
      sendType: "SEQUENTIALLY",
    });
    return NextResponse.json({
      ok: true,
      webhook: { id: (criado as { id?: string }).id ?? null, url, enabled: true },
      aviso: ehLocal(url)
        ? "Webhook registrado, mas a URL é local — o Asaas não alcança localhost. Use domínio público ou túnel (ngrok) e registre de novo."
        : undefined,
    });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[admin/asaas/webhook POST] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao registrar webhook" },
      { status }
    );
  }
}

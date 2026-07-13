// ============================================================================
// Webhook do Asaas — FONTE DE VERDADE dos pagamentos.
//
// O Asaas faz POST aqui a cada evento (pagamento confirmado, recebido, vencido,
// subconta aprovada...). A liberação de acesso acontece AQUI, no servidor —
// nunca no retorno do front (o navegador é cliente não confiável e PIX/boleto
// compensam de forma assíncrona).
//
// Garantias implementadas:
//   • Autenticidade: valida o header `asaas-access-token` (ASAAS_WEBHOOK_TOKEN).
//   • Idempotência: cada evento tem id; grava em webhook_events e ignora repetido.
//   • Resposta rápida: escreve no banco (via service_role) e devolve 200.
//   • Reprocessamento: em falha devolve 5xx (o Asaas reenvia) sem marcar como
//     processado, então a retentativa refaz o trabalho.
//
// Config no painel/na API do Asaas: apontar o webhook para
//   https://SEU-DOMINIO/api/webhooks/asaas
// com authToken = ASAAS_WEBHOOK_TOKEN e sendType = SEQUENTIALLY.
// ============================================================================
import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

/** externalReference no padrão "saas:<consultoriaId>" | "mensalidade:<alunoId>". */
function parseRef(ref?: string): { fluxo: "saas" | "mensalidade" | null; id: string | null } {
  if (!ref) return { fluxo: null, id: null };
  const [tipo, id] = ref.split(":");
  if (tipo === "saas") return { fluxo: "saas", id: id ?? null };
  if (tipo === "mensalidade") return { fluxo: "mensalidade", id: id ?? null };
  return { fluxo: null, id: null };
}

/** Taxa efetiva (%) da consultoria: override do coach → global → fallback 10. */
async function resolverTaxa(admin: SupabaseAdmin, consultoriaId: string): Promise<number> {
  const { data: cons } = await admin
    .from("consultorias")
    .select("taxa_plataforma_pct")
    .eq("id", consultoriaId)
    .maybeSingle();
  if (cons?.taxa_plataforma_pct != null) return Number(cons.taxa_plataforma_pct);
  const { data: cfg } = await admin
    .from("plataforma_config")
    .select("taxa_plataforma_pct")
    .eq("id", 1)
    .maybeSingle();
  return Number(cfg?.taxa_plataforma_pct ?? 10);
}

/**
 * Fatia da plataforma sobre uma cobrança do aluno. O split do Asaas repassa
 * (100 − taxa)% do LÍQUIDO (após a taxa do gateway) ao coach; a plataforma
 * retém taxa% desse mesmo líquido. Usa o `split[].totalValue` real do payload
 * quando o Asaas já calculou; senão deriva de netValue × taxa (idêntico ao que
 * configuramos na cobrança). Retorna null se não dá pra calcular ainda.
 */
function calcularSplitTaxa(payment: any, netValue: number, taxa: number): number {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  // Só criamos UM recebedor no split (o coach) → o restante do líquido é da
  // plataforma. Se o payload traz o valor já calculado, usa a verdade do Asaas.
  const itens: any[] = Array.isArray(payment?.split) ? payment.split : [];
  const somaCoach = itens.reduce((s, it) => {
    const v = it?.totalValue ?? it?.totalFixedValue;
    return v != null ? s + Number(v) : s;
  }, 0);
  if (somaCoach > 0) return round2(Math.max(0, netValue - somaCoach));
  return round2(netValue * (taxa / 100));
}

async function processarPagamento(
  admin: SupabaseAdmin,
  evento: string,
  payment: any
): Promise<void> {
  if (!payment?.id) return;
  const { fluxo, id: entidadeId } = parseRef(payment.externalReference);
  const agora = new Date().toISOString();

  // Resolve o tenant + a fatia da plataforma. Para mensalidade, o
  // externalReference só traz o alunoId → buscamos a consultoria dele. Isso é
  // OBRIGATÓRIO: a RLS de leitura do coach exige `pagamentos.consultoria_id`
  // preenchido (senão o extrato/faturamento do coach vem vazio), e o admin
  // agrega a receita da plataforma por `split_taxa`.
  let consultoriaId: string | null = fluxo === "saas" ? entidadeId : null;
  let splitTaxa: number | null = null;
  const net = payment.netValue != null ? Number(payment.netValue) : null;
  if (fluxo === "mensalidade" && entidadeId) {
    const { data: al } = await admin
      .from("alunos")
      .select("consultoria_id")
      .eq("id", entidadeId)
      .maybeSingle();
    consultoriaId = (al?.consultoria_id as string) ?? null;
    if (net != null && consultoriaId) {
      const taxa = await resolverTaxa(admin, consultoriaId);
      splitTaxa = calcularSplitTaxa(payment, net, taxa);
    }
  }

  const linha: Record<string, unknown> = {
    asaas_payment_id: payment.id,
    asaas_subscription_id: payment.subscription ?? null,
    consultoria_id: consultoriaId,
    aluno_id: fluxo === "mensalidade" ? entidadeId : null,
    fluxo: fluxo ?? "saas",
    billing_type: payment.billingType ?? null,
    valor: payment.value ?? null,
    net_value: payment.netValue ?? null,
    split_taxa: splitTaxa,
    status: payment.status ?? evento,
    external_reference: payment.externalReference ?? null,
    updated_at: agora,
  };
  if (evento === "PAYMENT_CONFIRMED") linha.confirmado_em = agora;
  if (evento === "PAYMENT_RECEIVED") linha.recebido_em = agora;

  const up = await admin
    .from("pagamentos")
    .upsert(linha, { onConflict: "asaas_payment_id" });
  if (up.error) throw up.error; // falha → 500 → Asaas reenvia

  // Libera/atualiza o acesso da entidade conforme o evento.
  const liberou = evento === "PAYMENT_CONFIRMED" || evento === "PAYMENT_RECEIVED";
  const venceu = evento === "PAYMENT_OVERDUE";
  const estornou = evento === "PAYMENT_REFUNDED";

  if (fluxo === "saas" && entidadeId) {
    const novo = liberou ? "ativo" : venceu ? "inadimplente" : null;
    if (novo) {
      const r = await admin
        .from("consultorias")
        .update({ plano_status: novo })
        .eq("id", entidadeId);
      if (r.error) throw r.error;
    }
  } else if (fluxo === "mensalidade" && entidadeId) {
    const novo = liberou ? "em_dia" : venceu ? "atrasado" : estornou ? "pendente" : null;
    if (novo) {
      const r = await admin
        .from("alunos")
        .update({ status_pagamento: novo })
        .eq("id", entidadeId);
      if (r.error) throw r.error;
    }
  }
}

async function processarSubconta(
  admin: SupabaseAdmin,
  evento: string,
  account: any,
  accountStatus: any
): Promise<void> {
  const accountId = account?.id;
  if (!accountId) return;
  // A conta só está LIBERADA quando o status agregado `general` = APPROVED. As
  // aprovações parciais (COMMERCIAL_INFO/DOCUMENT/BANK_ACCOUNT_INFO) também trazem
  // "APPROVED" no nome do evento, mas NÃO liberam — por isso decidimos pelo
  // campo `general` (com fallback ao evento GENERAL_APPROVAL_*).
  const geral: string | undefined = accountStatus?.general;
  let status: string;
  if (geral) {
    status =
      geral === "APPROVED" ? "aprovado" : geral === "REJECTED" ? "reprovado" : "em_analise";
  } else {
    status = evento.includes("GENERAL_APPROVAL_APPROVED")
      ? "aprovado"
      : evento.includes("GENERAL_APPROVAL_REJECTED")
        ? "reprovado"
        : "em_analise";
  }
  const r = await admin
    .from("consultorias")
    .update({ asaas_onboarding_status: status })
    .eq("asaas_account_id", accountId);
  if (r.error) throw r.error;
}

export async function POST(request: Request) {
  // 1) Autenticidade: token compartilhado no header (o Asaas não assina o corpo).
  const tokenEsperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!tokenEsperado) {
    // Misconfiguração do servidor — não aceitar eventos "às cegas".
    return NextResponse.json({ erro: "webhook não configurado" }, { status: 500 });
  }
  const tokenRecebido = request.headers.get("asaas-access-token");
  if (tokenRecebido !== tokenEsperado) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "corpo inválido" }, { status: 400 });
  }

  const eventoId: string | undefined = body?.id;
  const eventoTipo: string | undefined = body?.event;
  if (!eventoId || !eventoTipo) {
    return NextResponse.json({ erro: "evento sem id/tipo" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 2) Idempotência: se já foi processado, sai com 200 (não refaz).
  const { data: existente, error: selErr } = await admin
    .from("webhook_events")
    .select("processado_em")
    .eq("asaas_event_id", eventoId)
    .maybeSingle();
  if (selErr) {
    // Sem consultar o ledger não dá pra garantir idempotência → 500 (reenvia).
    return NextResponse.json({ erro: "ledger indisponível" }, { status: 500 });
  }
  if (existente?.processado_em) {
    return NextResponse.json({ ok: true, duplicado: true });
  }
  if (!existente) {
    const ins = await admin.from("webhook_events").insert({
      asaas_event_id: eventoId,
      event_type: eventoTipo,
      payment_id: body?.payment?.id ?? null,
      payload: body,
    });
    if (ins.error) {
      return NextResponse.json({ erro: "falha ao registrar evento" }, { status: 500 });
    }
  }

  // 3) Processa. Em erro, devolve 500 para o Asaas reenviar (processado_em fica
  //    nulo, então a retentativa reprocessa).
  try {
    if (eventoTipo.startsWith("PAYMENT_")) {
      await processarPagamento(admin, eventoTipo, body.payment);
    } else if (eventoTipo.startsWith("ACCOUNT_STATUS")) {
      await processarSubconta(admin, eventoTipo, body.account ?? body, body.accountStatus);
    }
    // Outros eventos: só ficam registrados em webhook_events.

    await admin
      .from("webhook_events")
      .update({ processado_em: new Date().toISOString() })
      .eq("asaas_event_id", eventoId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[webhook asaas] falha ao processar", eventoTipo, e);
    return NextResponse.json({ erro: "falha ao processar" }, { status: 500 });
  }
}

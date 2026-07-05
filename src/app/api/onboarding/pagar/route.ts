// ============================================================================
// POST /api/onboarding/pagar — PÚBLICO (Fluxo 2). O ALUNO paga a mensalidade do
// coach pelo link de convite. Cria o cliente (aluno) + assinatura recorrente com
// SPLIT: o coach recebe (100 − taxa)% no walletId dele; a plataforma retém a taxa
// configurada no /admin. O token do convite identifica o coach + o valor.
//
// Sem sessão (o aluno ainda não tem conta). Usa service_role para ler o convite
// e o walletId do coach (a RLS bloquearia o anon). O token é o segredo.
//
// Body: { token, aluno: { nome, cpf, email, telefone? }, forma, cartao? }
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  garantirCliente,
  criarAssinatura,
  listarCobrancasDaAssinatura,
  obterPixQrCode,
  AsaasError,
} from "@/lib/asaas";
import { splitDoCoach } from "@/lib/plataforma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CartaoInput = {
  number: string;
  holderName: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  postalCode: string;
  addressNumber: string;
};

export async function POST(request: Request) {
  if (!asaasEnabled) {
    return NextResponse.json({ erro: "pagamento indisponível" }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    aluno?: { nome?: string; cpf?: string; email?: string; telefone?: string };
    forma?: "cartao" | "pix";
    cartao?: CartaoInput;
  };
  const token = body.token?.trim();
  const aluno = body.aluno ?? {};
  const forma: "cartao" | "pix" = body.forma === "pix" ? "pix" : "cartao";
  if (!token) return NextResponse.json({ erro: "token ausente" }, { status: 400 });
  if (!aluno.nome?.trim() || !aluno.cpf || !aluno.email?.trim()) {
    return NextResponse.json({ erro: "dados do aluno incompletos" }, { status: 400 });
  }
  if (forma === "cartao" && !body.cartao) {
    return NextResponse.json({ erro: "dados do cartão obrigatórios" }, { status: 400 });
  }

  const remoteIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined;

  const admin = createAdminClient();

  // 1) Resolve o convite (service_role — anon não passa pela RLS).
  const { data: convite } = await admin
    .from("convites")
    .select("id, consultoria_id, valor, status")
    .eq("token", token)
    .maybeSingle();
  if (!convite) return NextResponse.json({ erro: "convite inválido" }, { status: 404 });
  if (convite.status !== "pendente") {
    return NextResponse.json({ erro: "convite já utilizado" }, { status: 409 });
  }

  // 2) Coach: walletId (recebedor) + taxa efetiva (override → senão global).
  const { data: cons } = await admin
    .from("consultorias")
    .select("id, asaas_wallet_id, taxa_plataforma_pct")
    .eq("id", convite.consultoria_id)
    .maybeSingle();
  if (!cons?.asaas_wallet_id) {
    return NextResponse.json(
      { erro: "o coach ainda não ativou os recebimentos" },
      { status: 409 }
    );
  }
  const { data: cfg } = await admin
    .from("plataforma_config")
    .select("taxa_plataforma_pct")
    .eq("id", 1)
    .maybeSingle();
  const taxa =
    cons.taxa_plataforma_pct != null
      ? Number(cons.taxa_plataforma_pct)
      : Number(cfg?.taxa_plataforma_pct ?? 10);

  try {
    // 3) Cliente (aluno) no Asaas + assinatura recorrente com split.
    const cliente = await garantirCliente({
      name: aluno.nome.trim(),
      cpfCnpj: aluno.cpf.replace(/\D/g, ""),
      email: aluno.email.trim(),
      mobilePhone: (aluno.telefone || "").replace(/\D/g, "") || undefined,
      externalReference: `convite:${convite.id}`,
    });

    const c = body.cartao;
    const nextDueDate = new Date().toISOString().slice(0, 10);
    const assinatura = await criarAssinatura({
      customer: cliente.id,
      billingType: forma === "pix" ? "PIX" : "CREDIT_CARD",
      value: Number(convite.valor),
      cycle: "MONTHLY",
      nextDueDate,
      description: "Mensalidade da consultoria",
      externalReference: `convite:${convite.id}`,
      split: splitDoCoach(cons.asaas_wallet_id, taxa),
      ...(forma === "cartao" && c
        ? {
            creditCard: {
              holderName: c.holderName,
              number: c.number.replace(/\s/g, ""),
              expiryMonth: c.expiryMonth,
              expiryYear: c.expiryYear.length === 2 ? "20" + c.expiryYear : c.expiryYear,
              ccv: c.ccv,
            },
            creditCardHolderInfo: {
              name: c.holderName,
              email: aluno.email.trim(),
              cpfCnpj: aluno.cpf.replace(/\D/g, ""),
              postalCode: c.postalCode.replace(/\D/g, ""),
              addressNumber: c.addressNumber,
            },
            remoteIp,
          }
        : {}),
    });

    // 4) Guarda os ids no convite (reconciliação; conta do aluno vem na etapa 2).
    await admin
      .from("convites")
      .update({ asaas_customer_id: cliente.id, asaas_subscription_id: assinatura.id })
      .eq("id", convite.id);

    // 5) PIX: QR da 1ª cobrança.
    let pix: { copiaCola: string; qrCodeImage: string } | null = null;
    if (forma === "pix") {
      try {
        const { data } = await listarCobrancasDaAssinatura(assinatura.id);
        const primeira = data?.[0];
        if (primeira) {
          const qr = await obterPixQrCode(primeira.id);
          pix = { copiaCola: qr.payload, qrCodeImage: qr.encodedImage };
        }
      } catch {
        /* segue sem QR; o front mostra estado de aguardando */
      }
    }

    return NextResponse.json({
      ok: true,
      forma,
      subscriptionId: assinatura.id,
      customerId: cliente.id,
      taxaAplicada: taxa,
      pix,
    });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[onboarding/pagar] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao processar o pagamento" },
      { status }
    );
  }
}

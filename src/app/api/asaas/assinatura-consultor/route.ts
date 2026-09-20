// ============================================================================
// POST /api/asaas/assinatura-consultor — FLUXO 1 (Plataforma ← Consultor).
//
// Cria a assinatura recorrente do plano SaaS do consultor logado (sem split).
// O consultor vira `customer` da conta raiz; a cobrança recorrente é do plano.
// A ATIVAÇÃO do plano NÃO acontece aqui — o webhook (PAYMENT_CONFIRMED) marca
// consultorias.plano_status = 'ativo'. Aqui só criamos a assinatura no Asaas.
//
// Body (checkout transparente): { cartao: { number, holderName, expiryMonth,
//   expiryYear, ccv, holderCpf?, postalCode, addressNumber, phone? } }
//   OU { creditCardToken } para reuso. Cobrança recorrente sempre no cartão.
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  garantirCliente,
  criarAssinatura,
  listarCobrancasDaAssinatura,
  obterPixQrCode,
  AsaasError,
} from "@/lib/asaas";
import { fetchPlanoSaaS } from "@/lib/planosPlataforma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dados do cartão vindos do checkout transparente (form dentro do Revo). */
type CartaoInput = {
  number: string;
  holderName: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  holderCpf?: string; // CPF do titular (se diferente do da consultoria)
  postalCode: string; // CEP do titular (antifraude)
  addressNumber: string;
  phone?: string;
};

/**
 * Preço mensal do plano — fonte de verdade no SERVIDOR (tabela planos_plataforma,
 * editada em /admin/planos). O valor nunca vem do cliente. Plano desconhecido → 0.
 */
async function precoDoPlano(slug: string): Promise<number> {
  const plano = await fetchPlanoSaaS(createAdminClient(), slug);
  return plano?.preco ?? 0;
}

/**
 * GET — estado da assinatura SaaS do consultor logado (para o card "Minha
 * assinatura" em /configuracoes): plano, valor, status e se há assinatura no
 * Asaas (habilita trocar cartão / cancelar).
 */
export async function GET() {
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
    .select("plano, plano_status, asaas_subscription_id")
    .eq("id", prof.consultoria_id)
    .maybeSingle();
  const plano = cons?.plano ?? "free";
  return NextResponse.json({
    ok: true,
    plano,
    valor: await precoDoPlano(plano),
    planoStatus: cons?.plano_status ?? "ativo",
    temAssinatura: !!cons?.asaas_subscription_id,
  });
}

export async function POST(request: Request) {
  if (!asaasEnabled) {
    return NextResponse.json({ erro: "Asaas não configurado" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    forma?: "cartao" | "pix";
    cartao?: CartaoInput;
    creditCardToken?: string;
  };
  const forma: "cartao" | "pix" = body.forma === "pix" ? "pix" : "cartao";
  // IP REAL do pagador (não do servidor) — o Asaas usa na análise de risco.
  const remoteIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined;

  // 1) Autentica o consultor pela sessão.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  }
  const { data: prof } = await supabase
    .from("profiles")
    .select("role, consultoria_id")
    .eq("id", user.id)
    .maybeSingle();
  if (prof?.role !== "consultor" || !prof.consultoria_id) {
    return NextResponse.json({ erro: "apenas consultor" }, { status: 403 });
  }

  // 2) Lê a consultoria (o que o consultor pode ver via RLS).
  const { data: cons } = await supabase
    .from("consultorias")
    .select(
      "id, nome, nome_negocio, documento, telefone, plano, asaas_customer_id, asaas_subscription_id"
    )
    .eq("id", prof.consultoria_id)
    .maybeSingle();
  if (!cons) {
    return NextResponse.json({ erro: "consultoria não encontrada" }, { status: 404 });
  }
  if (cons.asaas_subscription_id) {
    // Já existe assinatura — evita duplicar.
    return NextResponse.json({ ok: true, subscriptionId: cons.asaas_subscription_id, jaExistia: true });
  }

  const plano = cons.plano ?? "pro";
  const valor = await precoDoPlano(plano);
  if (valor <= 0) {
    return NextResponse.json({ erro: "plano gratuito não gera cobrança" }, { status: 400 });
  }
  if (!cons.documento) {
    return NextResponse.json(
      { erro: "consultoria sem CPF/CNPJ (documento) — necessário para cobrar" },
      { status: 400 }
    );
  }
  // No cartão exige os dados (1ª vez) ou um token já salvo. No PIX não.
  if (forma === "cartao" && !body.cartao && !body.creditCardToken) {
    return NextResponse.json(
      { erro: "dados do cartão são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    // 3) Garante o cliente Asaas (reusa por CPF/CNPJ) e cria a assinatura.
    let customerId = cons.asaas_customer_id;
    if (!customerId) {
      const cliente = await garantirCliente({
        name: cons.nome_negocio || cons.nome,
        cpfCnpj: cons.documento,
        email: user.email ?? undefined,
        mobilePhone: cons.telefone ?? undefined,
        externalReference: `consultoria:${cons.id}`,
      });
      customerId = cliente.id;
    }

    // Monta o cartão + dados do titular (só quando veio cartão, não token).
    const creditCard = body.cartao
      ? {
          holderName: body.cartao.holderName,
          number: body.cartao.number.replace(/\s/g, ""),
          expiryMonth: body.cartao.expiryMonth,
          expiryYear: body.cartao.expiryYear,
          ccv: body.cartao.ccv,
        }
      : undefined;
    const creditCardHolderInfo = body.cartao
      ? {
          name: body.cartao.holderName,
          email: user.email ?? "",
          cpfCnpj: (body.cartao.holderCpf || cons.documento).replace(/\D/g, ""),
          postalCode: body.cartao.postalCode.replace(/\D/g, ""),
          addressNumber: body.cartao.addressNumber,
          phone: body.cartao.phone || cons.telefone || undefined,
        }
      : undefined;

    const nextDueDate = new Date().toISOString().slice(0, 10); // 1ª cobrança hoje
    const assinatura = await criarAssinatura({
      customer: customerId,
      billingType: forma === "pix" ? "PIX" : "CREDIT_CARD",
      value: valor,
      cycle: "MONTHLY",
      nextDueDate,
      description: `Revo — plano ${plano}`,
      externalReference: `saas:${cons.id}`,
      ...(forma === "cartao"
        ? { creditCard, creditCardHolderInfo, creditCardToken: body.creditCardToken, remoteIp }
        : {}),
    });

    // 4) Persiste os ids via service_role (colunas asaas_* fora do grant do user).
    const admin = createAdminClient();
    await admin
      .from("consultorias")
      .update({ asaas_customer_id: customerId, asaas_subscription_id: assinatura.id })
      .eq("id", cons.id);

    // No PIX, busca o QR da 1ª cobrança gerada pela assinatura (copia-e-cola).
    let pix: { copiaCola: string; qrCodeImage: string } | null = null;
    if (forma === "pix") {
      try {
        const { data } = await listarCobrancasDaAssinatura(assinatura.id);
        const primeira = data?.[0];
        if (primeira) {
          const qr = await obterPixQrCode(primeira.id);
          pix = { copiaCola: qr.payload, qrCodeImage: qr.encodedImage };
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[assinatura-consultor] falha ao obter QR pix", err);
      }
    }

    return NextResponse.json({
      ok: true,
      forma,
      subscriptionId: assinatura.id,
      customerId,
      status: assinatura.status,
      pix,
    });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[assinatura-consultor] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao criar assinatura" },
      { status }
    );
  }
}

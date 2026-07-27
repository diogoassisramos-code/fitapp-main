// ============================================================================
// POST /api/aluno/assinatura/cartao — o ALUNO troca o cartão da própria
// mensalidade pelo APP MOBILE. Como o app fala direto com o Supabase (sem
// cookies), autentica por Bearer token (JWT do Supabase no header Authorization);
// cai pra sessão via cookie se vier do próprio dashboard. Checkout transparente:
// os dados do cartão vão app → servidor → Asaas (nunca persistidos aqui além do
// final/bandeira). CORS liberado porque o app roda em outra origem.
//
// Body: { cartao: { number, holderName, expiryMonth, expiryYear, ccv,
//   holderCpf?, postalCode, addressNumber, phone? } }
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { atualizarCartaoAssinatura, AsaasError } from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status, headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

type CartaoInput = {
  number: string;
  holderName: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  holderCpf?: string;
  postalCode: string;
  addressNumber: string;
  phone?: string;
};

/** Bandeira a partir do BIN (fallback quando o Asaas não devolve a brand). */
function bandeiraDoNumero(n: string): string {
  if (/^4/.test(n)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^(4011|43[89]|45[17]|504175|5067|509|627780|636297|636368|650|6516|6550)/.test(n)) return "Elo";
  if (/^(606282|3841)/.test(n)) return "Hipercard";
  return "Cartão";
}

export async function POST(request: Request) {
  if (!asaasEnabled) {
    return json(503, { erro: "pagamento indisponível" });
  }

  const body = (await request.json().catch(() => ({}))) as { cartao?: CartaoInput };
  const c = body.cartao;
  if (!c?.number || !c.holderName || !c.expiryMonth || !c.expiryYear || !c.ccv) {
    return json(400, { erro: "dados do cartão incompletos" });
  }
  if (!c.postalCode || !c.addressNumber) {
    return json(400, { erro: "CEP e número do endereço são obrigatórios" });
  }

  const remoteIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined;

  // 1) Autentica: Bearer (app mobile) ou cookie (dashboard).
  const authz = request.headers.get("authorization") || "";
  const bearer = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : null;
  const admin = createAdminClient();
  let userId: string | null = null;
  if (bearer) {
    const { data } = await admin.auth.getUser(bearer);
    userId = data.user?.id ?? null;
  } else {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  }
  if (!userId) return json(401, { erro: "não autenticado" });

  // 2) Resolve o aluno pela conta (profiles.aluno_id).
  const { data: prof } = await admin
    .from("profiles")
    .select("role, aluno_id")
    .eq("id", userId)
    .maybeSingle();
  if (prof?.role !== "aluno" || !prof.aluno_id) {
    return json(403, { erro: "apenas aluno" });
  }
  const { data: al } = await admin
    .from("alunos")
    .select("id, asaas_subscription_id, cpf, email, telefone")
    .eq("id", prof.aluno_id)
    .maybeSingle();
  if (!al?.asaas_subscription_id) {
    return json(409, { erro: "você não tem assinatura no cartão para trocar" });
  }

  try {
    const numDigits = c.number.replace(/\D/g, "");
    const anoCurto = c.expiryYear.length === 2 ? c.expiryYear : c.expiryYear.slice(-2);
    const assinatura = await atualizarCartaoAssinatura(al.asaas_subscription_id as string, {
      creditCard: {
        holderName: c.holderName,
        number: numDigits,
        expiryMonth: c.expiryMonth,
        expiryYear: c.expiryYear.length === 2 ? "20" + c.expiryYear : c.expiryYear,
        ccv: c.ccv,
      },
      creditCardHolderInfo: {
        name: c.holderName,
        email: (al.email as string) || "",
        cpfCnpj: (c.holderCpf || (al.cpf as string) || "").replace(/\D/g, ""),
        postalCode: c.postalCode.replace(/\D/g, ""),
        addressNumber: c.addressNumber,
        mobilePhone: (c.phone || (al.telefone as string) || "").replace(/\D/g, "") || undefined,
      },
      remoteIp,
    });

    // Atualiza o cartão PARCIAL exibido no app (nunca o número completo).
    const brand =
      (assinatura as unknown as { creditCard?: { creditCardBrand?: string } }).creditCard
        ?.creditCardBrand || bandeiraDoNumero(numDigits);
    await admin
      .from("alunos")
      .update({
        cartao_final: numDigits.slice(-4),
        cartao_bandeira: brand,
        cartao_titular: c.holderName,
        cartao_validade: `${String(c.expiryMonth).padStart(2, "0")}/${anoCurto}`,
      })
      .eq("id", al.id);

    return json(200, { ok: true, final: numDigits.slice(-4), bandeira: brand });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[aluno/assinatura/cartao] falha", e);
    return json(status, { erro: e instanceof Error ? e.message : "falha ao trocar o cartão" });
  }
}

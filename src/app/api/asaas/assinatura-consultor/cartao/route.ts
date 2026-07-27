// ============================================================================
// POST /api/asaas/assinatura-consultor/cartao — o CONSULTOR troca o cartão da
// própria assinatura SaaS. Checkout transparente: os dados do cartão trafegam do
// form → servidor → Asaas (nunca são persistidos aqui). `updatePendingPayments`
// faz as cobranças pendentes/vencidas reprocessarem no novo cartão.
//
// Body: { cartao: { number, holderName, expiryMonth, expiryYear, ccv,
//   holderCpf?, postalCode, addressNumber, phone? } }
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { createClient } from "@/utils/supabase/server";
import { atualizarCartaoAssinatura, AsaasError } from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function POST(request: Request) {
  if (!asaasEnabled) {
    return NextResponse.json({ erro: "Asaas não configurado" }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as { cartao?: CartaoInput };
  const c = body.cartao;
  if (!c?.number || !c.holderName || !c.expiryMonth || !c.expiryYear || !c.ccv) {
    return NextResponse.json({ erro: "dados do cartão incompletos" }, { status: 400 });
  }
  if (!c.postalCode || !c.addressNumber) {
    return NextResponse.json(
      { erro: "CEP e número do endereço são obrigatórios" },
      { status: 400 }
    );
  }

  const remoteIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined;

  // 1) Autentica o consultor.
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
    .select("documento, telefone, asaas_subscription_id")
    .eq("id", prof.consultoria_id)
    .maybeSingle();
  if (!cons?.asaas_subscription_id) {
    return NextResponse.json({ erro: "sem assinatura ativa para trocar o cartão" }, { status: 409 });
  }

  try {
    const r = await atualizarCartaoAssinatura(cons.asaas_subscription_id as string, {
      creditCard: {
        holderName: c.holderName,
        number: c.number.replace(/\s/g, ""),
        expiryMonth: c.expiryMonth,
        expiryYear: c.expiryYear.length === 2 ? "20" + c.expiryYear : c.expiryYear,
        ccv: c.ccv,
      },
      creditCardHolderInfo: {
        name: c.holderName,
        email: user.email ?? "",
        cpfCnpj: (c.holderCpf || (cons.documento as string) || "").replace(/\D/g, ""),
        postalCode: c.postalCode.replace(/\D/g, ""),
        addressNumber: c.addressNumber,
        phone: c.phone || (cons.telefone as string) || undefined,
      },
      remoteIp,
    });
    return NextResponse.json({ ok: true, status: r.status });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[assinatura-consultor/cartao] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao trocar o cartão" },
      { status }
    );
  }
}

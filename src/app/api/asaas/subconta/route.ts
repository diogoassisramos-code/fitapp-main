// ============================================================================
// POST /api/asaas/subconta — FLUXO 2 (marketplace): torna o consultor logado um
// RECEBEDOR no Asaas (subconta). Devolve o walletId (destino do split) e a
// onboardingUrl (KYC). A apiKey da subconta é retornada UMA vez pelo Asaas —
// guardamos cifrada idealmente; por ora em texto (sandbox).
//
// Requisitos (produção): conta raiz PJ (CNPJ) + White Label habilitado pelo
// gerente Asaas. A aprovação do KYC chega pelo webhook ACCOUNT_STATUS.
//
// Body: { incomeValue, address, addressNumber, province, postalCode, companyType? }
//   (dados de recebimento do coach; no MVP têm defaults de teste).
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { criarSubconta, AsaasError } from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!asaasEnabled) {
    return NextResponse.json({ erro: "Asaas não configurado" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    cpfCnpj?: string;
    mobilePhone?: string;
    birthDate?: string;
    incomeValue?: number;
    address?: string;
    addressNumber?: string;
    province?: string;
    postalCode?: string;
    companyType?: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
  };

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

  // 2) Dados da consultoria.
  const { data: cons } = await supabase
    .from("consultorias")
    .select("id, nome, nome_negocio, documento, telefone, asaas_account_id, asaas_wallet_id, asaas_onboarding_status")
    .eq("id", prof.consultoria_id)
    .maybeSingle();
  if (!cons) return NextResponse.json({ erro: "consultoria não encontrada" }, { status: 404 });
  if (cons.asaas_account_id && cons.asaas_wallet_id) {
    return NextResponse.json({
      ok: true,
      jaExistia: true,
      accountId: cons.asaas_account_id,
      walletId: cons.asaas_wallet_id,
      onboardingStatus: cons.asaas_onboarding_status,
    });
  }
  // CPF/CNPJ e celular: preferir o que veio do formulário; senão o do cadastro.
  const cpfCnpj = (body.cpfCnpj || cons.documento || "").replace(/\D/g, "");
  const mobilePhone = (body.mobilePhone || cons.telefone || "").replace(/\D/g, "");
  const pessoaFisica = body.companyType === "INDIVIDUAL";
  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
    return NextResponse.json({ erro: "informe um CPF ou CNPJ válido" }, { status: 400 });
  }
  if (mobilePhone.length < 10) {
    return NextResponse.json({ erro: "informe um celular válido" }, { status: 400 });
  }
  if (!body.address?.trim() || !body.addressNumber?.trim() || !body.province?.trim() || !body.postalCode) {
    return NextResponse.json({ erro: "endereço incompleto" }, { status: 400 });
  }
  // E-mail de recebimento: o informado no form ou o de login. Precisa ser ÚNICO
  // no Asaas (não pode colidir com a conta raiz nem com outra subconta).
  const email = (body.email || user.email || "").trim();
  if (!/.+@.+\..+/.test(email)) {
    return NextResponse.json({ erro: "informe um e-mail de recebimento válido" }, { status: 400 });
  }

  try {
    const subconta = await criarSubconta({
      name: cons.nome_negocio || cons.nome,
      email,
      cpfCnpj,
      mobilePhone,
      birthDate: pessoaFisica ? body.birthDate || undefined : undefined,
      incomeValue: body.incomeValue ?? 5000,
      address: body.address.trim(),
      addressNumber: body.addressNumber.trim(),
      province: body.province.trim(),
      postalCode: body.postalCode.replace(/\D/g, ""),
      companyType: body.companyType,
    });

    // 3) Persiste ids/chave via service_role.
    const admin = createAdminClient();
    await admin
      .from("consultorias")
      .update({
        asaas_account_id: subconta.id,
        asaas_wallet_id: subconta.walletId,
        asaas_subaccount_key: subconta.apiKey ?? null,
        asaas_onboarding_status: "em_analise",
      })
      .eq("id", cons.id);

    return NextResponse.json({
      ok: true,
      accountId: subconta.id,
      walletId: subconta.walletId,
      onboardingUrl: subconta.onboardingUrl,
      onboardingStatus: "em_analise",
    });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[subconta] falha", e);
    // Mensagem amigável para o caso comum de e-mail/CPF/CNPJ já usados no Asaas.
    const bruto = e instanceof AsaasError ? JSON.stringify(e.detalhes) : "";
    if (/em uso/i.test(bruto)) {
      const oque = /email/i.test(bruto)
        ? "Esse e-mail já tem uma conta no Asaas — use outro e-mail de recebimento."
        : /cnpj/i.test(bruto)
          ? "Esse CNPJ já tem uma conta de recebimento no Asaas."
          : "Esse CPF já tem uma conta de recebimento no Asaas.";
      return NextResponse.json({ erro: oque }, { status: 409 });
    }
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao criar subconta" },
      { status }
    );
  }
}

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
  if (!cons.documento) {
    return NextResponse.json({ erro: "consultoria sem CPF/CNPJ (documento)" }, { status: 400 });
  }

  try {
    const subconta = await criarSubconta({
      name: cons.nome_negocio || cons.nome,
      email: user.email ?? "",
      cpfCnpj: cons.documento.replace(/\D/g, ""),
      mobilePhone: (cons.telefone || "").replace(/\D/g, "") || "11999999999",
      incomeValue: body.incomeValue ?? 5000,
      address: body.address ?? "Rua Teste",
      addressNumber: body.addressNumber ?? "100",
      province: body.province ?? "Centro",
      postalCode: (body.postalCode ?? "01001000").replace(/\D/g, ""),
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
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao criar subconta" },
      { status }
    );
  }
}

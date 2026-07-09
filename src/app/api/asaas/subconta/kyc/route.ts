// ============================================================================
// GET /api/asaas/subconta/kyc — estado da verificação (KYC) da subconta do coach.
//
// Passo que faltava no Fluxo 2: depois de criar a subconta (POST /accounts), o
// titular precisa enviar DOCUMENTO de identificação + SELFIE com prova de vida.
// Essa jornada é HOSPEDADA pelo Asaas (onboardingUrl). Aqui a gente:
//   1) consulta os documentos pendentes da subconta (autenticando com a apiKey dela);
//   2) extrai o onboardingUrl e gera um QR pra abrir no celular (a selfie precisa da câmera);
//   3) consulta o status agregado (general=APPROVED = conta liberada);
//   4) persiste link/status e devolve tudo pro card do /financeiro.
//
// Idempotente: pode ser chamado quantas vezes o front quiser (polling leve).
// ============================================================================
import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  listarDocumentosSubconta,
  onboardingUrlDosDocumentos,
  statusSubconta,
  AsaasError,
} from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!asaasEnabled) {
    return NextResponse.json({ erro: "Asaas não configurado" }, { status: 503 });
  }

  // 1) Autentica o consultor e resolve a consultoria.
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
  // Não selecionamos asaas_onboarding_url aqui de propósito: o link é sempre
  // recalculado do Asaas a cada chamada (fonte de verdade), então a coluna é só
  // um cache best-effort — assim a rota não quebra se a migration ainda não rodou.
  const { data: cons } = await supabase
    .from("consultorias")
    .select("id, asaas_subaccount_key, asaas_onboarding_status")
    .eq("id", prof.consultoria_id)
    .maybeSingle();
  if (!cons) return NextResponse.json({ erro: "consultoria não encontrada" }, { status: 404 });

  const key = cons.asaas_subaccount_key as string | null;
  if (!key) {
    return NextResponse.json({ erro: "subconta ainda não criada" }, { status: 409 });
  }

  try {
    // 2) Status agregado — o webhook também mantém isso, mas consultar aqui deixa
    //    a UI responsiva (e cobre o caso do webhook não estar configurado ainda).
    let statusOnb = (cons.asaas_onboarding_status as string) || "em_analise";
    let geral: string | null = null;
    try {
      const st = await statusSubconta(key);
      geral = st.general ?? null;
      if (geral === "APPROVED") statusOnb = "aprovado";
      else if (geral === "REJECTED") statusOnb = "reprovado";
      else if (statusOnb === "nao_iniciado") statusOnb = "em_analise";
    } catch {
      /* status pode não estar pronto logo após a criação — segue */
    }

    // 3) Documentos pendentes → onboardingUrl (documento + selfie/liveness).
    let onboardingUrl: string | null = null;
    let documentos: { type: string; status: string; title?: string }[] = [];
    try {
      const docs = await listarDocumentosSubconta(key);
      documentos = (docs.data ?? []).map((d) => ({
        type: d.type,
        status: d.status,
        title: d.title,
      }));
      const url = onboardingUrlDosDocumentos(docs);
      if (url) onboardingUrl = url;
    } catch {
      /* ~15s após criar a conta os documentos ainda podem não existir */
    }

    // 4) Persiste o que mudou (via service_role, idempotente).
    const admin = createAdminClient();
    if (statusOnb !== cons.asaas_onboarding_status) {
      await admin
        .from("consultorias")
        .update({ asaas_onboarding_status: statusOnb })
        .eq("id", cons.id);
    }
    if (onboardingUrl) {
      // Cache best-effort do link — ignora se a coluna ainda não existe
      // (migration schema_pagamentos.sql pendente).
      const { error } = await admin
        .from("consultorias")
        .update({ asaas_onboarding_url: onboardingUrl })
        .eq("id", cons.id);
      if (error) {
        // eslint-disable-next-line no-console
        console.warn(
          "[subconta/kyc] asaas_onboarding_url não persistido (rode a migration)",
          error.message
        );
      }
    }

    // QR do link — a selfie/liveness roda melhor no celular; o coach aponta a câmera.
    const qrCodeDataUrl = onboardingUrl
      ? await QRCode.toDataURL(onboardingUrl, { margin: 1, width: 240 })
      : null;

    // "pronto" = já dá pra mostrar algo acionável (link) ou já aprovou.
    const pronto = statusOnb === "aprovado" || !!onboardingUrl;

    return NextResponse.json({
      ok: true,
      status: statusOnb,
      geral,
      onboardingUrl,
      qrCodeDataUrl,
      documentos,
      pronto,
    });
  } catch (e) {
    const httpStatus = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[subconta/kyc] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao consultar verificação" },
      { status: httpStatus }
    );
  }
}

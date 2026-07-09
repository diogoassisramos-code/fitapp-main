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
  //    Tolera a migration do plano_id ainda não ter rodado: se a coluna não
  //    existir, refaz o SELECT sem ela (o vínculo de plano fica nulo).
  type ConviteRow = {
    id: string;
    consultoria_id: string;
    valor: number;
    status: string;
    aluno_id: string | null;
    plano_id?: string | null;
  };
  const comPlano = await admin
    .from("convites")
    .select("id, consultoria_id, valor, status, aluno_id, plano_id")
    .eq("token", token)
    .maybeSingle();
  let convite = comPlano.data as ConviteRow | null;
  if (comPlano.error) {
    const semPlano = await admin
      .from("convites")
      .select("id, consultoria_id, valor, status, aluno_id")
      .eq("token", token)
      .maybeSingle();
    convite = semPlano.data as ConviteRow | null;
  }
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
    const cpfDigits = aluno.cpf.replace(/\D/g, "");

    // 3a) Cria (ou reusa) a linha do ALUNO no tenant do coach — a conta de acesso
    //     é criada depois (passo senha), referenciando este aluno_id.
    let alunoId = convite.aluno_id as string | null;
    if (!alunoId) {
      const alunoRow: Record<string, unknown> = {
        consultoria_id: convite.consultoria_id,
        nome: aluno.nome.trim(),
        cpf: cpfDigits,
        email: aluno.email.trim(),
        telefone: aluno.telefone || null,
        status_pagamento: "novo",
        plano_id: convite.plano_id ?? null,
      };
      let ins = await admin.from("alunos").insert(alunoRow).select("id").single();
      // Tolera banco sem a coluna `telefone` (migration antiga): refaz sem ela.
      if (ins.error && /telefone/.test(ins.error.message ?? "")) {
        delete alunoRow.telefone;
        ins = await admin.from("alunos").insert(alunoRow).select("id").single();
      }
      if (ins.error) {
        // provável conflito de CPF único no tenant → reusa o aluno existente.
        const { data: existente } = await admin
          .from("alunos")
          .select("id")
          .eq("consultoria_id", convite.consultoria_id)
          .eq("cpf", cpfDigits)
          .maybeSingle();
        if (!existente) throw ins.error;
        alunoId = existente.id;
      } else {
        alunoId = ins.data.id;
      }
    }

    // 3b) Cliente (aluno) no Asaas + assinatura recorrente com split.
    const cliente = await garantirCliente({
      name: aluno.nome.trim(),
      cpfCnpj: cpfDigits,
      email: aluno.email.trim(),
      mobilePhone: (aluno.telefone || "").replace(/\D/g, "") || undefined,
      externalReference: `aluno:${alunoId}`,
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
      // O webhook usa isto para marcar alunos.status_pagamento = em_dia.
      externalReference: `mensalidade:${alunoId}`,
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
              cpfCnpj: cpfDigits,
              postalCode: c.postalCode.replace(/\D/g, ""),
              addressNumber: c.addressNumber,
              // Asaas exige o telefone (com DDD) do titular do cartão.
              mobilePhone: (aluno.telefone || "").replace(/\D/g, "") || undefined,
            },
            remoteIp,
          }
        : {}),
    });

    // 4) Vincula tudo: aluno recebe os ids do Asaas; convite fica "usado".
    //    Atualiza nome/e-mail para os do comprador atual (no caminho de reuso por
    //    CPF a linha guardava dados antigos — isso mantém coerência e faz o guard
    //    de e-mail do /vincular casar). plano_id só é (re)gravado quando há plano.
    await admin
      .from("alunos")
      .update({
        nome: aluno.nome.trim(),
        email: aluno.email.trim(),
        asaas_customer_id: cliente.id,
        asaas_subscription_id: assinatura.id,
        ...(convite.plano_id ? { plano_id: convite.plano_id } : {}),
      })
      .eq("id", alunoId);
    await admin
      .from("convites")
      .update({
        aluno_id: alunoId,
        asaas_customer_id: cliente.id,
        asaas_subscription_id: assinatura.id,
        status: "usado",
        used_at: new Date().toISOString(),
      })
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
      alunoId,
      consultoriaId: convite.consultoria_id,
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

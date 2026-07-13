// ============================================================================
// /api/admin/asaas/transferencias — saques da conta MASTER (plataforma). Admin.
//
//   GET  → histórico de transferências/saques (Asaas /transfers).
//   POST → solicita um saque via PIX da conta master para uma chave PIX.
//
// O POST movimenta dinheiro real e é IRREVERSÍVEL. Exige:
//   • admin (guardAdmin);
//   • body.confirmar === true (dupla confirmação explícita do cliente);
//   • valor > 0 e chave PIX presente.
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { guardAdmin } from "@/lib/apiAdmin";
import {
  listarTransferencias,
  criarTransferenciaPix,
  saldoMaster,
  AsaasError,
  type PixKeyType,
} from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS_PIX: PixKeyType[] = ["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"];

export async function GET() {
  const negado = await guardAdmin();
  if (negado) return negado;
  if (!asaasEnabled) {
    return NextResponse.json({ erro: "Asaas não configurado" }, { status: 503 });
  }
  try {
    const r = await listarTransferencias({ limit: 30 });
    const saques = (r.data ?? []).map((t) => ({
      id: t.id,
      status: t.status,
      valor: Number(t.value ?? 0),
      valorLiquido: t.netValue != null ? Number(t.netValue) : null,
      taxa: t.transferFee != null ? Number(t.transferFee) : null,
      tipo: t.operationType ?? "",
      criadoEm: t.dateCreated ?? "",
      efetivadoEm: t.effectiveDate ?? "",
      descricao: t.description ?? "",
    }));
    return NextResponse.json({ ok: true, saques });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[admin/asaas/transferencias GET] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao listar saques" },
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

  const body = (await request.json().catch(() => ({}))) as {
    valor?: number;
    chavePix?: string;
    tipoChave?: string;
    descricao?: string;
    confirmar?: boolean;
  };

  // Dupla confirmação explícita: o cliente precisa mandar confirmar:true.
  if (body.confirmar !== true) {
    return NextResponse.json(
      { erro: "confirmação explícita necessária (confirmar:true)" },
      { status: 400 }
    );
  }
  const valor = Number(body.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ erro: "valor inválido" }, { status: 400 });
  }
  const chavePix = (body.chavePix ?? "").trim();
  if (!chavePix) {
    return NextResponse.json({ erro: "chave PIX obrigatória" }, { status: 400 });
  }
  const tipoChave =
    body.tipoChave && TIPOS_PIX.includes(body.tipoChave as PixKeyType)
      ? (body.tipoChave as PixKeyType)
      : undefined;

  try {
    // Guarda de saldo: não tenta sacar mais do que há disponível na conta master.
    const { balance } = await saldoMaster();
    if (valor > Number(balance ?? 0)) {
      return NextResponse.json(
        { erro: `saldo insuficiente (disponível R$ ${Number(balance ?? 0).toFixed(2)})` },
        { status: 409 }
      );
    }

    const t = await criarTransferenciaPix({
      value: valor,
      pixAddressKey: chavePix,
      pixAddressKeyType: tipoChave,
      description: body.descricao?.trim() || "Saque Revo (conta master)",
    });
    return NextResponse.json({
      ok: true,
      saque: {
        id: t.id,
        status: t.status,
        valor: Number(t.value ?? valor),
        valorLiquido: t.netValue != null ? Number(t.netValue) : null,
        taxa: t.transferFee != null ? Number(t.transferFee) : null,
      },
    });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[admin/asaas/transferencias POST] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao solicitar saque" },
      { status }
    );
  }
}

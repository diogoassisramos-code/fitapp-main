// ============================================================================
// POST /api/asaas/sacar — o CONSULTOR saca o saldo da PRÓPRIA subconta via PIX,
// para a chave PIX cadastrada em Configurações → Recebimento. Usa a apiKey da
// subconta (o dinheiro do split cai na wallet dele). Movimenta dinheiro real e
// é IRREVERSÍVEL — exige confirmar:true e guarda de saldo.
//
// Body: { valor, confirmar, chavePix?, tipoChave? }
//   (chavePix ausente = usa consultorias.saque_pix)
// ============================================================================
import { NextResponse } from "next/server";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { createClient } from "@/utils/supabase/server";
import {
  saldoSubconta,
  criarTransferenciaPix,
  AsaasError,
  type PixKeyType,
} from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS_PIX: PixKeyType[] = ["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"];

export async function POST(request: Request) {
  if (!asaasEnabled) {
    return NextResponse.json({ erro: "Asaas não configurado" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    valor?: number;
    confirmar?: boolean;
    chavePix?: string;
    tipoChave?: string;
  };
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
    .select("asaas_subaccount_key, saque_pix")
    .eq("id", prof.consultoria_id)
    .maybeSingle();
  const key = cons?.asaas_subaccount_key as string | null;
  if (!key) {
    return NextResponse.json(
      { erro: "ative o recebimento antes de sacar" },
      { status: 409 }
    );
  }
  const chavePix = (body.chavePix || (cons?.saque_pix as string) || "").trim();
  if (!chavePix) {
    return NextResponse.json(
      { erro: "cadastre sua chave PIX em Configurações → Recebimento" },
      { status: 400 }
    );
  }
  const tipoChave =
    body.tipoChave && TIPOS_PIX.includes(body.tipoChave as PixKeyType)
      ? (body.tipoChave as PixKeyType)
      : undefined;

  try {
    // Guarda de saldo: não saca mais do que há disponível na subconta.
    const { balance } = await saldoSubconta(key);
    if (valor > Number(balance ?? 0)) {
      return NextResponse.json(
        { erro: `saldo insuficiente (disponível R$ ${Number(balance ?? 0).toFixed(2)})` },
        { status: 409 }
      );
    }
    const t = await criarTransferenciaPix(
      {
        value: valor,
        pixAddressKey: chavePix,
        pixAddressKeyType: tipoChave,
        description: "Saque Revo (consultoria)",
      },
      key
    );
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
    console.error("[asaas/sacar] falha", e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "falha ao solicitar saque" },
      { status }
    );
  }
}

// ============================================================================
// GET /api/aluno/assinatura/pix — QR + copia-e-cola da cobrança PIX em aberto da
// mensalidade do aluno (a assinatura gera uma cobrança a cada ciclo). Se a forma
// não é PIX ou não há cobrança em aberto, devolve semCobranca.
// ============================================================================
import { asaasEnabled } from "@/lib/asaasEnabled";
import {
  listarCobrancasDaAssinatura,
  obterPixQrCode,
  AsaasError,
} from "@/lib/asaas";
import { autenticarAluno, jsonAluno, optionsAluno } from "@/lib/apiAluno";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = optionsAluno;

const ABERTA = ["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"];

export async function GET(request: Request) {
  if (!asaasEnabled) return jsonAluno(503, { erro: "indisponível" });

  const { erro, aluno } = await autenticarAluno(request);
  if (erro) return erro;
  if (!aluno?.asaas_subscription_id) {
    return jsonAluno(409, { erro: "você não tem assinatura ativa" });
  }

  try {
    const { data } = await listarCobrancasDaAssinatura(aluno.asaas_subscription_id);
    // Cobrança PIX em aberto mais próxima do vencimento.
    const aberta = (data ?? [])
      .filter((c) => ABERTA.includes(String(c.status).toUpperCase()))
      .filter((c) => String(c.billingType).toUpperCase() === "PIX")
      .sort((a, b) => String(a.dueDate ?? "").localeCompare(String(b.dueDate ?? "")))[0];
    if (!aberta) return jsonAluno(200, { ok: true, semCobranca: true });

    const qr = await obterPixQrCode(aberta.id);
    return jsonAluno(200, {
      ok: true,
      copiaCola: qr.payload,
      qrCodeImage: qr.encodedImage,
      valor: aberta.value ?? null,
      vencimento: aberta.dueDate ?? null,
    });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[aluno/assinatura/pix] falha", e);
    return jsonAluno(status, {
      erro: e instanceof Error ? e.message : "falha ao obter o PIX",
    });
  }
}

// ============================================================================
// GET /api/aluno/faturas — histórico de cobranças da mensalidade do aluno, com
// link do recibo/fatura (invoiceUrl do Asaas). Mais recentes primeiro.
// ============================================================================
import { asaasEnabled } from "@/lib/asaasEnabled";
import { listarCobrancasDaAssinatura, AsaasError } from "@/lib/asaas";
import { autenticarAluno, jsonAluno, optionsAluno } from "@/lib/apiAluno";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = optionsAluno;

export async function GET(request: Request) {
  if (!asaasEnabled) return jsonAluno(503, { erro: "indisponível" });

  const { erro, aluno } = await autenticarAluno(request);
  if (erro) return erro;
  if (!aluno?.asaas_subscription_id) {
    return jsonAluno(200, { ok: true, faturas: [] });
  }

  try {
    const { data } = await listarCobrancasDaAssinatura(aluno.asaas_subscription_id);
    const faturas = (data ?? [])
      .map((c) => ({
        id: c.id,
        valor: Number(c.value ?? 0),
        status: String(c.status ?? ""),
        vencimento: c.dueDate ?? null,
        forma: c.billingType ?? null,
        reciboUrl: c.invoiceUrl ?? null,
      }))
      .sort((a, b) =>
        String(b.vencimento ?? "").localeCompare(String(a.vencimento ?? ""))
      );
    return jsonAluno(200, { ok: true, faturas });
  } catch (e) {
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[aluno/faturas] falha", e);
    return jsonAluno(status, {
      erro: e instanceof Error ? e.message : "falha ao listar faturas",
    });
  }
}

// ============================================================================
// POST /api/aluno/assinatura/forma — o ALUNO troca a forma de pagamento da
// própria mensalidade (PIX ⇆ cartão) pelo app. PIX é imediato; para cartão o
// Asaas reusa o cartão já salvo (se não houver, devolve erro → o app pede o
// cartão pela tela de trocar cartão).
//
// Body: { forma: 'pix' | 'cartao' }
// ============================================================================
import { asaasEnabled } from "@/lib/asaasEnabled";
import { atualizarFormaAssinatura, AsaasError } from "@/lib/asaas";
import { autenticarAluno, jsonAluno, optionsAluno } from "@/lib/apiAluno";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = optionsAluno;

export async function POST(request: Request) {
  if (!asaasEnabled) return jsonAluno(503, { erro: "indisponível" });

  const body = (await request.json().catch(() => ({}))) as { forma?: "pix" | "cartao" };
  const forma = body.forma === "cartao" ? "cartao" : body.forma === "pix" ? "pix" : null;
  if (!forma) return jsonAluno(400, { erro: "forma inválida (pix|cartao)" });

  const { erro, aluno } = await autenticarAluno(request);
  if (erro) return erro;
  if (!aluno?.asaas_subscription_id) {
    return jsonAluno(409, { erro: "você não tem assinatura ativa" });
  }

  try {
    const r = await atualizarFormaAssinatura(
      aluno.asaas_subscription_id,
      forma === "pix" ? "PIX" : "CREDIT_CARD"
    );
    return jsonAluno(200, { ok: true, forma, status: r.status });
  } catch (e) {
    // Cartão sem cartão salvo → o Asaas rejeita; sinaliza pro app pedir o cartão.
    if (e instanceof AsaasError && forma === "cartao") {
      return jsonAluno(409, { erro: "informe um cartão", precisaCartao: true });
    }
    const status = e instanceof AsaasError ? 502 : 500;
    // eslint-disable-next-line no-console
    console.error("[aluno/assinatura/forma] falha", e);
    return jsonAluno(status, {
      erro: e instanceof Error ? e.message : "falha ao trocar a forma",
    });
  }
}

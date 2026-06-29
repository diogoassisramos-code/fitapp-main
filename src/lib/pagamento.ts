// ============================================================
// CoachFit — Abstração de pagamento (PagamentoProvider).
//
// O fluxo de compra/onboarding fala SÓ com esta interface. Hoje roda atrás de
// uma implementação SIMULADA (sem cobrar de verdade), para destravar todo o
// resto (onboarding → senha → app). Trocar por um gateway real = implementar
// `PagamentoProvider` e apontar `pagamento` para ele — nada no fluxo muda.
//
// Recomendação de gateway (Brasil, marketplace com split da plataforma):
//   • Asaas — mais simples para o público de personais; PIX/boleto/cartão
//     recorrente + split nativo (a plataforma retém a taxa). Boa 1ª escolha.
//   • Pagar.me (Stone) ou Stripe Connect — para escala/split robusto.
// O split importa porque a plataforma cobra taxa sobre o GMV (ver admin/financeiro).
// ============================================================
import type { FormaPagamento } from "./types";

export type StatusCobranca = "pendente" | "pago" | "falhou" | "cancelado";

export type Cobranca = {
  id: string;
  valor: number;
  forma: FormaPagamento;
  descricao: string;
  status: StatusCobranca;
  /** Código copia-e-cola do PIX (quando forma = pix). */
  pixCopiaCola?: string;
  criadoEm: string;
};

export type CriarCobrancaInput = {
  valor: number;
  forma: FormaPagamento;
  descricao: string;
};

export interface PagamentoProvider {
  /** Identificação do provedor (aparece em logs/UX de debug). */
  readonly nome: string;
  /** Abre uma cobrança. No gateway real, retorna pendente até o webhook. */
  criarCobranca(input: CriarCobrancaInput): Promise<Cobranca>;
  /** Consulta o status atual da cobrança. */
  status(cobrancaId: string): Promise<Cobranca>;
  /**
   * SIMULAÇÃO: marca a cobrança como paga. No gateway real isso NÃO existe —
   * a confirmação chega por webhook. Usado só pelo provider simulado/UX de demo.
   */
  confirmar?(cobrancaId: string): Promise<Cobranca>;
}

// ── Provider SIMULADO (protótipo) ───────────────────────────────────────────
function gerarPix(valor: number): string {
  // String fake só para a UX de copia-e-cola; não é um BR Code válido.
  const cents = Math.round(valor * 100);
  return `00020126COACHFIT5204000053039865802BR5910CoachFit6009SaoPaulo62070503***6304${cents}`;
}

class PagamentoSimulado implements PagamentoProvider {
  readonly nome = "simulado";
  private store = new Map<string, Cobranca>();
  private seq = 0;

  async criarCobranca(input: CriarCobrancaInput): Promise<Cobranca> {
    this.seq += 1;
    const cobranca: Cobranca = {
      id: `sim_${this.seq}_${input.forma}`,
      valor: input.valor,
      forma: input.forma,
      descricao: input.descricao,
      status: "pendente",
      pixCopiaCola: input.forma === "pix" ? gerarPix(input.valor) : undefined,
      criadoEm: new Date().toISOString(),
    };
    this.store.set(cobranca.id, cobranca);
    return cobranca;
  }

  async status(cobrancaId: string): Promise<Cobranca> {
    const c = this.store.get(cobrancaId);
    if (!c) throw new Error("cobrança não encontrada");
    return c;
  }

  async confirmar(cobrancaId: string): Promise<Cobranca> {
    const c = this.store.get(cobrancaId);
    if (!c) throw new Error("cobrança não encontrada");
    const pago: Cobranca = { ...c, status: "pago" };
    this.store.set(cobrancaId, pago);
    return pago;
  }
}

/** Provider ativo. Trocar aqui quando o gateway real entrar. */
export const pagamento: PagamentoProvider = new PagamentoSimulado();

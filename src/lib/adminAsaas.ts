// ============================================================================
// Cliente (browser) das rotas financeiras admin da conta MASTER do Asaas.
// Wrappers finos sobre /api/admin/asaas/* — a chave master nunca sai do servidor.
// Cada função lança Error com a mensagem da API em caso de falha (o chamador
// distingue 503 = Asaas não configurado, 403 = não é admin, etc. pela mensagem).
// ============================================================================

export type SaldoMaster = { saldo: number };

export type LancamentoExtrato = {
  id: string;
  valor: number;
  saldo: number | null;
  tipo: string;
  descricao: string;
  data: string;
};

export type SaqueMaster = {
  id: string;
  status: string;
  valor: number;
  valorLiquido: number | null;
  taxa: number | null;
  tipo: string;
  criadoEm: string;
  efetivadoEm: string;
  descricao: string;
};

export type SincronizarResultado = {
  pagamentos: number;
  consultoriasAtualizadas: number;
  alunosAtualizados: number;
};

/** Erro de API com o status HTTP preservado (para distinguir 503/403/409). */
export class AdminAsaasError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminAsaasError";
    this.status = status;
  }
}

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const txt = await res.text();
  const body = txt ? JSON.parse(txt) : {};
  if (!res.ok) {
    throw new AdminAsaasError(res.status, body?.erro || `falha (${res.status})`);
  }
  return body as T;
}

export function fetchSaldoMaster(): Promise<SaldoMaster> {
  return pedir<SaldoMaster>("/api/admin/asaas/saldo");
}

export function fetchExtratoMaster(
  limit = 50
): Promise<{ lancamentos: LancamentoExtrato[]; total: number | null }> {
  return pedir(`/api/admin/asaas/extrato?limit=${limit}`);
}

export function fetchSaques(): Promise<{ saques: SaqueMaster[] }> {
  return pedir("/api/admin/asaas/transferencias");
}

export function sincronizarPlataforma(): Promise<SincronizarResultado> {
  return pedir<SincronizarResultado>("/api/admin/asaas/sincronizar", {
    method: "POST",
  });
}

export type WebhookInfo = { id: string; url: string; enabled: boolean; events: string[] };

/** Lista os webhooks do Asaas (conta master) + se o token está configurado. */
export function fetchWebhooks(): Promise<{
  tokenConfigurado: boolean;
  webhooks: WebhookInfo[];
}> {
  return pedir("/api/admin/asaas/webhook");
}

/** Registra o webhook do Asaas (idempotente). `url` opcional = URL pública. */
export function registrarWebhookAsaas(url?: string): Promise<{
  jaExistia?: boolean;
  webhook: { id: string | null; url: string };
  aviso?: string;
}> {
  return pedir("/api/admin/asaas/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(url ? { url } : {}),
  });
}

/** Estorna uma cobrança (Asaas) — admin. `valor` ausente = estorno total. */
export function estornarPagamento(
  asaasPaymentId: string,
  valor?: number
): Promise<{ status: string }> {
  return pedir("/api/admin/asaas/estornar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ asaasPaymentId, ...(valor != null ? { valor } : {}) }),
  });
}

/** Cancela/reativa a assinatura SaaS de uma consultoria (liga o Asaas) — admin. */
export function mudarAssinaturaConsultoria(
  consultoriaId: string,
  acao: "cancelar" | "reativar"
): Promise<{ planoStatus: string }> {
  return pedir("/api/admin/asaas/assinatura", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consultoriaId, acao }),
  });
}

export type SolicitarSaqueInput = {
  valor: number;
  chavePix: string;
  tipoChave?: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
  descricao?: string;
};

/**
 * Solicita um saque PIX da conta master. Sempre envia `confirmar:true` — a
 * confirmação de fato acontece na UI (modal) ANTES de chamar esta função.
 */
export function solicitarSaque(
  input: SolicitarSaqueInput
): Promise<{ saque: { id: string; status: string; valor: number } }> {
  return pedir("/api/admin/asaas/transferencias", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, confirmar: true }),
  });
}

export type PropagarPrecoResultado = {
  ok: true;
  slug: string;
  preco: number;
  total: number;
  atualizadas: number;
  falhas: { consultoriaId: string; erro: string }[];
};

/**
 * Aplica o preço salvo em /admin/planos às assinaturas ATIVAS desse plano no
 * Asaas (PUT /subscriptions/{id} value). Só próximas cobranças mudam.
 */
export function propagarPrecoPlano(slug: string): Promise<PropagarPrecoResultado> {
  return pedir("/api/admin/planos/propagar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug }),
  });
}

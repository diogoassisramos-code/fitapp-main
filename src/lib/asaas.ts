// ============================================================================
// Revo — Cliente da API do Asaas (v3). SERVER-ONLY.
//
// A chave (ASAAS_API_KEY) é SECRETA e vai no header `access_token`. Este módulo
// só pode ser importado por Route Handlers / código de servidor — NUNCA por um
// Client Component (senão a chave vazaria para o bundle do navegador).
//
// Env necessárias (no servidor):
//   ASAAS_API_KEY   — chave da conta ($aact_hmlg_ no sandbox, $aact_prod_ em prod)
//   ASAAS_BASE_URL  — https://api-sandbox.asaas.com/v3  (ou api.asaas.com/v3)
//   ASAAS_USER_AGENT (opcional) — nome da app; o Asaas exige User-Agent em contas novas
//
// Docs: https://docs.asaas.com/reference
// ============================================================================

// Guard: se este módulo for importado no cliente por engano, falha alto em vez
// de vazar a chave silenciosamente.
if (typeof window !== "undefined") {
  throw new Error("src/lib/asaas.ts é server-only e não pode rodar no navegador.");
}

export type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";
export type SubscriptionCycle =
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "BIMONTHLY"
  | "QUARTERLY"
  | "SEMIANNUALLY"
  | "YEARLY";

/** Item de split: repassa parte do líquido para a walletId de um recebedor. */
export type SplitItem = {
  walletId: string;
  /** Valor fixo (2 casas). Use fixedValue OU percentualValue (pode combinar). */
  fixedValue?: number;
  /** Percentual sobre o líquido (4 casas). */
  percentualValue?: number;
};

export type CreditCardHolderInfo = {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  addressComplement?: string;
  phone?: string;
  mobilePhone?: string;
};

/** Dados do cartão (checkout transparente). Trafega só em memória → Asaas. */
export type CreditCard = {
  holderName: string;
  number: string;
  expiryMonth: string; // "MM"
  expiryYear: string; // "AAAA"
  ccv: string;
};

export type AsaasCliente = {
  id: string;
  name: string;
  cpfCnpj: string;
  email?: string;
};

export type AsaasCobranca = {
  id: string;
  status: string;
  value: number;
  netValue?: number;
  billingType: string;
  dueDate: string;
  invoiceUrl?: string;
  subscription?: string;
  externalReference?: string;
};

export type AsaasPixQrCode = {
  encodedImage: string; // PNG base64 (data:image/png;base64,...)
  payload: string; // copia-e-cola
  expirationDate?: string;
};

export type AsaasAssinatura = {
  id: string;
  status: string;
  value: number;
  cycle: string;
  nextDueDate: string;
  externalReference?: string;
};

export type AsaasSubconta = {
  id: string;
  walletId: string;
  apiKey?: string; // retornada UMA única vez na criação — guardar cifrada
  accountNumber?: unknown;
  onboardingUrl?: string;
};

/** Erro estruturado da API do Asaas (status HTTP + lista de erros). */
export class AsaasError extends Error {
  status: number;
  detalhes: unknown;
  constructor(status: number, detalhes: unknown) {
    super(`Asaas respondeu ${status}: ${JSON.stringify(detalhes)}`);
    this.name = "AsaasError";
    this.status = status;
    this.detalhes = detalhes;
  }
}

function requireEnv(nome: string): string {
  const v = process.env[nome];
  if (!v) throw new Error(`env ${nome} ausente (Asaas não configurado)`);
  return v;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch base com header de auth + User-Agent + retry/backoff no 429. */
async function asaasFetch(
  path: string,
  init: RequestInit = {},
  tentativa = 0
): Promise<Response> {
  const base = requireEnv("ASAAS_BASE_URL").replace(/\/$/, "");
  const key = requireEnv("ASAAS_API_KEY");
  const res = await fetch(base + path, {
    ...init,
    headers: {
      access_token: key,
      "User-Agent": process.env.ASAAS_USER_AGENT || "Revo",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  // Rate limit: respeita RateLimit-Reset (segundos) e tenta de novo (até 3x).
  if (res.status === 429 && tentativa < 3) {
    const reset = Number(res.headers.get("ratelimit-reset")) || 2 ** tentativa;
    await sleep(Math.min(reset, 10) * 1000);
    return asaasFetch(path, init, tentativa + 1);
  }
  return res;
}

async function asaasJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await asaasFetch(path, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const errors = (data as { errors?: unknown })?.errors ?? data;
    throw new AsaasError(res.status, errors);
  }
  return data as T;
}

// ── Conta / health ──────────────────────────────────────────────────────────

/** Dados da conta autenticada. Bom para smoke-test de credencial/ambiente. */
export function getMyAccount(): Promise<Record<string, unknown>> {
  return asaasJson("/myAccount");
}

// ── Clientes ─────────────────────────────────────────────────────────────────

export type CriarClienteInput = {
  name: string;
  cpfCnpj: string;
  email?: string;
  mobilePhone?: string;
  /** id do consultor/aluno no Revo — para reconciliar depois. */
  externalReference?: string;
};

export function criarCliente(input: CriarClienteInput): Promise<AsaasCliente> {
  return asaasJson("/customers", { method: "POST", body: JSON.stringify(input) });
}

/** Busca cliente por CPF/CNPJ (dedupe antes de criar). Retorna o 1º ou null. */
export async function buscarClientePorCpf(
  cpfCnpj: string
): Promise<AsaasCliente | null> {
  const r = await asaasJson<{ data: AsaasCliente[] }>(
    `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}&limit=1`
  );
  return r.data?.[0] ?? null;
}

/** Garante um cliente para o CPF (reusa se já existir; cria se não). */
export async function garantirCliente(
  input: CriarClienteInput
): Promise<AsaasCliente> {
  const existente = await buscarClientePorCpf(input.cpfCnpj);
  if (existente) return existente;
  return criarCliente(input);
}

// ── Cobranças (payments) ─────────────────────────────────────────────────────

export type CriarCobrancaInput = {
  customer: string;
  billingType: BillingType;
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  split?: SplitItem[];
  creditCardToken?: string;
  remoteIp?: string; // IP REAL do pagador (não do servidor) para análise de risco
};

export function criarCobranca(
  input: CriarCobrancaInput
): Promise<AsaasCobranca> {
  return asaasJson("/payments", { method: "POST", body: JSON.stringify(input) });
}

/** QR Code + copia-e-cola de uma cobrança PIX já criada. */
export function obterPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasJson(`/payments/${paymentId}/pixQrCode`);
}

/** Estorna uma cobrança (total se `value` ausente; parcial se informado). */
export function estornarCobranca(
  paymentId: string,
  value?: number,
  description?: string
): Promise<AsaasCobranca> {
  return asaasJson(`/payments/${paymentId}/refund`, {
    method: "POST",
    body: JSON.stringify(value != null ? { value, description } : { description }),
  });
}

// ── Assinaturas (subscriptions) ──────────────────────────────────────────────

export type CriarAssinaturaInput = {
  customer: string;
  billingType: BillingType;
  value: number;
  cycle: SubscriptionCycle;
  nextDueDate: string; // YYYY-MM-DD (data da 1ª cobrança)
  description?: string;
  externalReference?: string;
  split?: SplitItem[];
  // Cartão: envie `creditCard`+`creditCardHolderInfo` (1ª vez) OU `creditCardToken`
  // (reuso). O Asaas valida o cartão e cobra automaticamente a cada ciclo.
  creditCard?: CreditCard;
  creditCardToken?: string;
  creditCardHolderInfo?: CreditCardHolderInfo;
  remoteIp?: string;
};

export function criarAssinatura(
  input: CriarAssinaturaInput
): Promise<AsaasAssinatura> {
  return asaasJson("/subscriptions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Cobranças (filhas) já geradas por uma assinatura. */
export function listarCobrancasDaAssinatura(
  subscriptionId: string
): Promise<{ data: AsaasCobranca[] }> {
  return asaasJson(`/subscriptions/${subscriptionId}/payments`);
}

/**
 * Suspende a assinatura no FIM DO CICLO mantendo a conta (status=INACTIVE) —
 * casa com a decisão de cancelamento self-service do Revo. NÃO usar DELETE
 * (apaga as cobranças pendentes imediatamente).
 */
export function suspenderAssinatura(
  subscriptionId: string
): Promise<AsaasAssinatura> {
  return asaasJson(`/subscriptions/${subscriptionId}`, {
    method: "PUT",
    body: JSON.stringify({ status: "INACTIVE" }),
  });
}

// ── Subcontas (marketplace / white-label) ────────────────────────────────────

export type CriarSubcontaInput = {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string;
  incomeValue: number;
  address?: string;
  addressNumber?: string;
  province?: string;
  postalCode?: string;
  companyType?: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
};

/**
 * Cria a subconta de um consultor (recebedor no split). Retorna `walletId`
 * (destino do split) e `apiKey` (mostrada UMA única vez — guardar cifrada).
 * Requer conta raiz PJ e liberação de White Label pelo gerente Asaas.
 */
export function criarSubconta(
  input: CriarSubcontaInput
): Promise<AsaasSubconta> {
  return asaasJson("/accounts", { method: "POST", body: JSON.stringify(input) });
}

// ── Webhooks (registro via API — alternativa ao painel) ──────────────────────

export type RegistrarWebhookInput = {
  name: string;
  url: string;
  email?: string;
  authToken: string; // enviado no header asaas-access-token de cada evento
  events: string[];
  sendType?: "SEQUENTIALLY" | "NON_SEQUENTIALLY";
};

export function registrarWebhook(
  input: RegistrarWebhookInput
): Promise<Record<string, unknown>> {
  return asaasJson("/webhooks", {
    method: "POST",
    body: JSON.stringify({ enabled: true, apiVersion: 3, ...input }),
  });
}

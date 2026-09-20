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

/**
 * fetch base com header de auth + User-Agent + retry/backoff no 429.
 * `apiKey` opcional troca a credencial: use a apiKey da SUBCONTA para chamar
 * endpoints "myAccount" no contexto do recebedor (ex.: documentos/KYC).
 */
async function asaasFetch(
  path: string,
  init: RequestInit = {},
  apiKey?: string,
  tentativa = 0
): Promise<Response> {
  const base = requireEnv("ASAAS_BASE_URL").replace(/\/$/, "");
  const key = apiKey || requireEnv("ASAAS_API_KEY");
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
    return asaasFetch(path, init, apiKey, tentativa + 1);
  }
  return res;
}

async function asaasJson<T>(
  path: string,
  init: RequestInit = {},
  apiKey?: string
): Promise<T> {
  const res = await asaasFetch(path, init, apiKey);
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

/**
 * Troca a forma de pagamento da assinatura (PIX ⇆ cartão). Para CREDIT_CARD
 * reusa o cartão já tokenizado na assinatura; se não houver, o Asaas rejeita
 * (aí o app deve pedir o cartão). `updatePendingPayments` aplica às pendentes.
 */
export function atualizarFormaAssinatura(
  subscriptionId: string,
  billingType: BillingType
): Promise<AsaasAssinatura> {
  return asaasJson(`/subscriptions/${subscriptionId}`, {
    method: "PUT",
    body: JSON.stringify({ billingType, updatePendingPayments: true }),
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

/** Reativa uma assinatura suspensa (status=ACTIVE) — espelho de suspender. */
export function reativarAssinatura(
  subscriptionId: string
): Promise<AsaasAssinatura> {
  return asaasJson(`/subscriptions/${subscriptionId}`, {
    method: "PUT",
    body: JSON.stringify({ status: "ACTIVE" }),
  });
}

/**
 * Atualiza o VALOR de uma assinatura recorrente (mudança de preço do plano SaaS
 * feita em /admin/planos). Só as próximas cobranças mudam — as já geradas
 * (pendentes) ficam no valor antigo (`updatePendingPayments:false`).
 */
export function atualizarValorAssinatura(
  subscriptionId: string,
  value: number
): Promise<AsaasAssinatura> {
  return asaasJson(`/subscriptions/${subscriptionId}`, {
    method: "PUT",
    body: JSON.stringify({ value, updatePendingPayments: false }),
  });
}

/** Lê a assinatura (status/valor/ciclo/próximo vencimento). */
export function getAssinatura(subscriptionId: string): Promise<AsaasAssinatura> {
  return asaasJson(`/subscriptions/${subscriptionId}`);
}

/**
 * Troca o cartão de uma assinatura recorrente. O novo cartão passa a valer nas
 * próximas cobranças; `updatePendingPayments` reprocessa as pendentes/vencidas
 * com ele. `remoteIp` é o IP REAL do pagador (análise de risco do Asaas).
 */
export function atualizarCartaoAssinatura(
  subscriptionId: string,
  input: {
    creditCard: CreditCard;
    creditCardHolderInfo: CreditCardHolderInfo;
    remoteIp?: string;
  }
): Promise<AsaasAssinatura> {
  return asaasJson(`/subscriptions/${subscriptionId}`, {
    method: "PUT",
    body: JSON.stringify({
      billingType: "CREDIT_CARD",
      creditCard: input.creditCard,
      creditCardHolderInfo: input.creditCardHolderInfo,
      updatePendingPayments: true,
      ...(input.remoteIp ? { remoteIp: input.remoteIp } : {}),
    }),
  });
}

// ── Subcontas (marketplace / white-label) ────────────────────────────────────

export type CriarSubcontaInput = {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string;
  incomeValue: number;
  birthDate?: string; // AAAA-MM-DD (recomendado para pessoa física)
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

// ── KYC da subconta: documentos pendentes + status de aprovação ───────────────
// Estes endpoints são chamados NO CONTEXTO DA SUBCONTA (autenticam com a apiKey
// dela, não com a chave da plataforma). O onboardingUrl é a jornada hospedada
// pelo Asaas (documento de identificação + selfie/prova de vida).

/** Situação agregada da conta. general="APPROVED" = conta 100% liberada. */
export type AsaasAccountStatus = {
  id?: string;
  commercialInfo?: string;
  bankAccountInfo?: string;
  documentation?: string;
  general?: string;
};

/** Um grupo de documento exigido no KYC (identificação, selfie, etc.). */
export type AsaasDocumentoPendente = {
  id: string;
  /** NOT_SENT | PENDING | AWAITING_APPROVAL | APPROVED | REJECTED */
  status: string;
  /** IDENTIFICATION | IDENTIFICATION_SELFIE | SOCIAL_CONTRACT | ... */
  type: string;
  title?: string;
  description?: string;
  /** Quando presente, o envio DEVE ser por este link (upload via API é rejeitado). */
  onboardingUrl?: string;
  documents?: { id: string; status: string }[];
};

/** Situação agregada da subconta (autentica com a apiKey da subconta). */
export function statusSubconta(apiKey: string): Promise<AsaasAccountStatus> {
  return asaasJson("/myAccount/status", {}, apiKey);
}

export type AsaasSaldo = { balance: number };

/** Saldo DISPONÍVEL da subconta no Asaas (autentica com a apiKey da subconta). */
export function saldoSubconta(apiKey: string): Promise<AsaasSaldo> {
  return asaasJson("/finance/balance", {}, apiKey);
}

/** Pagamento (visão do recebedor) com a data estimada de liberação do dinheiro. */
export type AsaasPagamentoRecebedor = {
  id: string;
  value?: number;
  netValue?: number;
  status?: string;
  billingType?: string;
  /** Quando o valor cai no saldo disponível (cartão costuma ser D+30). */
  estimatedCreditDate?: string;
  creditDate?: string;
};

/**
 * Pagamentos da SUBCONTA (autentica com a apiKey dela). Use status=CONFIRMED
 * para os já confirmados mas ainda NÃO liberados (o "a liberar", típico cartão),
 * cada um com `estimatedCreditDate` (quando o Asaas credita).
 */
export function listarPagamentosSubconta(
  apiKey: string,
  params?: { status?: string; billingType?: BillingType; limit?: number }
): Promise<{ data: AsaasPagamentoRecebedor[] }> {
  const qs = new URLSearchParams({ limit: String(params?.limit ?? 100) });
  if (params?.status) qs.set("status", params.status);
  if (params?.billingType) qs.set("billingType", params.billingType);
  return asaasJson(`/payments?${qs.toString()}`, {}, apiKey);
}

// ── Conta MASTER (plataforma) — saldo, extrato e saques ──────────────────────
// Estas funções usam a CHAVE MASTER (ASAAS_API_KEY, sem apiKey de subconta): a
// conta raiz que recebe as assinaturas SaaS (100%) e a fatia da plataforma
// (split_taxa) das mensalidades. É o dinheiro real da plataforma.

/** Saldo DISPONÍVEL da conta master (plataforma). */
export function saldoMaster(): Promise<AsaasSaldo> {
  return asaasJson("/finance/balance");
}

/** Uma linha do extrato financeiro (ledger) da conta. */
export type AsaasTransacaoFinanceira = {
  id: string;
  /** Positivo = crédito; negativo = débito (saque, split pago, taxa). */
  value: number;
  /** Saldo da conta após o lançamento. */
  balance?: number;
  /** PAYMENT_RECEIVED | TRANSFER | PAYMENT_FEE | ... */
  type?: string;
  date?: string;
  description?: string;
  payment?: string | null;
  transfer?: string | null;
};

/** Extrato (financialTransactions) da conta master — o ledger real de caixa. */
export function listarTransacoesFinanceiras(params?: {
  offset?: number;
  limit?: number;
  startDate?: string; // YYYY-MM-DD
  finishDate?: string; // YYYY-MM-DD
}): Promise<{
  data: AsaasTransacaoFinanceira[];
  totalCount?: number;
  hasMore?: boolean;
}> {
  const qs = new URLSearchParams({ limit: String(params?.limit ?? 50) });
  if (params?.offset) qs.set("offset", String(params.offset));
  if (params?.startDate) qs.set("startDate", params.startDate);
  if (params?.finishDate) qs.set("finishDate", params.finishDate);
  return asaasJson(`/financialTransactions?${qs.toString()}`);
}

/** Uma transferência/saque da conta master. */
export type AsaasTransferencia = {
  id: string;
  status: string; // PENDING | BANK_PROCESSING | DONE | CANCELLED | FAILED
  value: number;
  netValue?: number;
  transferFee?: number;
  dateCreated?: string;
  effectiveDate?: string;
  operationType?: string; // PIX | TED | INTERNAL
  description?: string;
};

/** Histórico de saques/transferências da conta master. */
export function listarTransferencias(params?: {
  offset?: number;
  limit?: number;
}): Promise<{
  data: AsaasTransferencia[];
  totalCount?: number;
  hasMore?: boolean;
}> {
  const qs = new URLSearchParams({ limit: String(params?.limit ?? 30) });
  if (params?.offset) qs.set("offset", String(params.offset));
  return asaasJson(`/transfers?${qs.toString()}`);
}

/** Tipo da chave PIX de destino do saque. */
export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

export type TransferenciaPixInput = {
  value: number;
  pixAddressKey: string;
  pixAddressKeyType?: PixKeyType;
  description?: string;
};

/**
 * Saca da conta master via PIX (operationType PIX). O dinheiro sai da conta da
 * plataforma para a chave PIX informada. Ação IRREVERSÍVEL — a rota que a chama
 * exige admin e confirmação explícita.
 */
export function criarTransferenciaPix(
  input: TransferenciaPixInput,
  apiKey?: string
): Promise<AsaasTransferencia> {
  return asaasJson(
    "/transfers",
    {
      method: "POST",
      body: JSON.stringify({
        operationType: "PIX",
        value: input.value,
        pixAddressKey: input.pixAddressKey,
        ...(input.pixAddressKeyType
          ? { pixAddressKeyType: input.pixAddressKeyType }
          : {}),
        ...(input.description ? { description: input.description } : {}),
      }),
    },
    // Sem apiKey → conta master (admin). Com apiKey → subconta (saque do coach).
    apiKey
  );
}

/**
 * Documentos KYC pendentes da subconta. IMPORTANTE: aguardar ~15s após criar a
 * conta antes de chamar (validação junto à Receita) — antes disso pode vir vazio
 * ou incorreto.
 */
export function listarDocumentosSubconta(
  apiKey: string
): Promise<{ data: AsaasDocumentoPendente[]; rejectReasons?: unknown }> {
  return asaasJson("/myAccount/documents", {}, apiKey);
}

/** Escolhe o link de onboarding (identidade + selfie) entre os documentos pendentes. */
export function onboardingUrlDosDocumentos(docs: {
  data?: AsaasDocumentoPendente[];
}): string | null {
  const lista = docs.data ?? [];
  // Prefere um documento ainda não aprovado que tenha link.
  const pendente = lista.find((d) => d.onboardingUrl && d.status !== "APPROVED");
  if (pendente?.onboardingUrl) return pendente.onboardingUrl;
  return lista.find((d) => d.onboardingUrl)?.onboardingUrl ?? null;
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

export type AsaasWebhook = {
  id: string;
  name?: string;
  url: string;
  enabled?: boolean;
  events?: string[];
};

/** Webhooks já cadastrados na conta (pra checar/deduplicar antes de registrar). */
export function listarWebhooks(): Promise<{ data: AsaasWebhook[] }> {
  return asaasJson("/webhooks");
}

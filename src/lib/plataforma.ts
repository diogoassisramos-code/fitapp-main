// ============================================================================
// Revo — Configuração da PLATAFORMA (Fluxo 2 / marketplace).
//
// Taxa que a Revo retém sobre cada pagamento aluno→coach (via split do Asaas).
// O coach recebe (100 − taxa)% no walletId dele; o restante fica com a conta
// raiz (a plataforma). Calculado sobre o valor LÍQUIDO (após a taxa do Asaas).
//
// Fonte ÚNICA da taxa — trocar aqui muda o split em todo o app. Depois dá pra
// tornar por-consultoria (ler de consultorias.taxa_plataforma_pct).
// ============================================================================
import type { SplitItem } from "./asaas";

/** Fallback da taxa (%) quando o banco não devolve nada. A taxa real é
 *  configurável no /admin (plataforma_config) + override por consultoria. */
export const TAXA_PLATAFORMA_PCT = 10;

/**
 * Monta o array de split de uma cobrança do aluno: repassa (100 − taxa)% ao
 * walletId do coach; o restante fica com a plataforma (emissora da cobrança).
 * `taxaPct` é a taxa EFETIVA lida do banco (override do coach → senão global).
 * Retorna `undefined` se o coach ainda não tem walletId (sem subconta).
 */
export function splitDoCoach(
  coachWalletId: string | null | undefined,
  taxaPct: number = TAXA_PLATAFORMA_PCT
): SplitItem[] | undefined {
  if (!coachWalletId) return undefined;
  const pct = Number.isFinite(taxaPct) ? Math.max(0, Math.min(100, taxaPct)) : TAXA_PLATAFORMA_PCT;
  return [{ walletId: coachWalletId, percentualValue: 100 - pct }];
}

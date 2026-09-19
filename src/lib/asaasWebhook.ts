// ============================================================================
// Revo — helpers PUROS do webhook do Asaas (sem I/O), extraídos para teste.
// A rota /api/webhooks/asaas importa daqui; ver o cabeçalho dela para o
// contrato completo (autenticidade, idempotência, reprocessamento).
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

/** externalReference no padrão "saas:<consultoriaId>" | "mensalidade:<alunoId>". */
export function parseRef(ref?: string): { fluxo: "saas" | "mensalidade" | null; id: string | null } {
  if (!ref) return { fluxo: null, id: null };
  const [tipo, id] = ref.split(":");
  if (tipo === "saas") return { fluxo: "saas", id: id ?? null };
  if (tipo === "mensalidade") return { fluxo: "mensalidade", id: id ?? null };
  return { fluxo: null, id: null };
}

/**
 * Fatia da plataforma sobre uma cobrança do aluno. O split do Asaas repassa
 * (100 − taxa)% do LÍQUIDO (após a taxa do gateway) ao coach; a plataforma
 * retém taxa% desse mesmo líquido. Usa o `split[].totalValue` real do payload
 * quando o Asaas já calculou; senão deriva de netValue × taxa (idêntico ao que
 * configuramos na cobrança). Retorna null se não dá pra calcular ainda.
 */
export function calcularSplitTaxa(payment: any, netValue: number, taxa: number): number {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  // Só criamos UM recebedor no split (o coach) → o restante do líquido é da
  // plataforma. Se o payload traz o valor já calculado, usa a verdade do Asaas.
  const itens: any[] = Array.isArray(payment?.split) ? payment.split : [];
  const somaCoach = itens.reduce((s, it) => {
    const v = it?.totalValue ?? it?.totalFixedValue;
    return v != null ? s + Number(v) : s;
  }, 0);
  if (somaCoach > 0) return round2(Math.max(0, netValue - somaCoach));
  return round2(netValue * (taxa / 100));
}

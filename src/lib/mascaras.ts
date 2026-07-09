// ============================================================
// Máscaras de digitação (formatam enquanto o usuário digita) e validações.
// Fonte única — usar nos inputs de telefone/cartão/validade/CEP.
// ============================================================

/** Só os dígitos do telefone (até 11: DDD + 9). */
export function soDigitosTelefone(v: string): string {
  return (v ?? "").replace(/\D/g, "").slice(0, 11);
}

/** "11999998888" -> "(11) 99999-8888" (fixo: "(11) 3333-4444"). Progressiva. */
export function mascararTelefone(v: string): string {
  const d = soDigitosTelefone(v);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Telefone válido = 10 (fixo) ou 11 (celular) dígitos, com DDD. */
export function telefoneValido(v: string): boolean {
  const d = soDigitosTelefone(v);
  return d.length === 10 || d.length === 11;
}

/** "4444444444444444" -> "4444 4444 4444 4444" (grupos de 4, até 16 dígitos). */
export function mascararCartao(v: string): string {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 16);
  return d.match(/.{1,4}/g)?.join(" ") ?? "";
}

/** "1230" -> "12/30" (MM/AA). */
export function mascararValidade(v: string): string {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** "95650000" -> "95650-000". */
export function mascararCep(v: string): string {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

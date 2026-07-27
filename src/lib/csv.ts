// ============================================================================
// Geração de CSV no cliente (export do extrato / fechamento). Separador ";" e
// BOM UTF-8 para abrir certinho no Excel pt-BR; decimais com vírgula.
// ============================================================================

/** Formata um número como moeda "1234,56" (sem símbolo, decimal vírgula). */
export function csvNum(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2).replace(".", ",");
}

function escapar(v: string | number): string {
  const s = String(v ?? "");
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Monta o CSV e dispara o download no navegador. */
export function baixarCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const linhas = [headers, ...rows].map((r) => r.map(escapar).join(";"));
  const csv = String.fromCharCode(0xfeff) + linhas.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

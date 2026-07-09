// ============================================================
// Revo — CPF: validação, máscara e normalização.
// Fonte ÚNICA (o CPF é a identidade global do aluno). Antes existiam cópias
// idênticas em /cadastro e /onboarding — se divergissem, o mesmo CPF poderia
// ser aceito num fluxo e rejeitado no outro, corrompendo a chave de identidade.
// ============================================================

/** Só os dígitos do CPF (remove pontuação). */
export function soDigitosCpf(raw: string): string {
  return (raw ?? "").replace(/\D/g, "").slice(0, 11);
}

/** Validação de CPF (11 dígitos + dígitos verificadores). */
export function cpfValido(raw: string): boolean {
  const cpf = soDigitosCpf(raw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return (
    calc(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    calc(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}

/** "12345678909" | "123.456.789-09" -> "123.456.789-09" (máscara progressiva). */
export function mascararCpf(raw: string): string {
  const d = soDigitosCpf(raw);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

/** Só os dígitos do CNPJ (até 14). */
export function soDigitosCnpj(raw: string): string {
  return (raw ?? "").replace(/\D/g, "").slice(0, 14);
}

/** Validação de CNPJ (14 dígitos + dígitos verificadores). */
export function cnpjValido(raw: string): boolean {
  const cnpj = soDigitosCnpj(raw);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const dv = (base: string) => {
    const pesos =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split("").reduce((a, d, i) => a + Number(d) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return (
    dv(cnpj.slice(0, 12)) === Number(cnpj[12]) &&
    dv(cnpj.slice(0, 13)) === Number(cnpj[13])
  );
}

/** "12345678000190" -> "12.345.678/0001-90" (máscara progressiva). */
export function mascararCnpj(raw: string): string {
  return soDigitosCnpj(raw)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

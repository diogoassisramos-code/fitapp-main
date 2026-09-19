import { describe, expect, it } from "vitest";
import { cpfValido, mascararCpf, soDigitosCpf, cnpjValido, mascararCnpj } from "../cpf";

describe("CPF", () => {
  it("aceita CPF válido, com ou sem máscara", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
  });

  it("rejeita dígito verificador errado, sequência repetida e tamanho errado", () => {
    expect(cpfValido("529.982.247-26")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("1234567890")).toBe(false);
    expect(cpfValido("")).toBe(false);
  });

  it("máscara progressiva enquanto digita", () => {
    expect(mascararCpf("529")).toBe("529");
    expect(mascararCpf("5299")).toBe("529.9");
    expect(mascararCpf("52998224725")).toBe("529.982.247-25");
    expect(mascararCpf("529.982.247-25")).toBe("529.982.247-25");
  });

  it("soDigitosCpf corta em 11 dígitos", () => {
    expect(soDigitosCpf("529.982.247-25999")).toBe("52998224725");
  });
});

describe("CNPJ", () => {
  it("valida e mascara", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
    expect(cnpjValido("00000000000000")).toBe(false);
    expect(mascararCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });
});

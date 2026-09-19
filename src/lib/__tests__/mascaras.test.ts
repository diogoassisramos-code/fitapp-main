import { describe, expect, it } from "vitest";
import {
  mascararTelefone,
  telefoneValido,
  mascararCartao,
  mascararValidade,
  mascararCep,
} from "../mascaras";

describe("telefone", () => {
  it("mascara celular e fixo progressivamente", () => {
    expect(mascararTelefone("")).toBe("");
    expect(mascararTelefone("1")).toBe("(1");
    expect(mascararTelefone("1199")).toBe("(11) 99");
    expect(mascararTelefone("1133334444")).toBe("(11) 3333-4444");
    expect(mascararTelefone("11999998888")).toBe("(11) 99999-8888");
    // Corta em 11 dígitos: o +55 vira DDD (comportamento atual — o input não aceita código de país).
    expect(mascararTelefone("+55 (11) 99999-8888")).toBe("(55) 11999-9988");
  });

  it("valida 10 ou 11 dígitos", () => {
    expect(telefoneValido("(11) 99999-8888")).toBe(true);
    expect(telefoneValido("(11) 3333-4444")).toBe(true);
    expect(telefoneValido("99999-8888")).toBe(false);
  });
});

describe("cartão / validade / CEP", () => {
  it("cartão em grupos de 4", () => {
    expect(mascararCartao("4444444444444444")).toBe("4444 4444 4444 4444");
    expect(mascararCartao("44444")).toBe("4444 4");
    expect(mascararCartao("")).toBe("");
  });
  it("validade MM/AA", () => {
    expect(mascararValidade("12")).toBe("12");
    expect(mascararValidade("1230")).toBe("12/30");
  });
  it("CEP", () => {
    expect(mascararCep("95650000")).toBe("95650-000");
    expect(mascararCep("9565")).toBe("9565");
  });
});

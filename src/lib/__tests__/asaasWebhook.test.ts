import { describe, expect, it } from "vitest";
import { parseRef, calcularSplitTaxa } from "../asaasWebhook";

describe("parseRef", () => {
  it("reconhece os dois fluxos", () => {
    expect(parseRef("saas:cons-1")).toEqual({ fluxo: "saas", id: "cons-1" });
    expect(parseRef("mensalidade:aluno-9")).toEqual({ fluxo: "mensalidade", id: "aluno-9" });
  });

  it("ignora referência desconhecida ou vazia", () => {
    expect(parseRef(undefined)).toEqual({ fluxo: null, id: null });
    expect(parseRef("outra:coisa")).toEqual({ fluxo: null, id: null });
    expect(parseRef("saas")).toEqual({ fluxo: "saas", id: null });
  });
});

describe("calcularSplitTaxa", () => {
  it("usa o valor real do split quando o Asaas já calculou", () => {
    const payment = { split: [{ walletId: "w", totalValue: 88.2 }] };
    expect(calcularSplitTaxa(payment, 98, 10)).toBe(9.8);
  });

  it("aceita totalFixedValue e soma vários itens", () => {
    const payment = { split: [{ totalFixedValue: 50 }, { totalValue: 30 }] };
    expect(calcularSplitTaxa(payment, 100, 10)).toBe(20);
  });

  it("nunca fica negativo se o split exceder o líquido", () => {
    expect(calcularSplitTaxa({ split: [{ totalValue: 120 }] }, 100, 10)).toBe(0);
  });

  it("sem split no payload deriva de líquido × taxa, arredondado em centavos", () => {
    expect(calcularSplitTaxa({}, 98, 10)).toBe(9.8);
    expect(calcularSplitTaxa({ split: [] }, 33.33, 10)).toBe(3.33);
    expect(calcularSplitTaxa(null, 100, 12.5)).toBe(12.5);
  });
});

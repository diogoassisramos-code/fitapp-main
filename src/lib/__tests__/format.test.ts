import { describe, expect, it } from "vitest";
import {
  brl,
  brlNumber,
  dataCurta,
  dataLonga,
  dataLocalYMD,
  estaAtrasada,
  diasSemanaResumo,
  inclusoResumo,
} from "../format";

// Intl usa espaço não-quebrável entre "R$" e o número.
const nbsp = (s: string) => s.replace(/ /g, " ");

describe("moeda", () => {
  it("brl formata em pt-BR", () => {
    expect(nbsp(brl(4820.5))).toBe("R$ 4.820,50");
    expect(nbsp(brl(0))).toBe("R$ 0,00");
    expect(nbsp(brl(-15))).toBe("-R$ 15,00");
  });
  it("brlNumber sem símbolo", () => {
    expect(brlNumber(1234.5)).toBe("1.234,50");
  });
});

describe("datas", () => {
  it("dataCurta / dataLonga a partir de YYYY-MM-DD", () => {
    expect(dataCurta("2026-06-28")).toBe("28/06");
    expect(dataLonga("2026-06-28")).toBe("28 jun 2026");
    expect(dataLonga("2026-12-01")).toBe("01 dez 2026");
  });

  it("dataLocalYMD converte timestamp para o dia em São Paulo", () => {
    // 02:30 UTC ainda é 23:30 do dia anterior no Brasil (UTC−3).
    expect(dataLocalYMD("2026-06-22T02:30:00Z")).toBe("2026-06-21");
    expect(dataLocalYMD("2026-06-22T12:00:00Z")).toBe("2026-06-22");
    expect(dataLocalYMD("2026-06-22")).toBe("2026-06-22"); // data-only passa direto
    expect(dataLocalYMD(null)).toBe("");
    expect(dataLocalYMD("lixo")).toBe("lixo");
  });

  it("estaAtrasada compara contra a referência informada", () => {
    expect(estaAtrasada("2026-06-20", "2026-06-21")).toBe(true);
    expect(estaAtrasada("2026-06-21", "2026-06-21")).toBe(false);
    expect(estaAtrasada("2026-06-22", "2026-06-21")).toBe(false);
    expect(estaAtrasada("", "2026-06-21")).toBe(false);
  });
});

describe("resumos", () => {
  it("diasSemanaResumo ordena e rotula", () => {
    expect(diasSemanaResumo([3, 1])).toBe("Seg, Qua");
    expect(diasSemanaResumo([])).toBe("—");
  });

  it("inclusoResumo lista só o que está incluso (sem chat)", () => {
    expect(inclusoResumo({ treino: true, dieta: true, protocolos: false, checkin: true })).toBe(
      "Treino · Dieta · Check-in"
    );
    expect(inclusoResumo({ treino: false, dieta: false, protocolos: false, checkin: false })).toBe("—");
  });
});

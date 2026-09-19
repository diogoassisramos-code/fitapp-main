import { describe, expect, it } from "vitest";
import { splitDoCoach, TAXA_PLATAFORMA_PCT } from "../plataforma";

describe("splitDoCoach", () => {
  it("sem walletId não monta split (coach sem subconta)", () => {
    expect(splitDoCoach(null)).toBeUndefined();
    expect(splitDoCoach("")).toBeUndefined();
  });

  it("repassa (100 − taxa)% ao coach", () => {
    expect(splitDoCoach("wal_1")).toEqual([
      { walletId: "wal_1", percentualValue: 100 - TAXA_PLATAFORMA_PCT },
    ]);
    expect(splitDoCoach("wal_1", 15)).toEqual([{ walletId: "wal_1", percentualValue: 85 }]);
  });

  it("clampa a taxa em [0, 100] e cai no fallback com NaN", () => {
    expect(splitDoCoach("w", -5)![0].percentualValue).toBe(100);
    expect(splitDoCoach("w", 150)![0].percentualValue).toBe(0);
    expect(splitDoCoach("w", Number.NaN)![0].percentualValue).toBe(100 - TAXA_PLATAFORMA_PCT);
  });
});

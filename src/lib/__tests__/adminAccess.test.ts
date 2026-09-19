import { describe, expect, it } from "vitest";
import { isAdminEmail, ADMIN_EMAILS } from "../adminAccess";

describe("isAdminEmail", () => {
  it("aceita e-mail da allowlist ignorando caixa e espaços", () => {
    const admin = ADMIN_EMAILS[0];
    expect(isAdminEmail(admin)).toBe(true);
    expect(isAdminEmail(`  ${admin.toUpperCase()}  `)).toBe(true);
  });

  it("rejeita quem não está na lista", () => {
    expect(isAdminEmail("alguem@exemplo.com")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
  });
});

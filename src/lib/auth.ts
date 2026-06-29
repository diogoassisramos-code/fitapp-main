/**
 * Auth de protótipo do dashboard — gate de sessão client-side via localStorage.
 *
 * Mantém a regra "a primeira tela ao acessar é o login": qualquer rota fora das
 * públicas (login/cadastro/recuperar-senha) exige a flag de sessão. Será trocado
 * por auth real (backend/DB) quando a camada de dados existir.
 */
const KEY = "coachfit_auth";

export function isAuthed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function signIn(): void {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* ignore (SSR / storage indisponível) */
  }
}

export function signOut(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Rotas acessíveis sem sessão. `/onboarding` é a entrada do aluno (pré-conta). */
export const PUBLIC_PREFIXES = [
  "/login",
  "/cadastro",
  "/recuperar-senha",
  "/onboarding",
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

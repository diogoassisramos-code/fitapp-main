/**
 * Allowlist de acesso ao painel admin da plataforma. FONTE ÚNICA DE VERDADE.
 *
 * Só os e-mails aqui enxergam e entram em /admin. Aplicado em TRÊS camadas:
 *   • middleware (server/edge) — redireciona /admin/* para /login;
 *   • guards das rotas /api/admin/* — respondem 403;
 *   • Sidebar (cliente) — mostra o botão "Painel admin" só para esses e-mails.
 *
 * Isomórfico de propósito (sem imports server/client-only): roda no edge, no
 * servidor e no navegador. E-mails NÃO são segredo — a segurança real é o gate
 * no servidor (middleware + rotas); o botão é só um afeto de UX.
 */
export const ADMIN_EMAILS = ["diogoassisramos@gmail.com"];

/** true se o e-mail está na allowlist (case-insensitive, ignora espaços). */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

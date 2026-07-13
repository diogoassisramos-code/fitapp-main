// ============================================================================
// Guard de rota admin (server-only). Retorna `null` quando o chamador é admin
// (o handler segue) ou uma NextResponse de erro (401/403) para retornar direto.
//
//   const negado = await guardAdmin();
//   if (negado) return negado;
//
// O acesso admin é decidido por E-MAIL (allowlist em @/lib/adminAccess) — a
// mesma fonte de verdade do middleware e do botão. Assim "só o e-mail X é admin"
// vale ponta a ponta, independente do role gravado no JWT/perfil.
// ============================================================================
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isAdminEmail } from "@/lib/adminAccess";

export async function guardAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ erro: "apenas admin" }, { status: 403 });
  }
  return null;
}

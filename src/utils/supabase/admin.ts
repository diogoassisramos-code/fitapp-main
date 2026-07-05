// ============================================================================
// Cliente Supabase com SERVICE ROLE — SERVER-ONLY.
//
// Usa a SUPABASE_SERVICE_ROLE_KEY (secreta) e IGNORA a RLS. É o cliente do
// handler de webhook do Asaas: o Asaas chama sem sessão de usuário, então o
// processamento (marcar pagamento/assinatura) precisa escrever sem depender de
// RLS. NUNCA importar isto de um Client Component — a chave nunca vai ao browser.
// ============================================================================
import { createClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error("supabase/admin.ts é server-only e não pode rodar no navegador.");
}

/** Cria um client Supabase com service_role (bypassa RLS). Sem sessão/cookies. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ausente — necessário para o handler de webhook."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

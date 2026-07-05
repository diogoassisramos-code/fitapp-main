/**
 * `true` quando o gateway Asaas está configurado no ambiente do SERVIDOR.
 * Diferente de `supabaseEnabled`, estas vars NÃO são `NEXT_PUBLIC_*` — a chave
 * do Asaas é secreta e só existe no servidor (nunca vai para o bundle/cliente).
 * As rotas de API checam este flag e respondem 503 quando não configurado.
 */
export const asaasEnabled =
  !!process.env.ASAAS_API_KEY && !!process.env.ASAAS_BASE_URL;

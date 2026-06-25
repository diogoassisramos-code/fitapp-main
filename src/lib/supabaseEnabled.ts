/**
 * `true` quando as chaves do Supabase estão configuradas no ambiente.
 * Enquanto `false`, o app roda no modo protótipo (gate localStorage + mock).
 * As vars NEXT_PUBLIC_* são embutidas no bundle em build time.
 */
export const supabaseEnabled =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

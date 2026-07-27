import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/adminAccess";

/** Prefixos públicos (sem sessão). Espelha PUBLIC_PREFIXES de @/lib/auth, mas
 *  inline para não importar módulo client no edge runtime do proxy. */
const PUBLIC_PREFIXES = ["/login", "/cadastro", "/recuperar-senha", "/onboarding", "/termos", "/privacidade"];

/** Supabase configurado? (protótipo sem env tem gate próprio no AppShell.) */
const SUPABASE_CONFIGURADO =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Refresca a sessão do Supabase a cada request e aplica a guarda de papel:
 * uma sessão de ALUNO não acessa a área do consultor/admin (o login já roteia
 * por papel, mas isto fecha o acesso por URL direta, OAuth ou sessão
 * preexistente). Só restringe aluno — nunca bloqueia consultor/admin.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: nada de lógica entre createServerClient e getClaims (refresca o token).
  const { data: claimsData } = await supabase.auth.getClaims();

  // Guarda de papel: o papel do app vem do user_metadata (setado no signup).
  const claims = claimsData?.claims as
    | { email?: string; user_metadata?: { role?: string } }
    | null
    | undefined;
  const role = claims?.user_metadata?.role;
  const email = claims?.email;
  const path = request.nextUrl.pathname;
  const publico = PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));

  // Gate do PAINEL ADMIN: só e-mails da allowlist (isAdminEmail). Qualquer outro
  // — inclusive sem sessão ou um consultor/aluno — que tente abrir uma página
  // /admin/* é mandado para /login. Não afeta /api/admin/* (as rotas já
  // respondem 401/403 por conta própria). Pulado sem Supabase (protótipo).
  const paginaAdmin = path === "/admin" || path.startsWith("/admin/");
  if (SUPABASE_CONFIGURADO && paginaAdmin && !isAdminEmail(email)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Aluno logado que tenta abrir rota de consultor/admin → volta pra /aluno.
  // Exclui /api (quebraria as chamadas legítimas do aluno) e /aluno (destino).
  if (role === "aluno" && !publico && !path.startsWith("/api") && !path.startsWith("/aluno")) {
    const url = request.nextUrl.clone();
    url.pathname = "/aluno";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

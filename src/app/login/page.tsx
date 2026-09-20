"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button, Input } from "@/components/ui";
import { signIn } from "@/lib/auth";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createClient } from "@/utils/supabase/client";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [carregando, setCarregando] = useState(false);

  /** Alunos vão para a área do aluno; consultor/admin para o painel. */
  async function irParaOApp(supabase: ReturnType<typeof createClient>) {
    let destino = "/";
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (prof?.role === "aluno") destino = "/aluno";
    }
    router.push(destino);
    router.refresh();
  }

  // Volta do link de confirmação de e-mail (cadastro com "Confirm email"
  // ligado): o Supabase redireciona pra cá com `?code=` e o cliente troca por
  // uma sessão ao inicializar — aí seguimos direto pro app. Também cobre quem
  // já está logado e abriu /login. O `?confirmado=1` só mostra o aviso.
  useEffect(() => {
    if (!supabaseEnabled) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("confirmado")) {
      setAviso("E-mail confirmado! Entre com sua senha pra acessar o painel.");
    }
    if (params.get("error_description")) {
      setErro("O link de confirmação expirou ou já foi usado. Entre com sua senha.");
    }
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        irParaOApp(supabase);
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function entrar() {
    setErro("");
    // Guarda contra campos vazios (ex.: autofill que preenche só a senha e não
    // dispara o onChange do e-mail) — evita "clico e nada acontece".
    if (!email.trim() || !senha) {
      setErro("Preencha e-mail e senha.");
      return;
    }

    // Protótipo (sem Supabase): sempre entra.
    if (!supabaseEnabled) {
      signIn();
      router.push("/");
      return;
    }

    setCarregando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });
      if (error) {
        setErro("E-mail ou senha inválidos.");
        return;
      }
      await irParaOApp(supabase);
    } catch {
      // Qualquer falha (rede, exceção do SDK) mostra mensagem em vez de silêncio.
      setErro("Não foi possível entrar agora. Tente novamente em instantes.");
    } finally {
      setCarregando(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    entrar();
  }

  async function entrarComGoogle() {
    setErro("");
    if (supabaseEnabled) {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/` },
      });
      // Em sucesso o navegador é redirecionado ao Google (sem router.push aqui).
      if (error) setErro("Não foi possível entrar com o Google agora.");
      return;
    }
    // Protótipo (sem Supabase): entra direto para demonstração.
    signIn();
    router.push("/");
  }

  return (
    <AuthLayout>
      <div className={styles.head}>
        <h1 className={styles.title}>Entrar</h1>
        <p className={styles.subtitle}>Acesse o painel da sua consultoria.</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        {aviso && (
          <p
            style={{
              margin: 0,
              padding: "var(--space-3) var(--space-4)",
              borderRadius: "var(--border-radius-md)",
              background: "var(--color-background-success)",
              color: "var(--color-text-success)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {aviso}
          </p>
        )}
        <Input
          label="E-mail"
          icon="mail"
          type="email"
          placeholder="voce@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Input
          label="Senha"
          icon="lock"
          type="password"
          placeholder="••••••••"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        <div className={styles.forgot}>
          <Button variant="ghost" size="sm" href="/recuperar-senha">
            Esqueci minha senha
          </Button>
        </div>

        {erro && (
          <p style={{ color: "var(--color-text-danger)", fontSize: 13, margin: 0 }}>
            {erro}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          icon="login"
          fullWidth
          disabled={carregando}
        >
          {carregando ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <div className={styles.divider}>
        <span>ou</span>
      </div>

      <Button
        variant="outline"
        icon="brand-google"
        fullWidth
        onClick={entrarComGoogle}
        disabled={carregando}
      >
        Entrar com Google
      </Button>

      <p className={styles.foot}>
        Não tem uma conta?{" "}
        <Link href="/cadastro" className={styles.footLink}>
          Criar conta
        </Link>
      </p>
    </AuthLayout>
  );
}

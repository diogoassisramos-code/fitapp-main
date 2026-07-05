"use client";

import { useState } from "react";
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
  const [carregando, setCarregando] = useState(false);

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
      // Alunos vão para a área do aluno; consultor/admin para o painel.
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

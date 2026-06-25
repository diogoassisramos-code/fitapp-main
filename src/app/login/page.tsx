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
    if (supabaseEnabled) {
      setCarregando(true);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });
      setCarregando(false);
      if (error) {
        setErro("E-mail ou senha inválidos.");
        return;
      }
      router.push("/");
      router.refresh();
      return;
    }
    // Protótipo (sem Supabase): sempre entra.
    signIn();
    router.push("/");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    entrar();
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
          <p style={{ color: "var(--color-danger)", fontSize: 13, margin: 0 }}>
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
        onClick={entrar}
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

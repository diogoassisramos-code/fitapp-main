"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button, Input } from "@/components/ui";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Protótipo: sempre entra.
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

        <Button type="submit" variant="primary" icon="login" fullWidth>
          Entrar
        </Button>
      </form>

      <div className={styles.divider}>
        <span>ou</span>
      </div>

      <Button
        variant="outline"
        icon="brand-google"
        fullWidth
        onClick={() => router.push("/")}
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

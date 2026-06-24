"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button, Card, CardBody, Input } from "@/components/ui";
import styles from "./recuperar-senha.module.css";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Protótipo: sem backend.
    setEnviado(true);
  }

  if (enviado) {
    return (
      <AuthLayout>
        <Card>
          <CardBody>
            <div className={styles.confirm}>
              <span className={styles.confirmIcon}>
                <i className="ti ti-mail-check" aria-hidden />
              </span>
              <h1 className={styles.title}>E-mail enviado</h1>
              <p className={styles.subtitle}>
                Se existir uma conta para {email || "esse e-mail"}, você
                receberá um link para redefinir a senha em instantes.
              </p>

              <Button variant="outline" href="/login" fullWidth>
                Voltar para o login
              </Button>

              <p className={styles.foot}>
                Não chegou?{" "}
                <button
                  type="button"
                  className={styles.footLink}
                  onClick={() => setEnviado(false)}
                >
                  Reenviar
                </button>
              </p>
            </div>
          </CardBody>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className={styles.head}>
        <h1 className={styles.title}>Recuperar senha</h1>
        <p className={styles.subtitle}>
          Informe seu e-mail e enviaremos um link para redefinir sua senha.
        </p>
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

        <Button type="submit" variant="primary" icon="send" fullWidth>
          Enviar link de recuperação
        </Button>
      </form>

      <p className={styles.foot}>
        Lembrou a senha?{" "}
        <Link href="/login" className={styles.footLink}>
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button, Card, CardBody, Input } from "@/components/ui";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createClient } from "@/utils/supabase/client";
import styles from "./recuperar-senha.module.css";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [reenviado, setReenviado] = useState(false);

  /**
   * Dispara o e-mail de recuperação. O link do e-mail volta pra
   * `/redefinir-senha`, onde o usuário escolhe a senha nova. Não revela se o
   * e-mail existe (resposta igual pra conta existente ou não).
   */
  async function enviar(): Promise<boolean> {
    const alvo = email.trim();
    if (!/\S+@\S+\.\S+/.test(alvo)) {
      setErro("Informe um e-mail válido.");
      return false;
    }
    setErro("");
    // Protótipo (sem Supabase): só mostra a confirmação.
    if (!supabaseEnabled) return true;

    setEnviando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(alvo, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      // Limite de envios do Supabase é o único erro que vale mostrar; o resto
      // segue como "enviado" pra não vazar quais e-mails têm conta.
      if (error && /rate|limit|seconds/i.test(error.message)) {
        setErro("Muitas tentativas. Aguarde um minuto e tente de novo.");
        return false;
      }
      return true;
    } catch {
      setErro("Não foi possível enviar agora. Tente novamente em instantes.");
      return false;
    } finally {
      setEnviando(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (await enviar()) setEnviado(true);
  }

  async function reenviar() {
    setReenviado(false);
    if (await enviar()) setReenviado(true);
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
                Se existir uma conta para <strong>{email}</strong>, você
                receberá um link para redefinir a senha em instantes. Confira
                também a caixa de spam.
              </p>

              {erro && <p className={styles.erro}>{erro}</p>}
              {reenviado && !erro && (
                <p className={styles.ok}>Link reenviado.</p>
              )}

              <Button variant="outline" href="/login" fullWidth>
                Voltar para o login
              </Button>

              <p className={styles.foot}>
                Não chegou?{" "}
                <button
                  type="button"
                  className={styles.footLink}
                  onClick={reenviar}
                  disabled={enviando}
                >
                  {enviando ? "Reenviando…" : "Reenviar"}
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

        {erro && <p className={styles.erro}>{erro}</p>}

        <Button
          type="submit"
          variant="primary"
          icon="send"
          fullWidth
          disabled={enviando}
        >
          {enviando ? "Enviando…" : "Enviar link de recuperação"}
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

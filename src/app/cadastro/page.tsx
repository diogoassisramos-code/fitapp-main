"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button, Input, Segmented } from "@/components/ui";
import styles from "./cadastro.module.css";

type Conselho = "CREF" | "CRN" | "CRM";

const CONSELHO_OPTIONS = [
  { label: "CREF", value: "CREF" as const },
  { label: "CRN", value: "CRN" as const },
  { label: "CRM", value: "CRM" as const },
];

export default function CadastroPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  // Passo 1 — Conta
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");

  // Passo 2 — Consultoria
  const [negocio, setNegocio] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [conselho, setConselho] = useState<Conselho>("CREF");
  const [registro, setRegistro] = useState("");

  function continuar() {
    if (!nome || !email || !celular || !senha || !confirmar) return;
    setStep(2);
  }

  function criarConta() {
    router.push("/");
  }

  return (
    <AuthLayout>
      <header className={styles.header}>
        <h1 className={styles.title}>Criar sua conta</h1>
        <p className={styles.subtitle}>
          Comece a gerenciar sua consultoria em poucos minutos.
        </p>
      </header>

      <ol className={styles.steps} aria-label="Progresso do cadastro">
        <li className={styles.step} data-state={step > 1 ? "done" : "current"}>
          <span className={styles.stepDot}>
            {step > 1 ? <i className="ti ti-check" aria-hidden /> : "1"}
          </span>
          <span className={styles.stepLabel}>Conta</span>
        </li>
        <span className={styles.stepBar} aria-hidden />
        <li
          className={styles.step}
          data-state={step === 2 ? "current" : "upcoming"}
        >
          <span className={styles.stepDot}>2</span>
          <span className={styles.stepLabel}>Consultoria</span>
        </li>
      </ol>

      {step === 1 ? (
        <div className={styles.form}>
          <Input
            label="Nome completo"
            icon="user"
            placeholder="Seu nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <div className={styles.grid2}>
            <Input
              label="E-mail"
              icon="mail"
              type="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Celular"
              icon="phone"
              type="tel"
              placeholder="(11) 90000-0000"
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
            />
          </div>
          <div className={styles.grid2}>
            <Input
              label="Senha"
              icon="lock"
              type="password"
              hint="Mínimo 8 caracteres"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
            <Input
              label="Confirmar senha"
              icon="lock"
              type="password"
              placeholder="••••••••"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
            />
          </div>

          <Button
            variant="primary"
            fullWidth
            iconRight="arrow-right"
            onClick={continuar}
          >
            Continuar
          </Button>
        </div>
      ) : (
        <div className={styles.form}>
          <Input
            label="Nome do negócio"
            icon="building-store"
            placeholder="Ex.: CoachFit"
            value={negocio}
            onChange={(e) => setNegocio(e.target.value)}
          />
          <Input
            label="Especialidade"
            icon="barbell"
            placeholder="Ex.: Hipertrofia"
            value={especialidade}
            onChange={(e) => setEspecialidade(e.target.value)}
          />

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Conselho profissional</span>
            <Segmented
              options={CONSELHO_OPTIONS}
              value={conselho}
              onChange={setConselho}
              ariaLabel="Conselho profissional"
            />
          </div>

          <Input
            label="Número de registro"
            icon="id-badge-2"
            placeholder="123456-G/SP"
            value={registro}
            onChange={(e) => setRegistro(e.target.value)}
          />

          <div className={styles.actions}>
            <Button variant="outline" icon="arrow-left" onClick={() => setStep(1)}>
              Voltar
            </Button>
            <Button variant="primary" icon="check" fullWidth onClick={criarConta}>
              Criar conta
            </Button>
          </div>
        </div>
      )}

      <p className={styles.footer}>
        Já tem uma conta? <Link href="/login">Entrar</Link>
      </p>
    </AuthLayout>
  );
}

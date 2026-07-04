"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button, Input, Segmented } from "@/components/ui";
import type { SegmentedOption } from "@/components/ui";
import { signIn } from "@/lib/auth";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createClient } from "@/utils/supabase/client";
import { brl, FORMA_PAGAMENTO_LABEL } from "@/lib/format";
import { pagamento, type Cobranca } from "@/lib/pagamento";
import type { FormaPagamento } from "@/lib/types";
import styles from "./cadastro.module.css";

/** Validação de CPF (11 dígitos + dígitos verificadores). */
function cpfValido(raw: string): boolean {
  const cpf = raw.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return (
    calc(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    calc(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}

function mascararCpf(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

// ── Planos da plataforma oferecidos no cadastro (1 gratuito + 2 pagos) ────────
type PlanoId = "free" | "pro" | "avancado";
type PlanoCadastro = {
  id: PlanoId;
  nome: string;
  preco: number; // mensal
  limite: string;
  recursos: string[];
  destaque?: boolean;
};

const PLANOS: PlanoCadastro[] = [
  {
    id: "free",
    nome: "Gratuito",
    preco: 0,
    limite: "Até 3 alunos",
    recursos: ["Treino, dieta e protocolo", "Check-in semanal", "1 consultor"],
  },
  {
    id: "pro",
    nome: "Pro",
    preco: 99,
    limite: "Até 150 alunos",
    recursos: [
      "Tudo do Gratuito",
      "Protocolos extras",
      "Link de pagamento",
      "Suporte prioritário",
    ],
    destaque: true,
  },
  {
    id: "avancado",
    nome: "Avançado",
    preco: 249,
    limite: "Alunos ilimitados",
    recursos: [
      "Tudo do Pro",
      "Checkout personalizado",
      "Relatórios avançados",
      "Gerente de conta",
    ],
  },
];

const FORMAS: FormaPagamento[] = ["pix", "cartao"];

type Passo = "conta" | "plano" | "pagamento" | "senha" | "pronto";
const PASSO_LABEL: Record<Passo, string> = {
  conta: "Conta",
  plano: "Plano",
  pagamento: "Pagamento",
  senha: "Senha",
  pronto: "Pronto",
};

export default function CadastroPage() {
  const router = useRouter();
  const [passo, setPasso] = useState<Passo>("conta");

  // Passo 1 — Conta (verificação de e-mail + WhatsApp entra quando as APIs existirem)
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [erro, setErro] = useState("");

  // Passo 2 — Plano
  const [planoId, setPlanoId] = useState<PlanoId>("pro");
  const plano = PLANOS.find((p) => p.id === planoId)!;

  // Passo 3 — Pagamento
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [cobranca, setCobranca] = useState<Cobranca | null>(null);
  const [pagando, setPagando] = useState(false);

  // Passo final — Senha (cria a conta de acesso ao painel)
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [erroSenha, setErroSenha] = useState("");
  const [criando, setCriando] = useState(false);
  const [precisaConfirmar, setPrecisaConfirmar] = useState(false);

  function continuarConta() {
    setErro("");
    if (!nome.trim()) return setErro("Informe seu nome.");
    if (!cpfValido(cpf)) return setErro("CPF inválido.");
    if (!/.+@.+\..+/.test(email)) return setErro("Informe um e-mail válido.");
    if (!celular.trim()) return setErro("Informe seu celular.");
    setPasso("plano");
  }

  function continuarPlano() {
    if (plano.preco === 0) {
      setPasso("senha"); // gratuito pula o pagamento e vai direto criar a senha
    } else {
      setCobranca(null);
      setPasso("pagamento");
    }
  }

  async function pagar() {
    setPagando(true);
    try {
      const c = await pagamento.criarCobranca({
        valor: plano.preco,
        forma,
        descricao: `Assinatura ${plano.nome} · ${nome}`,
      });
      setCobranca(c);
    } finally {
      setPagando(false);
    }
  }

  async function confirmarPagamento() {
    if (!cobranca || !pagamento.confirmar) return;
    setPagando(true);
    try {
      const pago = await pagamento.confirmar(cobranca.id);
      setCobranca(pago);
      setPasso("senha");
    } finally {
      setPagando(false);
    }
  }

  async function criarConta() {
    setErroSenha("");
    if (senha.length < 8) {
      return setErroSenha("A senha precisa de ao menos 8 caracteres.");
    }
    if (senha !== senha2) {
      return setErroSenha("As senhas não conferem.");
    }

    // Protótipo (sem Supabase): só avança.
    if (!supabaseEnabled) {
      setPrecisaConfirmar(false);
      setPasso("pronto");
      return;
    }

    // Cria a conta real. O trigger handle_new_user cria consultoria + profile a
    // partir do role/nome/cpf/telefone/plano no metadata.
    setCriando(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          role: "consultor",
          nome,
          cpf: cpf.replace(/\D/g, ""),
          telefone: celular,
          plano: planoId,
        },
      },
    });
    setCriando(false);
    if (error) {
      setErroSenha(
        /registered|already/i.test(error.message)
          ? "Este e-mail já tem uma conta. Faça login."
          : "Não foi possível criar a conta. Tente de novo."
      );
      return;
    }
    // Com "Confirm email" ligado não há sessão até confirmar → tela de confirmação.
    // Sem confirmação, a sessão já vem e o guard deixa entrar direto.
    setPrecisaConfirmar(!data.session);
    setPasso("pronto");
  }

  function irPainel() {
    if (!supabaseEnabled) signIn();
    router.push("/");
    router.refresh();
  }

  // Passos do indicador — pagamento só aparece pra plano pago.
  const steps: Passo[] =
    plano.preco > 0
      ? ["conta", "plano", "pagamento", "senha"]
      : ["conta", "plano", "senha"];
  const idx = steps.indexOf(passo);
  const primeiro = nome.trim().split(" ")[0] || "";

  const cab =
    passo === "conta"
      ? {
          titulo: "Criar sua conta",
          sub: "Comece a gerenciar sua consultoria em poucos minutos.",
        }
      : passo === "plano"
        ? {
            titulo: "Escolha seu plano",
            sub: "Comece grátis ou desbloqueie mais com um plano pago.",
          }
        : passo === "pagamento"
          ? {
              titulo: "Pagamento",
              sub: `Você está assinando o plano ${plano.nome}.`,
            }
          : passo === "senha"
            ? {
                titulo: "Crie sua senha",
                sub: "Última etapa — defina a senha de acesso ao painel.",
              }
            : null;

  return (
    <AuthLayout>
      {cab && (
        <header className={styles.header}>
          <h1 className={styles.title}>{cab.titulo}</h1>
          <p className={styles.subtitle}>{cab.sub}</p>
        </header>
      )}

      {passo !== "pronto" && (
        <ol className={styles.steps} aria-label="Progresso do cadastro">
          {steps.map((p, i) => (
            <Fragment key={p}>
              {i > 0 && <span className={styles.stepBar} aria-hidden />}
              <li
                className={styles.step}
                data-state={i < idx ? "done" : i === idx ? "current" : "upcoming"}
              >
                <span className={styles.stepDot}>
                  {i < idx ? <i className="ti ti-check" aria-hidden /> : i + 1}
                </span>
                <span className={styles.stepLabel}>{PASSO_LABEL[p]}</span>
              </li>
            </Fragment>
          ))}
        </ol>
      )}

      {/* PASSO 1 — CONTA */}
      {passo === "conta" && (
        <div className={styles.form}>
          <Input
            label="Nome completo"
            icon="user"
            placeholder="Seu nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Input
            label="CPF"
            icon="id"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(mascararCpf(e.target.value))}
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

          <p className={styles.simNota}>
            <i className="ti ti-shield-check" aria-hidden /> Vamos confirmar seu
            e-mail e WhatsApp pra proteger sua conta.
          </p>

          {erro && <p className={styles.erro}>{erro}</p>}

          <Button
            variant="primary"
            fullWidth
            iconRight="arrow-right"
            onClick={continuarConta}
          >
            Continuar
          </Button>
        </div>
      )}

      {/* PASSO 2 — PLANO */}
      {passo === "plano" && (
        <div className={styles.form}>
          <div className={styles.planos}>
            {PLANOS.map((p) => (
              <button
                type="button"
                key={p.id}
                className={styles.plano}
                data-selected={planoId === p.id || undefined}
                onClick={() => setPlanoId(p.id)}
              >
                {p.destaque && <span className={styles.planoBadge}>Popular</span>}
                <div className={styles.planoTop}>
                  <span className={styles.planoNome}>{p.nome}</span>
                  <span className={styles.planoPreco}>
                    {p.preco === 0 ? "Grátis" : brl(p.preco)}
                    {p.preco > 0 && <span className={styles.planoMes}>/mês</span>}
                  </span>
                </div>
                <span className={styles.planoLimite}>{p.limite}</span>
                <ul className={styles.planoRecursos}>
                  {p.recursos.map((r) => (
                    <li key={r}>
                      <i className="ti ti-check" aria-hidden />
                      {r}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>

          <div className={styles.actions}>
            <Button
              variant="outline"
              icon="arrow-left"
              onClick={() => setPasso("conta")}
            >
              Voltar
            </Button>
            <Button
              variant="primary"
              iconRight="arrow-right"
              fullWidth
              onClick={continuarPlano}
            >
              {plano.preco === 0
                ? "Começar grátis"
                : `Continuar · ${brl(plano.preco)}/mês`}
            </Button>
          </div>
        </div>
      )}

      {/* PASSO 3 — PAGAMENTO (só planos pagos) */}
      {passo === "pagamento" && (
        <div className={styles.form}>
          <div className={styles.resumo}>
            <div className={styles.resumoLinha}>
              <span>Plano {plano.nome}</span>
              <strong>{brl(plano.preco)}/mês</strong>
            </div>
            <span className={styles.resumoMeta}>
              Assinatura mensal · cancele quando quiser
            </span>
          </div>

          {!cobranca ? (
            <>
              <span className={styles.fieldLabel}>Forma de pagamento</span>
              <Segmented<FormaPagamento>
                ariaLabel="Forma de pagamento"
                value={forma}
                onChange={setForma}
                options={FORMAS.map(
                  (f): SegmentedOption<FormaPagamento> => ({
                    value: f,
                    label: FORMA_PAGAMENTO_LABEL[f],
                  })
                )}
              />
              <Button icon="lock" fullWidth onClick={pagar} disabled={pagando}>
                {pagando ? "Gerando…" : `Pagar ${brl(plano.preco)}`}
              </Button>
              <p className={styles.simNota}>
                <i className="ti ti-flask" aria-hidden /> Pagamento simulado (sem
                cobrança real).
              </p>
            </>
          ) : (
            <>
              {cobranca.forma === "pix" && cobranca.pixCopiaCola && (
                <div className={styles.pixBox}>
                  <span className={styles.fieldLabel}>PIX copia e cola</span>
                  <code className={styles.pixCode}>{cobranca.pixCopiaCola}</code>
                </div>
              )}
              <div className={styles.aguardando}>
                <i className="ti ti-clock-hour-4" aria-hidden />
                Aguardando confirmação do pagamento…
              </div>
              <Button
                icon="check"
                fullWidth
                onClick={confirmarPagamento}
                disabled={pagando}
              >
                {pagando ? "Confirmando…" : "Já paguei (simular confirmação)"}
              </Button>
            </>
          )}

          <button
            type="button"
            className={styles.voltar}
            onClick={() => setPasso("plano")}
          >
            Voltar
          </button>
        </div>
      )}

      {/* PASSO 4 — SENHA (última página do registro) */}
      {passo === "senha" && (
        <div className={styles.form}>
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
            value={senha2}
            onChange={(e) => setSenha2(e.target.value)}
          />
          {erroSenha && <p className={styles.erro}>{erroSenha}</p>}
          <div className={styles.actions}>
            <Button
              variant="outline"
              icon="arrow-left"
              onClick={() => setPasso(plano.preco > 0 ? "pagamento" : "plano")}
            >
              Voltar
            </Button>
            <Button
              variant="primary"
              icon="check"
              fullWidth
              onClick={criarConta}
              disabled={criando}
            >
              {criando ? "Criando conta…" : "Criar conta"}
            </Button>
          </div>
        </div>
      )}

      {/* PASSO 5 — PRONTO */}
      {passo === "pronto" &&
        (precisaConfirmar ? (
          <div className={styles.pronto}>
            <span className={styles.prontoIcon}>
              <i className="ti ti-mail-check" aria-hidden />
            </span>
            <h1 className={styles.prontoTitle}>Confirme seu e-mail</h1>
            <p className={styles.subtitle} style={{ textAlign: "center" }}>
              Enviamos um link de confirmação para <strong>{email}</strong>.
              Confirme pra ativar sua conta e entrar no painel.
            </p>
            <Button
              variant="primary"
              iconRight="arrow-right"
              fullWidth
              href="/login"
            >
              Ir para o login
            </Button>
          </div>
        ) : (
          <div className={styles.pronto}>
            <span className={styles.prontoIcon}>
              <i className="ti ti-rosette-discount-check" aria-hidden />
            </span>
            <h1 className={styles.prontoTitle}>
              Tudo certo{primeiro ? `, ${primeiro}` : ""}!
            </h1>
            <p className={styles.subtitle} style={{ textAlign: "center" }}>
              {plano.preco === 0 ? (
                <>
                  Sua conta no plano <strong>Gratuito</strong> está pronta. Bora
                  cadastrar seus primeiros alunos.
                </>
              ) : (
                <>
                  Pagamento confirmado ✅ Seu plano <strong>{plano.nome}</strong>{" "}
                  já está ativo.
                </>
              )}
            </p>
            <Button
              variant="primary"
              iconRight="arrow-right"
              fullWidth
              onClick={irPainel}
            >
              Ir para o painel
            </Button>
          </div>
        ))}

      {passo === "conta" && (
        <p className={styles.footer}>
          Já tem uma conta? <Link href="/login">Entrar</Link>
        </p>
      )}
    </AuthLayout>
  );
}

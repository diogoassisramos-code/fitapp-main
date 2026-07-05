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
import { cpfValido, mascararCpf } from "@/lib/cpf";
import type { FormaPagamento } from "@/lib/types";
import styles from "./cadastro.module.css";

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
    limite: "Até 10 alunos",
    recursos: [
      "Treino, dieta e protocolo",
      "Recebimento de check-in",
      "Recebimento pela plataforma (cartão recorrente do aluno)",
    ],
  },
  {
    id: "pro",
    nome: "Revo Pro",
    preco: 60,
    limite: "Até 150 alunos",
    recursos: [
      "Tudo do Gratuito",
      "Recebimento pela plataforma (cartão recorrente do aluno)",
      "Suporte exclusivo com o time",
    ],
    destaque: true,
  },
  {
    id: "avancado",
    nome: "Revo Pro Max",
    preco: 120,
    limite: "Alunos ilimitados",
    recursos: [
      "Tudo do Revo Pro",
      "Recebimento pela plataforma (cartão recorrente do aluno)",
      "Suporte exclusivo 24 horas",
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

  // Passo Pagamento (real, via Asaas — só plano pago, já com a conta criada)
  const [forma, setForma] = useState<FormaPagamento>("cartao");
  const [numeroCartao, setNumeroCartao] = useState("");
  const [validade, setValidade] = useState(""); // MM/AA
  const [cvv, setCvv] = useState("");
  const [nomeTitular, setNomeTitular] = useState("");
  const [cpfTitular, setCpfTitular] = useState("");
  const [cep, setCep] = useState("");
  const [numeroEndereco, setNumeroEndereco] = useState("");
  const [pix, setPix] = useState<{ copiaCola: string; qrCodeImage: string } | null>(null);
  const [pagando, setPagando] = useState(false);
  const [erroPagamento, setErroPagamento] = useState("");

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
    // Pago: coleta o pagamento; depois cria a senha (conta). Grátis: direto à senha.
    setPasso(plano.preco > 0 ? "pagamento" : "senha");
  }

  /** Preenche o cartão de teste do sandbox (aprovação garantida). */
  function preencherCartaoTeste() {
    setNumeroCartao("4444 4444 4444 4444");
    setValidade("12/30");
    setCvv("123");
    setNomeTitular(nome || "Teste Titular");
    setCpfTitular(mascararCpf(cpf || "11144477735"));
    setCep("01001-000");
    setNumeroEndereco("100");
    setErroPagamento("");
  }

  /**
   * Valida a forma de pagamento e avança para a senha. NÃO cobra ainda — a
   * cobrança dispara logo depois de criar a conta (a assinatura precisa do coach
   * logado). Assim a ordem que o coach vê é pagamento → senha.
   */
  function continuarPagamento() {
    setErroPagamento("");
    if (forma === "cartao") {
      const num = numeroCartao.replace(/\s/g, "");
      const [mm, aa] = validade.split("/");
      if (
        num.length < 13 || !mm || !aa || cvv.length < 3 ||
        !nomeTitular.trim() || !cpfValido(cpfTitular) ||
        cep.replace(/\D/g, "").length < 8 || !numeroEndereco.trim()
      ) {
        setErroPagamento("Confira os dados do cartão e do titular.");
        return;
      }
    }
    setPasso("senha");
  }

  /**
   * Cria a assinatura no Asaas (chamada logo APÓS o signUp, já logado).
   * Retorna a mensagem de erro (string) ou null em caso de sucesso.
   */
  async function finalizarAssinatura(): Promise<string | null> {
    const num = numeroCartao.replace(/\s/g, "");
    const [mm, aa] = validade.split("/");
    const payload =
      forma === "cartao"
        ? {
            forma: "cartao",
            cartao: {
              number: num,
              holderName: nomeTitular.trim(),
              expiryMonth: mm.padStart(2, "0"),
              expiryYear: aa.length === 2 ? "20" + aa : aa,
              ccv: cvv,
              holderCpf: cpfTitular.replace(/\D/g, ""),
              postalCode: cep.replace(/\D/g, ""),
              addressNumber: numeroEndereco.trim(),
              phone: celular,
            },
          }
        : { forma: "pix" };
    try {
      const res = await fetch("/api/asaas/assinatura-consultor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return data.erro || "Não foi possível processar o pagamento.";
      if (data.pix) setPix(data.pix);
      return null;
    } catch {
      return "Falha de conexão ao processar o pagamento.";
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

    // Protótipo (sem Supabase): sem cobrança real, vai direto pro pronto.
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
    // Sem sessão (Confirm email ligado) → tela de confirmação; não dá pra cobrar.
    if (!data.session) {
      setPrecisaConfirmar(true);
      setPasso("pronto");
      return;
    }
    setPrecisaConfirmar(false);
    // Conta criada e logado: agora sim dispara a assinatura (pagamento já
    // coletado no passo anterior). Vai pro pronto com o resultado.
    if (plano.preco > 0) {
      setCriando(true);
      const erroAssin = await finalizarAssinatura();
      setCriando(false);
      setErroPagamento(erroAssin || "");
    }
    setPasso("pronto");
  }

  function irPainel() {
    if (!supabaseEnabled) signIn();
    router.push("/");
    router.refresh();
  }

  // Ordem: dados → plano → pagamento → senha. A cobrança de fato dispara logo
  // após criar a conta (a assinatura precisa do coach logado). Pagamento só pago.
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

          <span className={styles.fieldLabel}>Forma de pagamento</span>
          <Segmented<FormaPagamento>
            ariaLabel="Forma de pagamento"
            value={forma}
            onChange={(f) => {
              setForma(f);
              setPix(null);
              setErroPagamento("");
            }}
            options={FORMAS.map(
              (f): SegmentedOption<FormaPagamento> => ({
                value: f,
                label: FORMA_PAGAMENTO_LABEL[f],
              })
            )}
          />

          {forma === "cartao" ? (
            <>
              <Input
                label="Número do cartão"
                icon="credit-card"
                inputMode="numeric"
                placeholder="0000 0000 0000 0000"
                value={numeroCartao}
                onChange={(e) => setNumeroCartao(e.target.value)}
              />
              <div className={styles.grid}>
                <Input
                  label="Validade (MM/AA)"
                  placeholder="12/30"
                  value={validade}
                  onChange={(e) => setValidade(e.target.value)}
                />
                <Input
                  label="CVV"
                  inputMode="numeric"
                  placeholder="123"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                />
              </div>
              <Input
                label="Nome no cartão"
                icon="user"
                value={nomeTitular}
                onChange={(e) => setNomeTitular(e.target.value)}
              />
              <Input
                label="CPF do titular"
                icon="id"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpfTitular}
                onChange={(e) => setCpfTitular(mascararCpf(e.target.value))}
              />
              <div className={styles.grid}>
                <Input
                  label="CEP"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                />
                <Input
                  label="Número"
                  inputMode="numeric"
                  placeholder="100"
                  value={numeroEndereco}
                  onChange={(e) => setNumeroEndereco(e.target.value)}
                />
              </div>
              {erroPagamento && <p className={styles.erro}>{erroPagamento}</p>}
              <Button icon="arrow-right" fullWidth onClick={continuarPagamento}>
                Continuar
              </Button>
              <button
                type="button"
                className={styles.voltar}
                onClick={preencherCartaoTeste}
              >
                <i className="ti ti-flask" aria-hidden /> Usar cartão de teste (sandbox)
              </button>
            </>
          ) : (
            <>
              <div className={styles.aguardando}>
                <i className="ti ti-qrcode" aria-hidden />
                Você vai pagar via PIX. O QR code aparece no fim, ao criar a conta.
              </div>
              {erroPagamento && <p className={styles.erro}>{erroPagamento}</p>}
              <Button icon="arrow-right" fullWidth onClick={continuarPagamento}>
                Continuar
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
              ) : erroPagamento ? (
                <>
                  Sua conta foi criada, mas o pagamento não passou: {erroPagamento}{" "}
                  Dá pra tentar de novo abaixo.
                </>
              ) : pix ? (
                <>
                  Conta criada! Pague o PIX abaixo para ativar o{" "}
                  <strong>{plano.nome}</strong>.
                </>
              ) : (
                <>
                  Assinatura criada! Seu plano <strong>{plano.nome}</strong> ativa
                  automaticamente assim que o pagamento confirmar.
                </>
              )}
            </p>
            {pix && (
              <div className={styles.pixBox} style={{ marginBottom: "var(--space-4)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${pix.qrCodeImage}`}
                  alt="QR Code do PIX"
                  style={{ width: 180, height: 180, alignSelf: "center", borderRadius: 8 }}
                />
                <span className={styles.fieldLabel}>PIX copia e cola</span>
                <code className={styles.pixCode}>{pix.copiaCola}</code>
              </div>
            )}
            {erroPagamento ? (
              <>
                <Button
                  variant="primary"
                  icon="refresh"
                  fullWidth
                  onClick={() => {
                    setErroPagamento("");
                    setPasso("pagamento");
                  }}
                >
                  Tentar pagamento de novo
                </Button>
                <button type="button" className={styles.voltar} onClick={irPainel}>
                  Ir para o painel mesmo assim
                </button>
              </>
            ) : (
              <Button
                variant="primary"
                iconRight="arrow-right"
                fullWidth
                onClick={irPainel}
              >
                Ir para o painel
              </Button>
            )}
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

"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Segmented } from "@/components/ui";
import type { SegmentedOption } from "@/components/ui";
import { planos } from "@/lib/data";
import { brl, FORMA_PAGAMENTO_LABEL } from "@/lib/format";
import { getTestAlunoByToken, completarTestAluno } from "@/lib/testAlunos";
import { pagamento, type Cobranca } from "@/lib/pagamento";
import type { FormaPagamento } from "@/lib/types";
import styles from "./onboarding.module.css";

type Passo = "dados" | "pagamento" | "senha" | "pronto";
const PASSOS: Passo[] = ["dados", "pagamento", "senha", "pronto"];
const PASSO_LABEL: Record<Passo, string> = {
  dados: "Seus dados",
  pagamento: "Pagamento",
  senha: "Criar senha",
  pronto: "Tudo pronto",
};

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

export default function OnboardingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();

  // Plano de exemplo — no fluxo real, resolvido a partir do link de compra.
  const plano = planos[0];

  const [passo, setPasso] = useState<Passo>("dados");
  // No fluxo real vem da consultoria do link; placeholder no protótipo.
  const consultorNome = "seu treinador";

  // Dados
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erroDados, setErroDados] = useState("");

  // Pagamento
  const [forma, setForma] = useState<FormaPagamento>(plano.formasPagamento[0] ?? "pix");
  const [cobranca, setCobranca] = useState<Cobranca | null>(null);
  const [pagando, setPagando] = useState(false);

  // Senha
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [erroSenha, setErroSenha] = useState("");
  const [criando, setCriando] = useState(false);
  const [alunoId, setAlunoId] = useState<string | null>(null);

  // Prefill a partir do convite (modo protótipo: aluno de teste no localStorage).
  useEffect(() => {
    const t = getTestAlunoByToken(token);
    if (t) {
      setNome(t.nome);
      setEmail(t.email);
      setTelefone(t.telefone);
      setAlunoId(t.id);
    }
  }, [token]);

  function avancarDados() {
    setErroDados("");
    if (!nome.trim()) return setErroDados("Informe seu nome.");
    if (!/.+@.+\..+/.test(email)) return setErroDados("Informe um e-mail válido.");
    if (!cpfValido(cpf)) return setErroDados("CPF inválido.");
    setPasso("pagamento");
  }

  async function pagar() {
    setPagando(true);
    try {
      const c = await pagamento.criarCobranca({
        valor: plano.preco,
        forma,
        descricao: `${plano.nome} · ${nome}`,
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
    if (senha.length < 6) return setErroSenha("A senha precisa de ao menos 6 caracteres.");
    if (senha !== senha2) return setErroSenha("As senhas não conferem.");
    setCriando(true);
    try {
      // PROTÓTIPO: conclui o aluno de teste. No modo Supabase, este passo chama
      // supabase.auth.signUp({ email, password, options: { data: { role:'aluno',
      // consultoria_id, aluno_id } } }) — o trigger handle_new_user cria o profile.
      if (alunoId) completarTestAluno(alunoId, { email, telefone });
      setPasso("pronto");
    } finally {
      setCriando(false);
    }
  }

  const indiceAtual = PASSOS.indexOf(passo);

  return (
    <div className={styles.canvas}>
      <div className={styles.card}>
        <header className={styles.head}>
          <span className={styles.brand}>
            <i className="ti ti-barbell" aria-hidden /> CoachFit
          </span>
          {passo !== "pronto" && (
            <span className={styles.conviteDe}>Convite de {consultorNome}</span>
          )}
        </header>

        {/* Stepper */}
        {passo !== "pronto" && (
          <div className={styles.stepper}>
            {PASSOS.slice(0, 3).map((p, i) => (
              <div
                key={p}
                className={styles.step}
                data-state={
                  i < indiceAtual ? "done" : i === indiceAtual ? "current" : "todo"
                }
              >
                <span className={styles.stepDot}>
                  {i < indiceAtual ? <i className="ti ti-check" aria-hidden /> : i + 1}
                </span>
                <span className={styles.stepLabel}>{PASSO_LABEL[p]}</span>
              </div>
            ))}
          </div>
        )}

        {/* PASSO 1 — DADOS */}
        {passo === "dados" && (
          <div className={styles.body}>
            <h1 className={styles.title}>Bem-vindo(a)! Vamos começar.</h1>
            <p className={styles.sub}>
              Você está contratando <strong>{plano.nome}</strong>. Confirme seus
              dados.
            </p>
            <Input label="Nome completo" icon="user" value={nome} onChange={(e) => setNome(e.target.value)} />
            <Input label="E-mail" icon="mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input
              label="CPF"
              icon="id"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(mascararCpf(e.target.value))}
              hint="Seu CPF é a sua identidade no app — vale mesmo se você trocar de treinador."
            />
            <Input label="Celular" icon="phone" inputMode="tel" placeholder="(11) 99999-9999" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            {erroDados && <p className={styles.erro}>{erroDados}</p>}
            <Button icon="arrow-right" fullWidth onClick={avancarDados}>
              Continuar
            </Button>
          </div>
        )}

        {/* PASSO 2 — PAGAMENTO */}
        {passo === "pagamento" && (
          <div className={styles.body}>
            <h1 className={styles.title}>Pagamento</h1>
            <div className={styles.resumo}>
              <div className={styles.resumoLinha}>
                <span>{plano.nome}</span>
                <strong>{brl(plano.preco)}</strong>
              </div>
              <span className={styles.resumoMeta}>
                {plano.periodoRecorrencia ? "Cobrança recorrente" : "Pagamento único"}
              </span>
            </div>

            {!cobranca ? (
              <>
                <span className={styles.fieldLabel}>Forma de pagamento</span>
                <Segmented<FormaPagamento>
                  ariaLabel="Forma de pagamento"
                  value={forma}
                  onChange={setForma}
                  options={plano.formasPagamento.map(
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
                  <i className="ti ti-flask" aria-hidden /> Pagamento simulado
                  (sem cobrança real).
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
                <Button icon="check" fullWidth onClick={confirmarPagamento} disabled={pagando}>
                  {pagando ? "Confirmando…" : "Já paguei (simular confirmação)"}
                </Button>
              </>
            )}
            <button type="button" className={styles.voltar} onClick={() => setPasso("dados")}>
              Voltar
            </button>
          </div>
        )}

        {/* PASSO 3 — SENHA */}
        {passo === "senha" && (
          <div className={styles.body}>
            <h1 className={styles.title}>Crie sua senha</h1>
            <p className={styles.sub}>
              Pagamento confirmado ✅ Agora crie uma senha para acessar o app.
            </p>
            <Input label="E-mail" icon="mail" value={email} disabled readOnly />
            <Input label="Senha" icon="lock" type="password" placeholder="mín. 6 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)} />
            <Input label="Confirmar senha" icon="lock-check" type="password" value={senha2} onChange={(e) => setSenha2(e.target.value)} />
            {erroSenha && <p className={styles.erro}>{erroSenha}</p>}
            <Button icon="user-check" fullWidth onClick={criarConta} disabled={criando}>
              {criando ? "Criando conta…" : "Criar conta"}
            </Button>
          </div>
        )}

        {/* PASSO 4 — PRONTO / APP */}
        {passo === "pronto" && (
          <ProntoStep
            nome={nome}
            onAbrir={() =>
              router.push(`/aluno${alunoId ? `?aluno=${alunoId}` : ""}`)
            }
          />
        )}
      </div>
    </div>
  );
}

/** Passo final: sucesso + instalar app (PWA) + abrir a área do aluno. */
function ProntoStep({ nome, onAbrir }: { nome: string; onAbrir: () => void }) {
  const deferred = useRef<{ prompt: () => void } | null>(null);
  const [podeInstalar, setPodeInstalar] = useState(false);

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      deferred.current = e as unknown as { prompt: () => void };
      setPodeInstalar(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function instalar() {
    deferred.current?.prompt();
  }

  const primeiro = nome.split(" ")[0] || "";

  return (
    <div className={styles.pronto}>
      <span className={styles.prontoIcon}>
        <i className="ti ti-rosette-discount-check" aria-hidden />
      </span>
      <h1 className={styles.prontoTitle}>Tudo certo{primeiro ? `, ${primeiro}` : ""}!</h1>
      <p className={styles.sub}>
        Sua conta está criada. Instale o app na tela inicial para acessar seu
        treino, dieta e check-ins.
      </p>
      {podeInstalar ? (
        <Button icon="download" fullWidth onClick={instalar}>
          Instalar o app
        </Button>
      ) : (
        <p className={styles.instrucao}>
          <i className="ti ti-device-mobile" aria-hidden /> No celular, toque em
          “Compartilhar” → “Adicionar à Tela de Início”.
        </p>
      )}
      <Button variant="outline" icon="arrow-right" fullWidth onClick={onAbrir}>
        Abrir minha área agora
      </Button>
    </div>
  );
}

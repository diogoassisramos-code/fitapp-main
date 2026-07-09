"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Segmented } from "@/components/ui";
import type { SegmentedOption } from "@/components/ui";
import { planos } from "@/lib/data";
import { brl } from "@/lib/format";
import { getTestAlunoByToken, completarTestAluno } from "@/lib/testAlunos";
import { cpfValido, mascararCpf } from "@/lib/cpf";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createClient } from "@/utils/supabase/client";
import styles from "./onboarding.module.css";

type Passo = "dados" | "login" | "pagamento" | "senha" | "pronto";
const PASSO_LABEL: Record<Passo, string> = {
  dados: "Seus dados",
  login: "Entrar",
  pagamento: "Pagamento",
  senha: "Criar senha",
  pronto: "Tudo pronto",
};
type Forma = "cartao" | "pix";
const FORMA_LABEL: Record<Forma, string> = { cartao: "Cartão", pix: "Pix" };

type Convite = { coachNome: string; alunoNome?: string; valor: number; descricao: string };

export default function OnboardingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const emReal = supabaseEnabled;

  const [passo, setPasso] = useState<Passo>("dados");
  // Quem já tem conta na Revo: fluxo idêntico até o pagamento; o 3º passo vira
  // LOGIN (entrar com a senha existente) em vez de CRIAR SENHA.
  const [contaExiste, setContaExiste] = useState(false);
  const passos: Passo[] = ["dados", "pagamento", contaExiste ? "login" : "senha", "pronto"];

  // Convite resolvido (modo real) — coach + preço.
  const [convite, setConvite] = useState<Convite | null>(null);
  const [carregandoConvite, setCarregandoConvite] = useState(emReal);
  const [erroConvite, setErroConvite] = useState("");

  // Dados do aluno
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erroDados, setErroDados] = useState("");

  // Pagamento
  const [forma, setForma] = useState<Forma>("cartao");
  const [numeroCartao, setNumeroCartao] = useState("");
  const [validade, setValidade] = useState("");
  const [cvv, setCvv] = useState("");
  const [cep, setCep] = useState("");
  const [numeroEndereco, setNumeroEndereco] = useState("");
  const [pix, setPix] = useState<{ copiaCola: string; qrCodeImage: string } | null>(null);
  const [pagando, setPagando] = useState(false);
  const [erroPagamento, setErroPagamento] = useState("");

  // Senha (só protótipo)
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [erroSenha, setErroSenha] = useState("");
  const [criando, setCriando] = useState(false);
  const [alunoId, setAlunoId] = useState<string | null>(null);
  // Modo real: ids retornados pelo pagamento (para criar a conta do aluno).
  const [contaAluno, setContaAluno] = useState<{ alunoId: string; consultoriaId: string } | null>(null);

  // Login (quem já tem conta) + checagem de identidade no passo 1.
  const [loginSenha, setLoginSenha] = useState("");
  const [erroLogin, setErroLogin] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [checando, setChecando] = useState(false);

  // Preço/título: modo real vem do convite; protótipo usa um plano de exemplo.
  const planoProto = planos[0];
  const valor = emReal ? convite?.valor ?? 0 : planoProto.preco;
  const titulo = emReal ? convite?.descricao || "Mensalidade" : planoProto.nome;
  const consultorNome = emReal ? convite?.coachNome || "seu treinador" : "seu treinador";
  // Primeiro nome quando o coach preencheu o nome do aluno no convite → saudação nominal.
  const primeiroNome = convite?.alunoNome?.trim().split(/\s+/)[0] || "";

  // Resolve o convite (real) ou prefill do aluno de teste (protótipo).
  useEffect(() => {
    if (!emReal) {
      const t = getTestAlunoByToken(token);
      if (t) {
        setNome(t.nome);
        setEmail(t.email);
        setTelefone(t.telefone);
        setAlunoId(t.id);
      }
      return;
    }
    let active = true;
    setCarregandoConvite(true);
    fetch(`/api/onboarding/resolver?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d.ok) {
          setConvite({ coachNome: d.coachNome, alunoNome: d.alunoNome ?? undefined, valor: d.valor, descricao: d.descricao });
          // Coach já preencheu o nome no convite → pré-preenche (sem sobrescrever o que o aluno digitar).
          if (d.alunoNome) setNome((n) => n || d.alunoNome);
        } else setErroConvite(d.erro || "Convite inválido.");
      })
      .catch(() => active && setErroConvite("Não foi possível carregar o convite."))
      .finally(() => active && setCarregandoConvite(false));
    return () => {
      active = false;
    };
  }, [token, emReal]);

  async function avancarDados() {
    setErroDados("");
    if (!nome.trim()) return setErroDados("Informe seu nome.");
    if (!/.+@.+\..+/.test(email)) return setErroDados("Informe um e-mail válido.");
    if (!cpfValido(cpf)) return setErroDados("CPF inválido.");
    if (telefone.replace(/\D/g, "").length < 10)
      return setErroDados("Informe seu celular com DDD (o Asaas exige para o pagamento).");
    // Já tem conta na Revo? (por e-mail OU CPF). Se sim, o fim do fluxo vira login.
    if (emReal) {
      setChecando(true);
      try {
        const res = await fetch("/api/onboarding/checar-identidade", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, email: email.trim(), cpf: cpf.replace(/\D/g, "") }),
        });
        const d = await res.json().catch(() => ({}));
        // Só o e-mail decide o LOGIN: CPF sem conta de acesso = conta nova (senha).
        // (CPF existente sem login não conseguiria logar → dead-end.)
        setContaExiste(!!d.emailExiste);
      } catch {
        setContaExiste(false);
      } finally {
        setChecando(false);
      }
    }
    setPasso("pagamento");
  }

  async function pagar() {
    setErroPagamento("");

    // Protótipo: sem cobrança real, só avança.
    if (!emReal) {
      setPasso("senha");
      return;
    }

    // Modo real: valida o cartão (se cartão) e chama a rota de pagamento.
    let cartao: Record<string, string> | undefined;
    if (forma === "cartao") {
      const num = numeroCartao.replace(/\s/g, "");
      const [mm, aa] = validade.split("/");
      if (num.length < 13 || !mm || !aa || cvv.length < 3 || cep.replace(/\D/g, "").length < 8 || !numeroEndereco.trim()) {
        setErroPagamento("Confira os dados do cartão e o endereço de cobrança.");
        return;
      }
      cartao = {
        number: num,
        holderName: nome.trim(),
        expiryMonth: mm.padStart(2, "0"),
        expiryYear: aa,
        ccv: cvv,
        postalCode: cep.replace(/\D/g, ""),
        addressNumber: numeroEndereco.trim(),
      };
    }

    setPagando(true);
    try {
      const res = await fetch("/api/onboarding/pagar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          aluno: { nome: nome.trim(), cpf: cpf.replace(/\D/g, ""), email: email.trim(), telefone },
          forma,
          cartao,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErroPagamento(data.erro || "Não foi possível processar o pagamento.");
        return;
      }
      if (data.alunoId) {
        setContaAluno({ alunoId: data.alunoId, consultoriaId: data.consultoriaId });
      }
      if (data.pix) setPix(data.pix); // mostra o QR; depois cria a senha / faz login
      else setPasso(contaExiste ? "login" : "senha");
    } catch {
      setErroPagamento("Falha de conexão. Tente novamente.");
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
      if (emReal) {
        if (!contaAluno) {
          setErroSenha("Conclua o pagamento antes de criar a conta.");
          return;
        }
        // Cria a conta do aluno ligada à consultoria (o trigger handle_new_user
        // valida o aluno_id + consultoria_id e cria o profile role='aluno').
        const supabase = createClient();
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: {
            data: {
              role: "aluno",
              consultoria_id: contaAluno.consultoriaId,
              aluno_id: contaAluno.alunoId,
            },
          },
        });
        if (error) {
          if (/registered|already/i.test(error.message)) {
            // E-mail já tem conta (a checagem falhou ou foi pulada) → recupera
            // pro login em vez de deixar o usuário preso após já ter pago.
            setContaExiste(true);
            setErroLogin("Você já tem conta na Revo — entre para concluir.");
            setPasso("login");
          } else {
            setErroSenha("Não foi possível criar a conta. Tente de novo.");
          }
          return;
        }
      } else if (alunoId) {
        completarTestAluno(alunoId, { email, telefone });
      }
      setPasso("pronto");
    } finally {
      setCriando(false);
    }
  }

  // Quem já tem conta: entra com a senha existente e religa o perfil ao aluno
  // recém-contratado (última consultoria). Sem criar conta nova.
  async function entrar() {
    setErroLogin("");
    if (!loginSenha) return setErroLogin("Informe sua senha.");
    setEntrando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: loginSenha,
      });
      if (error) {
        setErroLogin("E-mail ou senha inválidos.");
        return;
      }
      // Religa o perfil ao aluno da compra recém-concluída. O servidor deriva o
      // aluno do TOKEN (convite usado) — não confiamos em id vindo do cliente.
      const res = await fetch("/api/onboarding/vincular", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setErroLogin(
          data.erro || "Você entrou, mas não consegui vincular ao novo plano. Tente de novo."
        );
        return;
      }
      setPasso("pronto");
    } finally {
      setEntrando(false);
    }
  }

  const indiceAtual = passos.indexOf(passo);

  // Estados de carregamento/erro do convite (modo real).
  if (emReal && carregandoConvite) {
    return (
      <div className={styles.canvas}>
        <div className={styles.card}>
          <div className={styles.body}>
            <p className={styles.sub}>Carregando convite…</p>
          </div>
        </div>
      </div>
    );
  }
  if (emReal && erroConvite) {
    return (
      <div className={styles.canvas}>
        <div className={styles.card}>
          <div className={styles.body}>
            <h1 className={styles.title}>Convite indisponível</h1>
            <p className={styles.sub}>{erroConvite}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.canvas}>
      <div className={styles.card}>
        <header className={styles.head}>
          <span className={styles.brand}>
            <img
              src="/icon.svg"
              alt=""
              style={{ width: 22, height: 22, borderRadius: 5, display: "block" }}
            />{" "}
            Revo
          </span>
          {passo !== "pronto" && (
            <span className={styles.conviteDe}>Convite de {consultorNome}</span>
          )}
        </header>

        {passo !== "pronto" && (
          <div className={styles.stepper}>
            {passos.slice(0, -1).map((p, i) => (
              <div
                key={p}
                className={styles.step}
                data-state={i < indiceAtual ? "done" : i === indiceAtual ? "current" : "todo"}
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
            <h1 className={styles.title}>
              {primeiroNome ? `Olá, ${primeiroNome}! Vamos começar.` : "Bem-vindo(a)! Vamos começar."}
            </h1>
            <p className={styles.sub}>
              Você está contratando <strong>{titulo}</strong>
              {valor > 0 ? <> por <strong>{brl(valor)}/mês</strong></> : null}. Confirme seus dados.
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
            <Button icon="arrow-right" fullWidth onClick={avancarDados} disabled={checando}>
              {checando ? "Verificando…" : "Continuar"}
            </Button>
          </div>
        )}

        {/* PASSO 2 — PAGAMENTO */}
        {passo === "pagamento" && (
          <div className={styles.body}>
            <h1 className={styles.title}>Pagamento</h1>
            <div className={styles.resumo}>
              <div className={styles.resumoLinha}>
                <span>{titulo}</span>
                <strong>{brl(valor)}/mês</strong>
              </div>
              <span className={styles.resumoMeta}>Cobrança recorrente · cancele quando quiser</span>
            </div>

            {contaExiste && (
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "var(--color-text-warning)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <i className="ti ti-user-check" aria-hidden /> Você já tem conta na Revo — pague
                normalmente e, no fim, entre com sua senha.
              </p>
            )}

            {pix ? (
              <>
                <div className={styles.pixBox}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/png;base64,${pix.qrCodeImage}`}
                    alt="QR Code do PIX"
                    style={{ width: 180, height: 180, alignSelf: "center", borderRadius: 8 }}
                  />
                  <span className={styles.fieldLabel}>PIX copia e cola</span>
                  <code className={styles.pixCode}>{pix.copiaCola}</code>
                </div>
                <div className={styles.aguardando}>
                  <i className="ti ti-clock-hour-4" aria-hidden /> Pague o PIX para ativar sua mensalidade.
                </div>
                <Button icon="arrow-right" fullWidth onClick={() => setPasso(contaExiste ? "login" : "senha")}>
                  Continuar
                </Button>
              </>
            ) : (
              <>
                <span className={styles.fieldLabel}>Forma de pagamento</span>
                <Segmented<Forma>
                  ariaLabel="Forma de pagamento"
                  value={forma}
                  onChange={(f) => {
                    setForma(f);
                    setErroPagamento("");
                  }}
                  options={(["cartao", "pix"] as Forma[]).map(
                    (f): SegmentedOption<Forma> => ({ value: f, label: FORMA_LABEL[f] })
                  )}
                />

                {emReal && forma === "cartao" && (
                  <>
                    <Input label="Número do cartão" icon="credit-card" inputMode="numeric" placeholder="0000 0000 0000 0000" value={numeroCartao} onChange={(e) => setNumeroCartao(e.target.value)} />
                    <div className={styles.doisCampos}>
                      <Input label="Validade (MM/AA)" placeholder="12/30" value={validade} onChange={(e) => setValidade(e.target.value)} />
                      <Input label="CVV" inputMode="numeric" placeholder="123" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} />
                    </div>
                    <div className={styles.doisCampos}>
                      <Input label="CEP" inputMode="numeric" placeholder="00000-000" value={cep} onChange={(e) => setCep(e.target.value)} />
                      <Input label="Número" inputMode="numeric" placeholder="100" value={numeroEndereco} onChange={(e) => setNumeroEndereco(e.target.value)} />
                    </div>
                  </>
                )}

                {erroPagamento && <p className={styles.erro}>{erroPagamento}</p>}
                <Button icon="lock" fullWidth onClick={pagar} disabled={pagando}>
                  {pagando
                    ? "Processando…"
                    : forma === "pix"
                    ? "Gerar PIX"
                    : `Pagar ${brl(valor)}/mês`}
                </Button>
                {!emReal && (
                  <p className={styles.simNota}>
                    <i className="ti ti-flask" aria-hidden /> Pagamento simulado (sem cobrança real).
                  </p>
                )}
              </>
            )}
            <button type="button" className={styles.voltar} onClick={() => setPasso("dados")}>
              Voltar
            </button>
          </div>
        )}

        {/* PASSO 3 — SENHA (só protótipo) */}
        {passo === "senha" && (
          <div className={styles.body}>
            <h1 className={styles.title}>Crie sua senha</h1>
            <p className={styles.sub}>Agora crie uma senha para acessar o app.</p>
            <Input label="E-mail" icon="mail" value={email} disabled readOnly />
            <Input label="Senha" icon="lock" type="password" placeholder="mín. 6 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)} />
            <Input label="Confirmar senha" icon="lock-check" type="password" value={senha2} onChange={(e) => setSenha2(e.target.value)} />
            {erroSenha && <p className={styles.erro}>{erroSenha}</p>}
            <Button icon="user-check" fullWidth onClick={criarConta} disabled={criando}>
              {criando ? "Criando conta…" : "Criar conta"}
            </Button>
          </div>
        )}

        {/* PASSO 3b — LOGIN (quem já tem conta na Revo) */}
        {passo === "login" && (
          <div className={styles.body}>
            <h1 className={styles.title}>Entre na sua conta</h1>
            <p className={styles.sub}>
              Você já tem conta na Revo — entre com sua senha para concluir. Sua
              área passa a acompanhar <strong>{consultorNome}</strong>.
            </p>
            <Input label="E-mail" icon="mail" value={email} disabled readOnly />
            <Input
              label="Senha"
              icon="lock"
              type="password"
              placeholder="sua senha"
              value={loginSenha}
              onChange={(e) => setLoginSenha(e.target.value)}
            />
            {erroLogin && <p className={styles.erro}>{erroLogin}</p>}
            <Button icon="login" fullWidth onClick={entrar} disabled={entrando}>
              {entrando ? "Entrando…" : "Entrar e concluir"}
            </Button>
          </div>
        )}

        {/* PASSO 4 — PRONTO / APP */}
        {passo === "pronto" && (
          <ProntoStep
            nome={nome}
            jaTinhaConta={contaExiste}
            onAbrir={() => router.push(`/aluno${alunoId ? `?aluno=${alunoId}` : ""}`)}
          />
        )}
      </div>
    </div>
  );
}

/** Passo final: sucesso + instalar app (PWA) + abrir a área do aluno. */
function ProntoStep({
  nome,
  jaTinhaConta,
  onAbrir,
}: {
  nome: string;
  jaTinhaConta?: boolean;
  onAbrir: () => void;
}) {
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

  const primeiro = nome.split(" ")[0] || "";

  return (
    <div className={styles.pronto}>
      <span className={styles.prontoIcon}>
        <i className="ti ti-rosette-discount-check" aria-hidden />
      </span>
      <h1 className={styles.prontoTitle}>Tudo certo{primeiro ? `, ${primeiro}` : ""}!</h1>
      <p className={styles.sub}>
        {jaTinhaConta
          ? "Você está logado e sua área já acompanha o novo plano. Instale o app na tela inicial para ver treino, dieta e check-ins."
          : "Sua conta está criada. Instale o app na tela inicial para acessar seu treino, dieta e check-ins."}
      </p>
      {podeInstalar ? (
        <Button icon="download" fullWidth onClick={() => deferred.current?.prompt()}>
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

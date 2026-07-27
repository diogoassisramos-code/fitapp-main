"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Input,
  Textarea,
  ListRow,
  Avatar,
  StatusBadge,
  EmptyState,
  KebabMenu,
} from "@/components/ui";
import { GateConsultoria } from "@/components/GateConsultoria";
import {
  getTestAlunos,
  addTestAluno,
  removeTestAluno,
  vagasRestantes,
  conviteUrl,
  camposPendentes,
  LIMITE_ALUNOS_TESTE,
  type TestAluno,
} from "@/lib/testAlunos";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createAluno } from "@/lib/db";
import { cpfValido, mascararCpf } from "@/lib/cpf";
import styles from "./novo.module.css";

export default function NovoAlunoPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [lista, setLista] = useState<TestAluno[]>([]);
  const [salvando, setSalvando] = useState(false);

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [idade, setIdade] = useState("");
  const [altura, setAltura] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [criado, setCriado] = useState<TestAluno | null>(null);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  // Modo Supabase: link de convite real gerado (o aluno cria a própria conta).
  const [linkReal, setLinkReal] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!supabaseEnabled) setLista(getTestAlunos());
  }, []);

  const noLimite = mounted && lista.length >= LIMITE_ALUNOS_TESTE;

  function limparForm() {
    setNome("");
    setCpf("");
    setIdade("");
    setAltura("");
    setEmail("");
    setTelefone("");
    setObjetivo("");
    setObservacoes("");
  }

  async function handleCadastrar() {
    setErro("");
    setLinkReal(null);
    // Com Supabase: gera um LINK de convite. O aluno abre, paga e cria a própria
    // conta (a linha do aluno nasce no pagamento). Não cadastra direto aqui.
    if (supabaseEnabled) {
      if (!nome.trim()) {
        setErro("Informe o nome do aluno.");
        return;
      }
      setSalvando(true);
      try {
        const res = await fetch("/api/convites", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ alunoNome: nome.trim() }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setErro(
            data.erro === "defina o valor da mensalidade antes de convidar"
              ? "Defina sua mensalidade em Financeiro → Convidar aluno antes de gerar o link."
              : data.erro || "Não foi possível gerar o link."
          );
          return;
        }
        setLinkReal(`${window.location.origin}/onboarding/${data.token}`);
        setCopiado(false);
      } catch {
        setErro("Falha de conexão. Tente novamente.");
      } finally {
        setSalvando(false);
      }
      return;
    }
    const result = addTestAluno({
      nome,
      idade,
      altura,
      email,
      telefone,
      objetivo,
      observacoes,
    });
    if (!result.ok) {
      setErro(result.erro);
      return;
    }
    setCriado(result.aluno);
    setLista(getTestAlunos());
    limparForm();
    setErro("");
    setCopiado(false);
  }

  function handleRemover(id: string) {
    removeTestAluno(id);
    setLista(getTestAlunos());
    if (criado && criado.id === id) setCriado(null);
  }

  async function copiarLink(token: string) {
    try {
      await navigator.clipboard.writeText(conviteUrl(token));
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <GateConsultoria>
    <div className={styles.page}>
      <PageHeader
        title="Novo aluno"
        subtitle="Cadastre as informações básicas e convide o aluno a completar o perfil."
        actions={
          <div className={styles.headerExtras}>
            {mounted && !supabaseEnabled && (
              <StatusBadge
                variant={noLimite ? "pending" : "off"}
                icon="users"
                noDot
              >
                {lista.length}/{LIMITE_ALUNOS_TESTE} alunos de teste
              </StatusBadge>
            )}
            <Button variant="ghost" icon="arrow-left" href="/alunos">
              Voltar
            </Button>
          </div>
        }
      />

      {/* Banner do modelo experimental (só no modo protótipo) */}
      {!supabaseEnabled && (
        <div className={styles.banner}>
          <i className={`ti ti-flask ${styles.bannerIcon}`} aria-hidden />
          <p className={styles.bannerText}>
            <strong>Modelo experimental:</strong> você pode cadastrar até{" "}
            {LIMITE_ALUNOS_TESTE} alunos de teste para experimentar a plataforma.
          </p>
        </div>
      )}

      {/* Link de convite real (modo Supabase) */}
      {linkReal && (
        <div className={styles.sucessoCard}>
          <div className={styles.sucessoHead}>
            <i className={`ti ti-circle-check ${styles.sucessoIcon}`} aria-hidden />
            <h2 className={styles.sucessoTitle}>Link de convite pronto!</h2>
          </div>
          <p className={styles.sucessoText}>
            Envie este link para o aluno. Ele abre, escolhe cartão ou PIX, paga a
            mensalidade e cria a própria conta de acesso.
          </p>
          <div className={styles.linkRow}>
            <div className={styles.linkInput}>
              <Input
                readOnly
                value={linkReal}
                icon="link"
                aria-label="Link de convite"
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
            <Button
              variant="primary"
              icon={copiado ? "check" : "copy"}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(linkReal);
                  setCopiado(true);
                } catch {
                  /* ignore */
                }
              }}
            >
              {copiado ? "Copiado!" : "Copiar"}
            </Button>
          </div>
        </div>
      )}

      {/* Estado de sucesso */}
      {criado && (
        <div className={styles.sucessoCard}>
          <div className={styles.sucessoHead}>
            <i
              className={`ti ti-circle-check ${styles.sucessoIcon}`}
              aria-hidden
            />
            <h2 className={styles.sucessoTitle}>Aluno cadastrado!</h2>
          </div>
          <p className={styles.sucessoText}>
            Envie este link para <strong>{criado.nome}</strong> completar o
            cadastro:
          </p>

          {(() => {
            const pendentes = camposPendentes(criado);
            return (
              <div className={styles.pendencias}>
                {pendentes.length > 0 ? (
                  <>
                    <p className={styles.pendenciasTitle}>
                      O que falta o aluno preencher
                    </p>
                    <p className={styles.pendenciasSub}>
                      O aluno vai completar pelo link:
                    </p>
                    <div className={styles.pendenciasChips}>
                      {pendentes.map((campo) => (
                        <StatusBadge
                          key={campo}
                          variant="pending"
                          icon="dots"
                          noDot
                        >
                          {campo}
                        </StatusBadge>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className={styles.pendenciasChips}>
                    <StatusBadge variant="ok" icon="circle-check" noDot>
                      Cadastro completo
                    </StatusBadge>
                  </div>
                )}
              </div>
            );
          })()}

          <div className={styles.linkRow}>
            <div className={styles.linkInput}>
              <Input
                readOnly
                value={conviteUrl(criado.conviteToken)}
                icon="link"
                aria-label="Link de convite"
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
            <Button
              variant="primary"
              icon={copiado ? "check" : "copy"}
              onClick={() => copiarLink(criado.conviteToken)}
            >
              {copiado ? "Copiado!" : "Copiar link"}
            </Button>
          </div>
          <div className={styles.sucessoActions}>
            <Button variant="outline" icon="share">
              Compartilhar
            </Button>
            <Button variant="ghost" icon="qrcode">
              Gerar QR
            </Button>
          </div>
          <div className={styles.divider} />
          <div className={styles.sucessoActions}>
            {vagasRestantes() > 0 && (
              <Button
                variant="outline"
                icon="user-plus"
                onClick={() => {
                  setCriado(null);
                  setCopiado(false);
                }}
              >
                Cadastrar outro
              </Button>
            )}
            <Button variant="ghost" icon="arrow-left" href="/alunos">
              Voltar para alunos
            </Button>
          </div>
        </div>
      )}

      {/* Limite atingido — sem formulário */}
      {noLimite ? (
        <Card padded>
          <EmptyState
            icon="lock"
            title="Limite do modelo experimental atingido"
            description="Você já cadastrou 3 alunos de teste. Faça upgrade para adicionar mais."
            action={
              <Button variant="primary" icon="arrow-left" href="/alunos">
                Voltar para alunos
              </Button>
            }
          />
        </Card>
      ) : (
        /* Formulário */
        <Card padded>
          <div className={styles.form}>
            <Input
              label="Nome completo"
              icon="user"
              placeholder="Ex.: Marina Costa"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />

            <Input
              label="CPF (opcional)"
              icon="id"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(mascararCpf(e.target.value))}
            />

            <div className={styles.grid}>
              <Input
                label="Idade (opcional)"
                type="number"
                icon="cake"
                placeholder="Ex.: 28"
                value={idade}
                onChange={(e) => setIdade(e.target.value)}
              />
              <Input
                label="Altura (cm) (opcional)"
                type="number"
                icon="ruler-2"
                placeholder="Ex.: 175"
                value={altura}
                onChange={(e) => setAltura(e.target.value)}
              />
            </div>

            <div className={styles.grid}>
              <Input
                label="E-mail (opcional)"
                type="email"
                icon="mail"
                placeholder="aluno@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="Telefone (opcional)"
                icon="phone"
                placeholder="(11) 90000-0000"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </div>

            <Input
              label="Objetivo (opcional)"
              icon="target"
              placeholder="Ex.: Hipertrofia"
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
            />

            <Textarea
              label="Observações sobre o aluno (opcional)"
              placeholder="Histórico, lesões, preferências, contexto inicial…"
              rows={4}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />

            <div className={styles.footer}>
              <p className={styles.note}>
                Apenas o nome é obrigatório. O aluno completa o resto pelo link
                de convite (anamnese, fotos e medidas) no app.
              </p>

              {erro && (
                <p className={styles.erro}>
                  <i className="ti ti-alert-circle" aria-hidden />
                  {erro}
                </p>
              )}

              <div className={styles.ctaRow}>
                <Button
                  variant="primary"
                  icon={supabaseEnabled ? "link" : "user-plus"}
                  disabled={!nome.trim() || salvando}
                  onClick={handleCadastrar}
                >
                  {supabaseEnabled
                    ? salvando
                      ? "Gerando link…"
                      : "Gerar link de convite"
                    : "Cadastrar e convidar aluno"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Lista de alunos de teste (só no modo protótipo) */}
      {!supabaseEnabled && (
      <Card padded={false}>
        <CardHeader
          title="Alunos de teste"
          action={
            mounted ? (
              <StatusBadge variant="off" noDot>
                {lista.length}/{LIMITE_ALUNOS_TESTE}
              </StatusBadge>
            ) : undefined
          }
        />
        {mounted && lista.length === 0 ? (
          <CardBody>
            <EmptyState
              compact
              icon="user-question"
              title="Nenhum aluno de teste ainda"
              description="Cadastre seu primeiro aluno acima para gerar um convite."
            />
          </CardBody>
        ) : (
          <div className={styles.list}>
            {mounted &&
              lista.map((a) => {
                const metaPartes = [
                  a.idade ? `${a.idade} anos` : null,
                  a.objetivo || null,
                ].filter(Boolean);
                const pendentes = camposPendentes(a);
                return (
                  <ListRow
                    key={a.id}
                    leading={<Avatar name={a.nome} />}
                    title={a.nome}
                    action={
                      <div className={styles.rowAction}>
                        <StatusBadge variant="pending" icon="mail" noDot>
                          Convite pendente
                        </StatusBadge>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="copy"
                          aria-label="Copiar link de convite"
                          onClick={() => copiarLink(a.conviteToken)}
                        />
                        <KebabMenu
                          items={[
                            {
                              label: "Copiar link de convite",
                              icon: "copy",
                              onClick: () => copiarLink(a.conviteToken),
                            },
                            {
                              label: "Remover",
                              icon: "trash",
                              danger: true,
                              separatorBefore: true,
                              onClick: () => handleRemover(a.id),
                            },
                          ]}
                        />
                      </div>
                    }
                    meta={
                      <span className={styles.metaText}>
                        {metaPartes.length > 0 && (
                          <span>{metaPartes.join(" · ")}</span>
                        )}
                        {pendentes.length > 0 && (
                          <span className={styles.pendenciaInline}>
                            <i className="ti ti-dots" aria-hidden />
                            {pendentes.length}{" "}
                            {pendentes.length === 1
                              ? "pendência"
                              : "pendências"}
                          </span>
                        )}
                        {metaPartes.length === 0 &&
                          pendentes.length === 0 && <span>Cadastro completo</span>}
                      </span>
                    }
                  />
                );
              })}
          </div>
        )}
      </Card>
      )}
    </div>
    </GateConsultoria>
  );
}

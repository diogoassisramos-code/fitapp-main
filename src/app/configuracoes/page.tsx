"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Textarea,
  Toggle,
  Segmented,
  Tabs,
  SortableList,
  Avatar,
} from "@/components/ui";
import { coach, anamneseTemplate } from "@/lib/data";
import type { PerguntaAnamnese, TipoPergunta } from "@/lib/types";
import styles from "./configuracoes.module.css";

const SECOES = [
  { id: "perfil", label: "Perfil da consultoria", icon: "building-store" },
  { id: "profissional", label: "Dados do profissional", icon: "id-badge-2" },
  { id: "conta", label: "Conta", icon: "user-circle" },
  { id: "recebimento", label: "Recebimento", icon: "cash" },
  { id: "checkout", label: "Checkout", icon: "shopping-cart" },
  { id: "anamnese", label: "Anamnese padrão", icon: "clipboard-list" },
  { id: "notificacoes", label: "Notificações", icon: "bell" },
];

const TIPO_PERGUNTA_OPTS: { label: string; value: TipoPergunta }[] = [
  { label: "Texto", value: "texto" },
  { label: "Número", value: "numero" },
  { label: "Escolha", value: "escolha" },
  { label: "Foto", value: "foto" },
];

const CONSELHO_OPTS = [
  { label: "CREF", value: "CREF" as const },
  { label: "CRN", value: "CRN" as const },
  { label: "CRM", value: "CRM" as const },
];

function SaveBar() {
  return (
    <div className={styles.saveBar}>
      <Button icon="check">Salvar</Button>
    </div>
  );
}

function Nota({ children }: { children: React.ReactNode }) {
  return (
    <p className={styles.nota}>
      <i className="ti ti-info-circle" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function UploadField({
  label,
  hint,
  preview,
  icon = "photo",
}: {
  label: string;
  hint?: string;
  preview?: React.ReactNode;
  icon?: string;
}) {
  return (
    <div className={styles.uploadField}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.uploadRow}>
        <div className={styles.uploadPreview}>
          {preview ?? <i className={`ti ti-${icon}`} aria-hidden />}
        </div>
        <div className={styles.uploadActions}>
          <label className={styles.uploadBtn}>
            <i className="ti ti-upload" aria-hidden />
            Enviar arquivo
            <input type="file" accept="image/*" hidden />
          </label>
          {hint && <span className={styles.fieldHint}>{hint}</span>}
        </div>
      </div>
    </div>
  );
}

export default function ConfiguracoesPage() {
  const [active, setActive] = useState("perfil");

  // perfil
  const [nomeNegocio, setNomeNegocio] = useState(coach.perfil.nomeNegocio);
  const [bio, setBio] = useState(coach.perfil.bio);
  const [especialidade, setEspecialidade] = useState(coach.perfil.especialidade);

  // profissional
  const [nome, setNome] = useState(coach.nome);
  const [conselhoTipo, setConselhoTipo] = useState<"CREF" | "CRN" | "CRM">(
    coach.conselho.tipo
  );
  const [registro, setRegistro] = useState(coach.conselho.numero);

  // conta
  const [email, setEmail] = useState("rafael@coachfit.app");
  const [telefone, setTelefone] = useState("(11) 98888-1234");

  // recebimento
  const [pix, setPix] = useState(coach.contaSaque.pix ?? "");
  const [banco, setBanco] = useState(coach.contaSaque.banco ?? "");
  const [agencia, setAgencia] = useState(coach.contaSaque.agencia ?? "");
  const [conta, setConta] = useState(coach.contaSaque.conta ?? "");
  const [documento, setDocumento] = useState(coach.dadosFiscais.documento);

  // checkout
  const [cor, setCor] = useState(coach.checkoutGlobal.cor);

  // anamnese
  const [perguntas, setPerguntas] = useState<PerguntaAnamnese[]>(
    anamneseTemplate.perguntas
  );

  // notificacoes
  const [notificacoes, setNotificacoes] = useState(coach.notificacoes);

  function updatePergunta(id: string, patch: Partial<PerguntaAnamnese>) {
    setPerguntas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  }

  function removerPergunta(id: string) {
    setPerguntas((prev) => prev.filter((p) => p.id !== id));
  }

  function adicionarPergunta() {
    setPerguntas((prev) => [
      ...prev,
      {
        id: `q-${Date.now()}`,
        ordem: prev.length + 1,
        texto: "",
        tipo: "texto",
        obrigatoria: false,
      },
    ]);
  }

  const notificacaoLinhas: {
    key: keyof typeof notificacoes;
    label: string;
    icon: string;
    desc: string;
  }[] = [
    {
      key: "novoPagamento",
      label: "Novo pagamento",
      icon: "cash",
      desc: "Quando uma cobrança for aprovada.",
    },
    {
      key: "checkinRecebido",
      label: "Check-in recebido",
      icon: "checkup-list",
      desc: "Quando um aluno enviar o check-in semanal.",
    },
    {
      key: "pagamentoAtrasado",
      label: "Pagamento atrasado",
      icon: "alert-triangle",
      desc: "Quando uma assinatura ficar inadimplente.",
    },
    {
      key: "novoAluno",
      label: "Novo aluno",
      icon: "user-plus",
      desc: "Quando alguém comprar um plano.",
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Configurações"
        subtitle="Ajustes da sua consultoria, recebimento e questionários."
      />

      <div className={styles.layout}>
        <aside className={styles.nav}>
          <Tabs
            items={SECOES}
            active={active}
            onChange={setActive}
            orientation="vertical"
          />
        </aside>

        <div className={styles.content}>
          {active === "perfil" && (
            <Card>
              <CardHeader title="Perfil da consultoria" />
              <CardBody className={styles.form}>
                <Input
                  label="Nome do negócio"
                  value={nomeNegocio}
                  onChange={(e) => setNomeNegocio(e.target.value)}
                  icon="building-store"
                />
                <UploadField
                  label="Logo"
                  hint="PNG ou SVG, fundo transparente. Mínimo 240×240px."
                />
                <Textarea
                  label="Bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={250}
                  hint="Aparece na sua vitrine pública."
                />
                <Input
                  label="Especialidade"
                  value={especialidade}
                  onChange={(e) => setEspecialidade(e.target.value)}
                  icon="barbell"
                />
                <SaveBar />
              </CardBody>
            </Card>
          )}

          {active === "profissional" && (
            <Card>
              <CardHeader title="Dados do profissional" />
              <CardBody className={styles.form}>
                <Input
                  label="Nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  icon="user"
                />
                <UploadField
                  label="Foto"
                  hint="Foto de rosto, formato quadrado."
                  preview={<Avatar name={nome || "?"} size={56} />}
                  icon="user-circle"
                />
                <div className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>Conselho</span>
                  <div className={styles.inlineRow}>
                    <Segmented
                      options={CONSELHO_OPTS}
                      value={conselhoTipo}
                      onChange={setConselhoTipo}
                      ariaLabel="Tipo de conselho"
                    />
                    <div className={styles.grow}>
                      <Input
                        value={registro}
                        onChange={(e) => setRegistro(e.target.value)}
                        placeholder="Número de registro"
                        icon="hash"
                      />
                    </div>
                  </div>
                </div>
                <Nota>
                  Define no futuro o que o profissional pode prescrever.
                </Nota>
                <SaveBar />
              </CardBody>
            </Card>
          )}

          {active === "conta" && (
            <Card>
              <CardHeader title="Conta" />
              <CardBody className={styles.form}>
                <Input
                  label="E-mail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon="mail"
                />
                <Input
                  label="Telefone"
                  type="tel"
                  inputMode="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  icon="phone"
                />
                <div>
                  <Button variant="outline" icon="lock">
                    Alterar senha
                  </Button>
                </div>
                <SaveBar />
              </CardBody>
            </Card>
          )}

          {active === "recebimento" && (
            <Card>
              <CardHeader title="Recebimento" />
              <CardBody className={styles.form}>
                <Input
                  label="Chave Pix"
                  value={pix}
                  onChange={(e) => setPix(e.target.value)}
                  icon="key"
                  hint="Usada como destino preferencial dos saques."
                />
                <div className={styles.grid3}>
                  <Input
                    label="Banco"
                    value={banco}
                    onChange={(e) => setBanco(e.target.value)}
                  />
                  <Input
                    label="Agência"
                    value={agencia}
                    onChange={(e) => setAgencia(e.target.value)}
                    inputMode="numeric"
                  />
                  <Input
                    label="Conta"
                    value={conta}
                    onChange={(e) => setConta(e.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <Input
                  label="Dados fiscais (CPF/CNPJ)"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  icon="id"
                />
                <Nota>É daqui que o Sacar do Financeiro puxa a conta.</Nota>
                <SaveBar />
              </CardBody>
            </Card>
          )}

          {active === "checkout" && (
            <Card>
              <CardHeader title="Checkout" />
              <CardBody className={styles.form}>
                <UploadField
                  label="Logo do checkout"
                  hint="Exibida no topo da página de pagamento."
                />
                <div className={styles.checkoutRow}>
                  <div className={styles.colorField}>
                    <span className={styles.fieldLabel}>Cor de destaque</span>
                    <div className={styles.colorPicker}>
                      <input
                        type="color"
                        value={cor}
                        onChange={(e) => setCor(e.target.value)}
                        className={styles.colorInput}
                        aria-label="Cor de destaque do checkout"
                      />
                      <span className={styles.colorValue}>
                        {cor.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className={styles.previewBox}>
                    <span className={styles.previewLabel}>Pré-visualização</span>
                    <button
                      type="button"
                      className={styles.checkoutPreviewBtn}
                      style={{ background: cor }}
                    >
                      <i className="ti ti-lock" aria-hidden />
                      Finalizar pagamento
                    </button>
                  </div>
                </div>
                <Nota>
                  Vale para todos os planos (cada plano pode sobrescrever).
                </Nota>
                <SaveBar />
              </CardBody>
            </Card>
          )}

          {active === "anamnese" && (
            <Card>
              <CardHeader title="Anamnese padrão" />
              <CardBody className={styles.form}>
                <Nota>
                  Dispara com o Solicitar documentos na 1ª compra do plano.
                </Nota>

                {perguntas.length > 0 && (
                  <SortableList
                    items={perguntas}
                    getKey={(p) => p.id}
                    onReorder={setPerguntas}
                    renderItem={(p, i, handle) => (
                      <div className={styles.perguntaCard}>
                        <span className={`${handle} ${styles.handle}`}>
                          <i className="ti ti-grip-vertical" aria-hidden />
                        </span>
                        <div className={styles.perguntaBody}>
                          <div className={styles.perguntaTop}>
                            <span className={styles.perguntaNum}>{i + 1}</span>
                            <div className={styles.grow}>
                              <Input
                                value={p.texto}
                                onChange={(e) =>
                                  updatePergunta(p.id, { texto: e.target.value })
                                }
                                placeholder="Texto da pergunta"
                              />
                            </div>
                            <button
                              type="button"
                              className={styles.removeBtn}
                              onClick={() => removerPergunta(p.id)}
                              aria-label="Remover pergunta"
                            >
                              <i className="ti ti-trash" aria-hidden />
                            </button>
                          </div>
                          <div className={styles.perguntaBottom}>
                            <Segmented
                              options={TIPO_PERGUNTA_OPTS}
                              value={p.tipo}
                              onChange={(tipo) =>
                                updatePergunta(p.id, { tipo })
                              }
                              ariaLabel="Tipo da pergunta"
                            />
                            <label className={styles.obrigatoria}>
                              <Toggle
                                checked={p.obrigatoria}
                                onChange={(obrigatoria) =>
                                  updatePergunta(p.id, { obrigatoria })
                                }
                                aria-label="Pergunta obrigatória"
                              />
                              Obrigatória
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  />
                )}

                <div>
                  <Button
                    variant="outline"
                    icon="plus"
                    onClick={adicionarPergunta}
                  >
                    Adicionar pergunta
                  </Button>
                </div>
                <SaveBar />
              </CardBody>
            </Card>
          )}

          {active === "notificacoes" && (
            <Card>
              <CardHeader title="Notificações" />
              <CardBody className={styles.form}>
                <div className={styles.notifList}>
                  {notificacaoLinhas.map((linha) => (
                    <div key={linha.key} className={styles.notifRow}>
                      <div className={styles.notifIcon}>
                        <i className={`ti ti-${linha.icon}`} aria-hidden />
                      </div>
                      <div className={styles.notifText}>
                        <span className={styles.notifLabel}>{linha.label}</span>
                        <span className={styles.notifDesc}>{linha.desc}</span>
                      </div>
                      <Toggle
                        checked={notificacoes[linha.key]}
                        onChange={(v) =>
                          setNotificacoes((prev) => ({
                            ...prev,
                            [linha.key]: v,
                          }))
                        }
                        aria-label={linha.label}
                      />
                    </div>
                  ))}
                </div>
                <SaveBar />
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

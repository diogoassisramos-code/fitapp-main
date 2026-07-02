"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Toggle,
  Segmented,
  Tabs,
  ListRow,
  StatusBadge,
  Avatar,
} from "@/components/ui";
import type { BadgeVariant } from "@/components/ui";
import styles from "./configuracoes.module.css";

const SECOES = [
  { id: "plataforma", label: "Plataforma", icon: "world" },
  { id: "cobranca", label: "Cobrança", icon: "credit-card" },
  { id: "planos", label: "Planos & limites", icon: "stack-2" },
  { id: "admins", label: "Equipe & admins", icon: "users" },
  { id: "notificacoes", label: "Notificações", icon: "bell" },
];

const MOEDA_OPTS = [
  { label: "BRL", value: "BRL" as const },
  { label: "USD", value: "USD" as const },
];

const CICLO_OPTS = [
  { label: "Mensal", value: "mensal" as const },
  { label: "Anual", value: "anual" as const },
];

type AdminMock = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  variant: BadgeVariant;
};

const ADMINS: AdminMock[] = [
  {
    id: "a1",
    nome: "Diogo Ramos",
    email: "diogo@revo.com",
    papel: "Owner",
    variant: "ok",
  },
  {
    id: "a2",
    nome: "Marina Costa",
    email: "marina@revo.com",
    papel: "Admin",
    variant: "new",
  },
  {
    id: "a3",
    nome: "Lucas Prado",
    email: "lucas@revo.com",
    papel: "Suporte",
    variant: "off",
  },
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

function ToggleRow({
  label,
  desc,
  icon,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  icon: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleIcon}>
        <i className={`ti ti-${icon}`} aria-hidden />
      </div>
      <div className={styles.toggleText}>
        <span className={styles.toggleLabel}>{label}</span>
        <span className={styles.toggleDesc}>{desc}</span>
      </div>
      <Toggle checked={checked} onChange={onChange} aria-label={label} />
    </div>
  );
}

export default function AdminConfiguracoesPage() {
  const [active, setActive] = useState("plataforma");

  // plataforma
  const [nomePlataforma, setNomePlataforma] = useState("Revo");
  const [dominio, setDominio] = useState("app.revo.com");
  const [emailSuporte, setEmailSuporte] = useState("suporte@revo.com");

  // cobranca
  const [gateway, setGateway] = useState("Stripe/Pagar.me");
  const [taxa, setTaxa] = useState("5");
  const [moeda, setMoeda] = useState<"BRL" | "USD">("BRL");
  const [ciclo, setCiclo] = useState<"mensal" | "anual">("mensal");

  // planos & limites
  const [diasTrial, setDiasTrial] = useState("7");
  const [permitirDowngrade, setPermitirDowngrade] = useState(true);
  const [cobrancaAutomatica, setCobrancaAutomatica] = useState(true);

  // notificacoes
  const [notif, setNotif] = useState({
    novaConsultoria: true,
    pagamentoAssinatura: true,
    inadimplencia: true,
    churn: false,
  });

  return (
    <div className={styles.page}>
      <PageHeader title="Configurações da plataforma" />

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
          {active === "plataforma" && (
            <Card>
              <CardHeader title="Plataforma" />
              <CardBody className={styles.form}>
                <Input
                  label="Nome da plataforma"
                  value={nomePlataforma}
                  onChange={(e) => setNomePlataforma(e.target.value)}
                  icon="world"
                />
                <div className={styles.uploadField}>
                  <span className={styles.fieldLabel}>Logo</span>
                  <div className={styles.uploadRow}>
                    <div className={styles.uploadPreview}>
                      <i className="ti ti-photo" aria-hidden />
                    </div>
                    <div className={styles.uploadActions}>
                      <label className={styles.uploadBtn}>
                        <i className="ti ti-upload" aria-hidden />
                        Enviar arquivo
                        <input type="file" accept="image/*" hidden />
                      </label>
                      <span className={styles.fieldHint}>
                        PNG ou SVG, fundo transparente. Mínimo 240×240px.
                      </span>
                    </div>
                  </div>
                </div>
                <Input
                  label="Domínio"
                  value={dominio}
                  onChange={(e) => setDominio(e.target.value)}
                  icon="link"
                />
                <Input
                  label="E-mail de suporte"
                  type="email"
                  value={emailSuporte}
                  onChange={(e) => setEmailSuporte(e.target.value)}
                  icon="mail"
                />
                <SaveBar />
              </CardBody>
            </Card>
          )}

          {active === "cobranca" && (
            <Card>
              <CardHeader title="Cobrança" />
              <CardBody className={styles.form}>
                <Input
                  label="Gateway"
                  value={gateway}
                  onChange={(e) => setGateway(e.target.value)}
                  icon="building-bank"
                />
                <Input
                  label="Taxa da plataforma (%)"
                  prefix="%"
                  value={taxa}
                  onChange={(e) => setTaxa(e.target.value)}
                  inputMode="decimal"
                />
                <div className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>Moeda</span>
                  <Segmented
                    options={MOEDA_OPTS}
                    value={moeda}
                    onChange={setMoeda}
                    ariaLabel="Moeda"
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>Ciclo padrão</span>
                  <Segmented
                    options={CICLO_OPTS}
                    value={ciclo}
                    onChange={setCiclo}
                    ariaLabel="Ciclo padrão"
                  />
                </div>
                <Nota>
                  A taxa da plataforma incide sobre o volume total processado
                  nas cobranças das consultorias.
                </Nota>
                <SaveBar />
              </CardBody>
            </Card>
          )}

          {active === "planos" && (
            <Card>
              <CardHeader title="Planos & limites" />
              <CardBody className={styles.form}>
                <Input
                  label="Dias de trial"
                  value={diasTrial}
                  onChange={(e) => setDiasTrial(e.target.value)}
                  inputMode="numeric"
                  icon="calendar"
                  hint="Período gratuito ao criar uma nova consultoria."
                />
                <div className={styles.toggleList}>
                  <ToggleRow
                    label="Permitir downgrade"
                    desc="Consultorias podem migrar para um plano inferior."
                    icon="arrow-down-circle"
                    checked={permitirDowngrade}
                    onChange={(v) => setPermitirDowngrade(v)}
                  />
                  <ToggleRow
                    label="Cobrança automática no fim do trial"
                    desc="Cobra o cartão assim que o período de teste termina."
                    icon="credit-card-pay"
                    checked={cobrancaAutomatica}
                    onChange={(v) => setCobrancaAutomatica(v)}
                  />
                </div>
                <Nota>
                  Os planos e seus limites de alunos são gerenciados em{" "}
                  <a className={styles.link} href="/admin/planos">
                    Planos da plataforma
                  </a>
                  .
                </Nota>
                <SaveBar />
              </CardBody>
            </Card>
          )}

          {active === "admins" && (
            <Card>
              <CardHeader
                title="Equipe & admins"
                action={
                  <Button variant="outline" icon="user-plus" size="sm">
                    Convidar admin
                  </Button>
                }
              />
              <CardBody className={styles.form}>
                <div className={styles.adminList}>
                  {ADMINS.map((a) => (
                    <ListRow
                      key={a.id}
                      leading={<Avatar name={a.nome} size={40} />}
                      title={a.nome}
                      action={
                        <StatusBadge variant={a.variant} noDot>
                          {a.papel}
                        </StatusBadge>
                      }
                      meta={a.email}
                    />
                  ))}
                </div>
                <Nota>
                  Admins têm acesso total ao painel de controle da plataforma.
                </Nota>
              </CardBody>
            </Card>
          )}

          {active === "notificacoes" && (
            <Card>
              <CardHeader title="Notificações" />
              <CardBody className={styles.form}>
                <div className={styles.toggleList}>
                  <ToggleRow
                    label="Nova consultoria"
                    desc="Quando uma nova consultoria se cadastra na plataforma."
                    icon="building-store"
                    checked={notif.novaConsultoria}
                    onChange={(v) =>
                      setNotif((p) => ({ ...p, novaConsultoria: v }))
                    }
                  />
                  <ToggleRow
                    label="Pagamento de assinatura"
                    desc="Quando uma assinatura de plano é cobrada com sucesso."
                    icon="cash"
                    checked={notif.pagamentoAssinatura}
                    onChange={(v) =>
                      setNotif((p) => ({ ...p, pagamentoAssinatura: v }))
                    }
                  />
                  <ToggleRow
                    label="Inadimplência"
                    desc="Quando uma consultoria fica com a assinatura em atraso."
                    icon="alert-triangle"
                    checked={notif.inadimplencia}
                    onChange={(v) =>
                      setNotif((p) => ({ ...p, inadimplencia: v }))
                    }
                  />
                  <ToggleRow
                    label="Churn / cancelamento"
                    desc="Quando uma consultoria cancela a assinatura."
                    icon="user-x"
                    checked={notif.churn}
                    onChange={(v) => setNotif((p) => ({ ...p, churn: v }))}
                  />
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

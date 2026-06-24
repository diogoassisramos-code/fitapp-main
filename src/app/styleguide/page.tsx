"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  MetricCard,
  StatusBadge,
  Toggle,
  Segmented,
  Chip,
  Input,
  Textarea,
  ListRow,
  SectionBlock,
  Avatar,
} from "@/components/ui";
import { brl } from "@/lib/format";
import styles from "./styleguide.module.css";

const COLORS: { name: string; varName: string }[] = [
  { name: "background-primary", varName: "--color-background-primary" },
  { name: "background-secondary", varName: "--color-background-secondary" },
  { name: "background-tertiary", varName: "--color-background-tertiary" },
  { name: "info", varName: "--color-background-info" },
  { name: "success", varName: "--color-background-success" },
  { name: "warning", varName: "--color-background-warning" },
  { name: "danger", varName: "--color-background-danger" },
  { name: "text-primary", varName: "--color-text-primary" },
  { name: "text-secondary", varName: "--color-text-secondary" },
  { name: "text-tertiary", varName: "--color-text-tertiary" },
];

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>{title}</h2>
      <Card padded className={styles.demo}>
        {children}
      </Card>
    </section>
  );
}

export default function StyleguidePage() {
  const [toggles, setToggles] = useState({ a: true, b: false, c: true });
  const [period, setPeriod] = useState<"semana" | "mes" | "ano">("mes");
  const [filter, setFilter] = useState("todos");
  const [bio, setBio] = useState("Consultoria fitness online com foco em hipertrofia.");

  return (
    <>
      <PageHeader
        eyebrow="Fundação"
        title="Biblioteca de componentes"
        subtitle="Tokens e primitivos do CoachFit. Esta página existe só para validação visual."
      />

      <div className={styles.stack}>
        {/* Cores */}
        <Block title="Paleta">
          <div className={styles.swatches}>
            {COLORS.map((c) => (
              <div key={c.varName} className={styles.swatch}>
                <span
                  className={styles.swatchChip}
                  style={{ background: `var(${c.varName})` }}
                />
                <span className={styles.swatchName}>{c.name}</span>
              </div>
            ))}
          </div>
        </Block>

        {/* Tipografia */}
        <Block title="Tipografia">
          <div className={styles.typeRows}>
            <div>
              <span className="mono-label">eyebrow / mono-label</span>
              <p className={styles.typeBig}>IBM Plex Sans — título 26</p>
            </div>
            <p style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
              Corpo em IBM Plex Sans 14px. Rótulos, eyebrows e URLs em IBM Plex
              Mono (uppercase, letter-spacing leve).
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
              coachfit.app/p/hipertrofia-online · IBM Plex Mono
            </p>
          </div>
        </Block>

        {/* Botões */}
        <Block title="Botões">
          <div className={styles.rowWrap}>
            <Button variant="primary" icon="plus">
              Novo aluno
            </Button>
            <Button variant="outline" icon="edit">
              Editar
            </Button>
            <Button variant="ghost" icon="copy">
              Copiar link
            </Button>
            <Button variant="danger" icon="trash">
              Excluir
            </Button>
            <Button variant="primary" size="sm">
              Pequeno
            </Button>
            <Button variant="outline" disabled>
              Desabilitado
            </Button>
          </div>
        </Block>

        {/* Metric cards */}
        <Block title="Metric cards">
          <div className={styles.metricGrid}>
            <MetricCard
              label="Alunos ativos"
              value="38"
              sub="+3 este mês"
              icon="users"
            />
            <MetricCard
              label="Faturamento 30d"
              value={brl(12480)}
              delta={{ value: "+12%", dir: "up" }}
              icon="trending-up"
            />
            <MetricCard
              label="Saldo disponível"
              value={brl(4820.5)}
              icon="wallet"
              action={
                <Button variant="outline" size="sm" icon="arrow-bar-up">
                  Sacar
                </Button>
              }
            />
            <MetricCard
              label="Inadimplência"
              value={brl(890)}
              delta={{ value: "2 alunos", dir: "down" }}
              icon="alert-triangle"
            />
          </div>
        </Block>

        {/* Badges */}
        <Block title="Status badges">
          <div className={styles.rowWrap}>
            <StatusBadge variant="ok">Em dia</StatusBadge>
            <StatusBadge variant="pending">Pendente</StatusBadge>
            <StatusBadge variant="late">Atrasado</StatusBadge>
            <StatusBadge variant="new">Novo</StatusBadge>
            <StatusBadge variant="off">Pausado</StatusBadge>
            <StatusBadge variant="new" icon="message-circle" noDot>
              Check-in pra responder
            </StatusBadge>
            <StatusBadge variant="pending" icon="clipboard-list" noDot>
              Aguardando protocolo
            </StatusBadge>
          </div>
        </Block>

        {/* Toggle + Segmented + Chips */}
        <Block title="Toggle · Segmented · Chips">
          <div className={styles.controlsGrid}>
            <div className={styles.controlCol}>
              <span className="mono-label">Toggle</span>
              <div className={styles.toggleRow}>
                <Toggle
                  checked={toggles.a}
                  onChange={(v) => setToggles((t) => ({ ...t, a: v }))}
                  aria-label="Treino"
                />
                <span>Treino</span>
              </div>
              <div className={styles.toggleRow}>
                <Toggle
                  checked={toggles.b}
                  onChange={(v) => setToggles((t) => ({ ...t, b: v }))}
                  aria-label="Dieta"
                />
                <span>Dieta</span>
              </div>
              <div className={styles.toggleRow}>
                <Toggle checked={false} onChange={() => {}} disabled aria-label="Desabilitado" />
                <span style={{ color: "var(--color-text-tertiary)" }}>
                  Desabilitado
                </span>
              </div>
            </div>

            <div className={styles.controlCol}>
              <span className="mono-label">Segmented</span>
              <Segmented
                value={period}
                onChange={setPeriod}
                options={[
                  { label: "Semana", value: "semana" },
                  { label: "Mês", value: "mes" },
                  { label: "Ano", value: "ano" },
                ]}
              />
            </div>

            <div className={styles.controlCol}>
              <span className="mono-label">Chips de filtro</span>
              <div className={styles.rowWrap}>
                {[
                  { id: "todos", label: "Todos", n: 38 },
                  { id: "atrasados", label: "Atrasados", n: 2 },
                  { id: "checkin", label: "Check-in pendente", n: 5 },
                  { id: "novos", label: "Novos", n: 3 },
                ].map((f) => (
                  <Chip
                    key={f.id}
                    selected={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    count={f.n}
                  >
                    {f.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </Block>

        {/* Inputs */}
        <Block title="Campos de formulário">
          <div className={styles.formGrid}>
            <Input label="Nome do plano" placeholder="Ex.: Consultoria Online" />
            <Input label="Preço" prefix="R$" placeholder="0,00" inputMode="decimal" />
            <Input label="Buscar" icon="search" placeholder="Buscar exercício…" />
            <div className={styles.full}>
              <Textarea
                label="Descrição"
                maxLength={250}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                hint="Aparece no checkout do aluno."
              />
            </div>
          </div>
        </Block>

        {/* List rows */}
        <Block title="List rows — padrão de 2 linhas">
          <Card padded={false}>
            <ListRow
              href="/styleguide"
              leading={<Avatar name="Ana Paula" />}
              title="Ana Paula Souza"
              action={<StatusBadge variant="ok">Em dia</StatusBadge>}
              meta="Online · Hipertrofia · vence 28/06"
            />
            <ListRow
              href="/styleguide"
              leading={<Avatar name="Bruno Lima" />}
              title="Bruno Lima"
              action={<StatusBadge variant="pending">Pendente</StatusBadge>}
              meta="Personal · Emagrecimento · vence 22/06"
              tags={
                <StatusBadge variant="new" icon="message-circle" noDot>
                  Check-in pra responder
                </StatusBadge>
              }
            />
            <ListRow
              href="/styleguide"
              leading={<Avatar name="Carla Reis" />}
              title="Carla Reis"
              action={<StatusBadge variant="late">Atrasado</StatusBadge>}
              meta={
                <span style={{ color: "var(--color-text-danger)" }}>
                  Consulta · Avaliação · venceu 14/06
                </span>
              }
              tags={
                <StatusBadge variant="pending" icon="clipboard-list" noDot>
                  Aguardando protocolo
                </StatusBadge>
              }
            />
          </Card>
        </Block>

        {/* Section block + Card header */}
        <Block title="Section block · Card com header">
          <div className={styles.formGrid}>
            <div className={styles.full}>
              <SectionBlock
                number={5}
                title="Preço e pagamento"
                description="Define quanto e como o aluno paga. Vira a origem do link de checkout."
              >
                <div className={styles.rowWrap}>
                  <Input prefix="R$" placeholder="199,00" />
                  <Segmented
                    value={period}
                    onChange={setPeriod}
                    options={[
                      { label: "Semanal", value: "semana" },
                      { label: "Mensal", value: "mes" },
                      { label: "Anual", value: "ano" },
                    ]}
                  />
                </div>
              </SectionBlock>
            </div>

            <div className={styles.full}>
              <Card padded={false}>
                <CardHeader
                  title="Protocolo atual"
                  action={
                    <Button variant="ghost" size="sm" icon="external-link">
                      Abrir
                    </Button>
                  }
                />
                <CardBody>
                  <p style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
                    Corpo do card. Treino A/B/C · Dieta 2.200 kcal · 2 protocolos
                    extras.
                  </p>
                </CardBody>
              </Card>
            </div>
          </div>
        </Block>
      </div>
    </>
  );
}

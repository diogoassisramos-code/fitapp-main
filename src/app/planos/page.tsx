"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  MetricCard,
  StatusBadge,
  ListRow,
  KebabMenu,
  Modal,
  Input,
  Segmented,
  Toggle,
  EmptyState,
} from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { listPlanos, financeiro } from "@/lib/data";
import {
  brl,
  RECORRENCIA_LABEL,
  TIPO_COBRANCA_LABEL,
  inclusoResumo,
} from "@/lib/format";
import type { Plano, PeriodoRecorrencia, StatusPlano } from "@/lib/types";
import styles from "./planos.module.css";

const RECORRENCIA_OPTIONS: { label: string; value: PeriodoRecorrencia }[] = [
  { label: "Semanal", value: "semanal" },
  { label: "Mensal", value: "mensal" },
  { label: "Trimestral", value: "trimestral" },
  { label: "Anual", value: "anual" },
];

type QuickEdit = {
  id: string;
  nome: string;
  preco: string;
  recorrencia: PeriodoRecorrencia;
  status: StatusPlano;
};

function precoLinha(p: Plano): string {
  const sufixo =
    p.tipoCobranca === "recorrente"
      ? p.periodoRecorrencia
        ? RECORRENCIA_LABEL[p.periodoRecorrencia]
        : ""
      : p.tipoCobranca === "pacote"
        ? " único"
        : "";
  return `${brl(p.preco)}${sufixo}`;
}

export default function PlanosPage() {
  const router = useRouter();
  const planos = listPlanos();

  const [editing, setEditing] = useState<QuickEdit | null>(null);

  const mrr = financeiro.mrr;
  const assinantesAtivos = planos.reduce((acc, p) => acc + p.assinantesAtivos, 0);
  const planosAtivos = planos.filter((p) => p.status === "ativo").length;

  function abrirEdicaoRapida(p: Plano) {
    setEditing({
      id: p.id,
      nome: p.nome,
      preco: String(p.preco),
      recorrencia: p.periodoRecorrencia ?? "mensal",
      status: p.status,
    });
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Planos & pagamentos"
        subtitle="Gerencie seus planos, preços e links de pagamento."
        actions={
          <Button icon="plus" href="/planos/novo">
            Criar plano
          </Button>
        }
      />

      <div className={styles.metrics}>
        <MetricCard label="MRR" value={brl(mrr)} sub="Receita recorrente mensal" icon="repeat" />
        <MetricCard
          label="Assinantes ativos"
          value={assinantesAtivos}
          sub="Em todos os planos"
          icon="users"
        />
        <MetricCard
          label="Planos ativos"
          value={planosAtivos}
          sub={`${planos.length} no total`}
          icon="credit-card"
        />
      </div>

      <Card padded={false}>
        {planos.length === 0 ? (
          <div className={styles.emptyWrap}>
            <EmptyState
              icon="credit-card"
              title="Nenhum plano criado"
              description="Crie seu primeiro plano para começar a receber assinantes."
              action={
                <Button icon="plus" href="/planos/novo">
                  Criar plano
                </Button>
              }
            />
          </div>
        ) : (
          <ul className={styles.list}>
            {planos.map((p) => {
              const editar = `/planos/${p.id}/editar`;
              return (
                <li key={p.id}>
                  <ListRow
                    title={
                      <Link href={editar} className={styles.nomeLink}>
                        {p.nome}
                      </Link>
                    }
                    action={
                      <div className={styles.rowActions}>
                        <StatusBadge
                          variant={p.status === "ativo" ? "ok" : "off"}
                        >
                          {p.status === "ativo" ? "Ativo" : "Pausado"}
                        </StatusBadge>
                        <span className={styles.preco}>{precoLinha(p)}</span>
                        <Button variant="ghost" size="sm" icon="link">
                          Copiar link
                        </Button>
                        <KebabMenu
                          items={[
                            {
                              label: "Editar",
                              icon: "edit",
                              onClick: () => router.push(editar),
                            },
                            {
                              label: "Edição rápida",
                              icon: "adjustments",
                              onClick: () => abrirEdicaoRapida(p),
                            },
                            {
                              label: p.status === "ativo" ? "Pausar" : "Reativar",
                              icon:
                                p.status === "ativo"
                                  ? "player-pause"
                                  : "player-play",
                            },
                            { label: "Duplicar", icon: "copy" },
                            { label: "Copiar link", icon: "link" },
                            {
                              label: "Excluir",
                              icon: "trash",
                              danger: true,
                              separatorBefore: true,
                            },
                          ]}
                        />
                      </div>
                    }
                    meta={`${TIPO_COBRANCA_LABEL[p.tipoCobranca]} · ${inclusoResumo(p.incluso)} · ${p.assinantesAtivos} assinantes`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edição rápida"
        size="sm"
        footer={
          editing && (
            <div className={styles.modalFooter}>
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={() => setEditing(null)}>
                Salvar
              </Button>
            </div>
          )
        }
      >
        {editing && (
          <div className={styles.form}>
            <Input
              label="Nome do plano"
              value={editing.nome}
              onChange={(e) =>
                setEditing({ ...editing, nome: e.target.value })
              }
            />
            <Input
              label="Preço"
              prefix="R$"
              inputMode="decimal"
              value={editing.preco}
              onChange={(e) =>
                setEditing({ ...editing, preco: e.target.value })
              }
            />

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Recorrência</span>
              <Segmented
                ariaLabel="Recorrência"
                options={RECORRENCIA_OPTIONS}
                value={editing.recorrencia}
                onChange={(v) => setEditing({ ...editing, recorrencia: v })}
              />
            </div>

            <div className={styles.toggleRow}>
              <div className={styles.toggleText}>
                <span className={styles.fieldLabel}>
                  {editing.status === "ativo" ? "Ativo" : "Pausado"}
                </span>
                <span className={styles.toggleHint}>
                  {editing.status === "ativo"
                    ? "Disponível para venda e renovação."
                    : "Oculto da venda — assinantes mantidos."}
                </span>
              </div>
              <Toggle
                checked={editing.status === "ativo"}
                aria-label="Plano ativo"
                onChange={(b) =>
                  setEditing({ ...editing, status: b ? "ativo" : "pausado" })
                }
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

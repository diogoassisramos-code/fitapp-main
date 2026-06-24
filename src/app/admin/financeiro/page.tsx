"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  Button,
  Card,
  MetricCard,
  ListRow,
  StatusBadge,
  Segmented,
  PointsChart,
} from "@/components/ui";
import type { BadgeVariant } from "@/components/ui";
import { adminFinanceiro, listTransacoesPlataforma } from "@/lib/admin";
import type { TransacaoPlataforma } from "@/lib/admin";
import { brl, dataCurta } from "@/lib/format";
import styles from "./financeiro.module.css";

type Filtro = "tudo" | "assinatura" | "saida";

const FILTROS: { label: string; value: Filtro }[] = [
  { label: "Tudo", value: "tudo" },
  { label: "Assinaturas", value: "assinatura" },
  { label: "Saídas", value: "saida" },
];

const STATUS_TX: Record<
  TransacaoPlataforma["status"],
  { label: string; variant: BadgeVariant }
> = {
  aprovado: { label: "Aprovado", variant: "ok" },
  processando: { label: "Processando", variant: "pending" },
  falhou: { label: "Falhou", variant: "late" },
};

export default function AdminFinanceiroPage() {
  const [filtro, setFiltro] = useState<Filtro>("tudo");
  const { inadimplencia } = adminFinanceiro;

  const transacoes = listTransacoesPlataforma().filter((t) => {
    if (filtro === "tudo") return true;
    if (filtro === "assinatura") return t.tipo === "assinatura";
    return t.tipo === "saida" || t.tipo === "taxa";
  });

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Plataforma"
        title="Financeiro da plataforma"
        subtitle="Receita de assinaturas, volume processado e extrato de movimentações."
      />

      {/* KPIs */}
      <section className={styles.metrics}>
        <MetricCard
          label="MRR"
          value={brl(adminFinanceiro.mrrPlataforma)}
          sub="receita recorrente mensal"
          icon="repeat"
        />
        <MetricCard
          label="Receita no mês"
          value={brl(adminFinanceiro.faturamentoMes)}
          icon="trending-up"
        />
        <MetricCard
          label="Volume processado (GMV)"
          value={brl(adminFinanceiro.volumeProcessadoMes)}
          sub="transacionado pelas consultorias"
          icon="chart-bar"
        />
        <MetricCard
          label="Receita acumulada"
          value={brl(adminFinanceiro.receitaAcumulada)}
          icon="wallet"
        />
      </section>

      {/* Inadimplência */}
      <div className={styles.inadimplencia}>
        <div className={styles.inadimplenciaText}>
          <span className={styles.inadimplenciaIcon}>
            <i className="ti ti-alert-triangle" aria-hidden />
          </span>
          <span>
            <span className={styles.inadimplenciaValor}>
              {brl(inadimplencia.valor)} em atraso
            </span>
            <span className={styles.inadimplenciaSub}>
              {inadimplencia.consultorias}{" "}
              {inadimplencia.consultorias === 1
                ? "consultoria com pagamento pendente"
                : "consultorias com pagamento pendente"}
            </span>
          </span>
        </div>
        <Button variant="outline" size="sm" href="/admin/consultores">
          Ver inadimplentes
        </Button>
      </div>

      {/* Gráficos */}
      <section className={styles.charts}>
        <PointsChart
          title="Receita da plataforma (6 meses)"
          data={adminFinanceiro.faturamento6m.map((d, i, a) => ({
            date: d.mes,
            total: d.valor,
            change: i === 0 ? 0 : d.valor - a[i - 1].valor,
          }))}
          formatValue={(v) => "R$ " + Math.round(v).toLocaleString("pt-BR")}
          levels={[{ value: 700, color: "var(--color-text-success)" }]}
        />
        <PointsChart
          title="Volume processado (6 meses)"
          data={adminFinanceiro.volume6m.map((d, i, a) => ({
            date: d.mes,
            total: d.valor,
            change: i === 0 ? 0 : d.valor - a[i - 1].valor,
          }))}
          formatValue={(v) => "R$ " + Math.round(v / 1000) + "k"}
          levels={[{ value: 110000, color: "var(--color-text-success)" }]}
        />
      </section>

      {/* Extrato */}
      <Card padded={false}>
        <div className={styles.extratoFiltro}>
          <Segmented
            options={FILTROS}
            value={filtro}
            onChange={setFiltro}
            ariaLabel="Filtrar extrato"
          />
        </div>

        {transacoes.length === 0 ? (
          <p className={styles.empty}>Nenhuma movimentação neste filtro.</p>
        ) : (
          <div className={styles.list}>
            {transacoes.map((t) => {
              const entrada = t.valor >= 0;
              const st = STATUS_TX[t.status];
              return (
                <ListRow
                  key={t.id}
                  title={<span className={styles.descricao}>{t.descricao}</span>}
                  action={
                    <span
                      className={
                        entrada ? styles.valorEntrada : styles.valorSaida
                      }
                    >
                      {entrada
                        ? brl(t.valor)
                        : `- ${brl(Math.abs(t.valor))}`}
                    </span>
                  }
                  meta={
                    <span className={styles.metaRow}>
                      <span className={styles.meta}>
                        {(t.consultoria ? `${t.consultoria} · ` : "") +
                          dataCurta(t.data)}
                      </span>
                      <StatusBadge variant={st.variant}>{st.label}</StatusBadge>
                    </span>
                  }
                />
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

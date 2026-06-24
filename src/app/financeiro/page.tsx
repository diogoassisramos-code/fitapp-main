"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  Button,
  Card,
  CardHeader,
  MetricCard,
  ListRow,
  StatusBadge,
  Segmented,
  Modal,
  Input,
  EmptyState,
  PointsChart,
} from "@/components/ui";
import {
  coach,
  financeiro,
  proximosRecebimentos,
  listTransacoes,
} from "@/lib/data";
import { brl, dataCurta } from "@/lib/format";
import type { Transacao } from "@/lib/types";
import type { BadgeVariant } from "@/components/ui/StatusBadge";
import styles from "./financeiro.module.css";

type FiltroExtrato = "todos" | "entrada" | "saida";

const STATUS_TX: Record<
  Transacao["status"],
  { label: string; variant: BadgeVariant }
> = {
  aprovado: { label: "Aprovado", variant: "ok" },
  processando: { label: "Processando", variant: "pending" },
  falhou: { label: "Falhou", variant: "late" },
};

export default function FinanceiroPage() {
  const [sacarAberto, setSacarAberto] = useState(false);
  const [valorSaque, setValorSaque] = useState(
    financeiro.saldoDisponivel.toFixed(2).replace(".", ","),
  );
  const [periodo, setPeriodo] = useState<"6m" | "12m">("6m");
  const [filtroExtrato, setFiltroExtrato] = useState<FiltroExtrato>("todos");

  const transacoes = listTransacoes();

  const extratoFiltrado = useMemo(() => {
    if (filtroExtrato === "todos") return transacoes;
    return transacoes.filter((t) => t.tipo === filtroExtrato);
  }, [transacoes, filtroExtrato]);

  const abrirSacar = () => {
    setValorSaque(financeiro.saldoDisponivel.toFixed(2).replace(".", ","));
    setSacarAberto(true);
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Financeiro"
        subtitle="Saldo, recebimentos e extrato"
      />

      {/* Métricas */}
      <div className={styles.metrics}>
        <MetricCard
          label="Saldo disponível"
          value={brl(financeiro.saldoDisponivel)}
          icon="wallet"
          action={
            <Button
              variant="outline"
              size="sm"
              icon="arrow-bar-up"
              onClick={abrirSacar}
            >
              Sacar
            </Button>
          }
        />
        <MetricCard
          label="A liberar"
          value={brl(financeiro.aLiberar)}
          sub="em processamento"
          icon="clock"
        />
        <MetricCard
          label="Recebido no mês"
          value={brl(financeiro.recebidoMes)}
          icon="trending-up"
        />
        <MetricCard label="MRR" value={brl(financeiro.mrr)} icon="repeat" />
      </div>

      {/* Inadimplência */}
      <div className={styles.inadimplencia}>
        <div className={styles.inadimplenciaText}>
          <span className={styles.inadimplenciaIcon}>
            <i className="ti ti-alert-triangle" aria-hidden />
          </span>
          <div>
            <strong className={styles.inadimplenciaValor}>
              {brl(financeiro.inadimplencia.valor)} em atraso
            </strong>
            <span className={styles.inadimplenciaSub}>
              {financeiro.inadimplencia.alunos} alunos com pagamento pendente
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" href="/alunos">
          Ver atrasados
        </Button>
      </div>

      {/* Faturamento */}
      <PointsChart
        title="Faturamento"
        headerRight={
          <Segmented
            options={[
              { label: "6 meses", value: "6m" },
              { label: "12 meses", value: "12m" },
            ]}
            value={periodo}
            onChange={setPeriodo}
            ariaLabel="Período do faturamento"
          />
        }
        data={financeiro.faturamento6m.map((f, i, a) => ({
          date: f.mes,
          total: f.valor,
          change: i === 0 ? 0 : f.valor - a[i - 1].valor,
        }))}
        format="currency"
      />

      <div className={styles.split}>
        {/* Próximos recebimentos */}
        <Card padded={false}>
          <CardHeader title="Próximos recebimentos" />
          {proximosRecebimentos.length === 0 ? (
            <EmptyState
              icon="calendar-dollar"
              title="Nenhum recebimento previsto"
              description="As próximas cobranças aparecerão aqui assim que forem agendadas."
              compact
            />
          ) : (
            <div className={styles.list}>
              {proximosRecebimentos.map((r) => (
                <ListRow
                  key={r.id}
                  title={<span className={styles.nome}>{r.alunoNome}</span>}
                  action={
                    <span className={styles.valorEntrada}>{brl(r.valor)}</span>
                  }
                  meta={
                    <span className={styles.meta}>
                      {r.planoNome} · {dataCurta(r.data)} · {r.metodo}
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </Card>

        {/* Extrato */}
        <Card padded={false}>
          <CardHeader
            title="Extrato"
            action={
              <Segmented
                options={[
                  { label: "Tudo", value: "todos" },
                  { label: "Entradas", value: "entrada" },
                  { label: "Saídas", value: "saida" },
                ]}
                value={filtroExtrato}
                onChange={(v) => setFiltroExtrato(v as FiltroExtrato)}
                ariaLabel="Filtrar extrato"
              />
            }
          />
          {extratoFiltrado.length === 0 ? (
            <EmptyState
              icon="receipt"
              title="Nenhuma movimentação"
              description="Não há transações para o filtro selecionado."
              compact
            />
          ) : (
            <div className={styles.list}>
              {extratoFiltrado.map((t) => {
                const st = STATUS_TX[t.status];
                const entrada = t.tipo === "entrada";
                return (
                  <ListRow
                    key={t.id}
                    title={<span className={styles.nome}>{t.descricao}</span>}
                    action={
                      <span
                        className={
                          entrada ? styles.valorEntrada : styles.valorSaida
                        }
                      >
                        {entrada
                          ? brl(t.valor)
                          : "- " + brl(Math.abs(t.valor))}
                      </span>
                    }
                    meta={
                      <span className={styles.metaRow}>
                        <span className={styles.meta}>
                          {t.metodo} · {dataCurta(t.data)}
                        </span>
                        <StatusBadge variant={st.variant}>
                          {st.label}
                        </StatusBadge>
                      </span>
                    }
                  />
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Modal Sacar */}
      <Modal
        open={sacarAberto}
        onClose={() => setSacarAberto(false)}
        title="Sacar saldo"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSacarAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setSacarAberto(false)}>
              Confirmar saque
            </Button>
          </>
        }
      >
        <div className={styles.modalBody}>
          <Input
            label="Valor do saque"
            prefix="R$"
            inputMode="decimal"
            value={valorSaque}
            onChange={(e) => setValorSaque(e.target.value)}
            hint={`Disponível: ${brl(financeiro.saldoDisponivel)}`}
          />

          <div className={styles.contaSaque}>
            <span className="mono-label">Conta de saque</span>
            <div className={styles.contaLinha}>
              <span className={styles.contaIcon}>
                <i className="ti ti-brand-cashapp" aria-hidden />
              </span>
              <span className={styles.contaTexto}>
                Pix: {coach.contaSaque.pix ?? "—"}
              </span>
            </div>
            <span className={styles.contaNota}>
              Conta cadastrada em Configurações.
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
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
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { fetchFinanceiro, type FinanceiroReal } from "@/lib/db";
import { AtivarRecebimento } from "./AtivarRecebimento";
import styles from "./financeiro.module.css";

/** Badge para o status real de um pagamento do Asaas. */
function statusExtrato(status: string): { label: string; variant: BadgeVariant } {
  const s = status.toUpperCase();
  if (s.includes("RECEIV") || s.includes("CONFIRM")) return { label: "Recebido", variant: "ok" };
  if (s.includes("OVERDUE") || s.includes("ATRAS")) return { label: "Atrasado", variant: "late" };
  if (s.includes("PENDING") || s.includes("PENDENTE")) return { label: "Pendente", variant: "pending" };
  return { label: status || "—", variant: "off" };
}

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
  const emReal = supabaseEnabled;
  const [real, setReal] = useState<FinanceiroReal | null>(null);
  const [sacarAberto, setSacarAberto] = useState(false);
  const [valorSaque, setValorSaque] = useState("0,00");
  const [periodo, setPeriodo] = useState<"6m" | "12m">("6m");
  const [filtroExtrato, setFiltroExtrato] = useState<FiltroExtrato>("todos");

  useEffect(() => {
    if (!emReal) return;
    let active = true;
    fetchFinanceiro()
      .then((d) => active && setReal(d))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [emReal]);

  // Valores efetivos: banco (real) ou mock.
  const saldoDisponivel = emReal ? real?.saldo ?? 0 : financeiro.saldoDisponivel;
  const aLiberar = emReal ? real?.aLiberar ?? 0 : financeiro.aLiberar;
  const recebidoMes = emReal ? real?.recebidoMes ?? 0 : financeiro.recebidoMes;
  const mrr = emReal ? real?.mrr ?? 0 : financeiro.mrr;
  const inadValor = emReal ? real?.inadimplenciaValor ?? 0 : financeiro.inadimplencia.valor;
  const inadAlunos = emReal ? real?.inadimplenciaAlunos ?? 0 : financeiro.inadimplencia.alunos;
  const faturamentoPontos = emReal
    ? real?.faturamento ?? []
    : financeiro.faturamento6m;
  const proximos = emReal ? [] : proximosRecebimentos;
  const extratoReal = emReal ? real?.extrato ?? [] : null;

  const transacoes = emReal ? [] : listTransacoes();
  const extratoFiltrado = useMemo(() => {
    if (filtroExtrato === "todos") return transacoes;
    return transacoes.filter((t) => t.tipo === filtroExtrato);
  }, [transacoes, filtroExtrato]);

  const abrirSacar = () => {
    setValorSaque(saldoDisponivel.toFixed(2).replace(".", ","));
    setSacarAberto(true);
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Financeiro"
        subtitle="Saldo, recebimentos e extrato"
      />

      {/* Fluxo 2 — ativar recebimento (subconta Asaas) */}
      <AtivarRecebimento />

      {/* Métricas */}
      <div className={styles.metrics}>
        <MetricCard
          label="Saldo disponível"
          value={brl(saldoDisponivel)}
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
          value={brl(aLiberar)}
          sub="em processamento"
          icon="clock"
        />
        <MetricCard
          label="Recebido no mês"
          value={brl(recebidoMes)}
          icon="trending-up"
        />
        <MetricCard label="MRR" value={brl(mrr)} icon="repeat" />
      </div>

      {/* Inadimplência (só quando há) */}
      {inadAlunos > 0 && (
        <div className={styles.inadimplencia}>
          <div className={styles.inadimplenciaText}>
            <span className={styles.inadimplenciaIcon}>
              <i className="ti ti-alert-triangle" aria-hidden />
            </span>
            <div>
              <strong className={styles.inadimplenciaValor}>
                {brl(inadValor)} em atraso
              </strong>
              <span className={styles.inadimplenciaSub}>
                {inadAlunos} aluno{inadAlunos > 1 ? "s" : ""} com pagamento pendente
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" href="/alunos">
            Ver atrasados
          </Button>
        </div>
      )}

      {/* Faturamento */}
      {faturamentoPontos.length >= 2 ? (
        <PointsChart
          title="Faturamento"
          headerRight={
            !emReal ? (
              <Segmented
                options={[
                  { label: "6 meses", value: "6m" },
                  { label: "12 meses", value: "12m" },
                ]}
                value={periodo}
                onChange={setPeriodo}
                ariaLabel="Período do faturamento"
              />
            ) : undefined
          }
          data={faturamentoPontos.map((f, i, a) => ({
            date: f.mes,
            total: f.valor,
            change: i === 0 ? 0 : f.valor - a[i - 1].valor,
          }))}
          format="currency"
        />
      ) : (
        <Card padded>
          <EmptyState
            icon="chart-line"
            title="Sem faturamento ainda"
            description="Seu faturamento aparece aqui conforme os alunos pagam."
            compact
          />
        </Card>
      )}

      <div className={styles.split}>
        {/* Próximos recebimentos */}
        <Card padded={false}>
          <CardHeader title="Próximos recebimentos" />
          {proximos.length === 0 ? (
            <EmptyState
              icon="calendar-dollar"
              title="Nenhum recebimento previsto"
              description="As próximas cobranças aparecerão aqui assim que forem agendadas."
              compact
            />
          ) : (
            <div className={styles.list}>
              {proximos.map((r) => (
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
          {emReal ? (
            (extratoReal ?? []).length === 0 ? (
              <EmptyState
                icon="receipt"
                title="Nenhuma movimentação"
                description="As entradas aparecem aqui conforme os alunos pagam."
                compact
              />
            ) : (
              <div className={styles.list}>
                {(extratoReal ?? []).map((t) => {
                  const st = statusExtrato(t.status);
                  return (
                    <ListRow
                      key={t.id}
                      title={<span className={styles.nome}>{t.alunoNome} · Mensalidade</span>}
                      action={<span className={styles.valorEntrada}>{brl(t.valor)}</span>}
                      meta={
                        <span className={styles.metaRow}>
                          <span className={styles.meta}>
                            {t.metodo}
                            {t.data ? ` · ${dataCurta(t.data)}` : ""}
                          </span>
                          <StatusBadge variant={st.variant}>{st.label}</StatusBadge>
                        </span>
                      }
                    />
                  );
                })}
              </div>
            )
          ) : extratoFiltrado.length === 0 ? (
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
                      <span className={entrada ? styles.valorEntrada : styles.valorSaida}>
                        {entrada ? brl(t.valor) : "- " + brl(Math.abs(t.valor))}
                      </span>
                    }
                    meta={
                      <span className={styles.metaRow}>
                        <span className={styles.meta}>
                          {t.metodo} · {dataCurta(t.data)}
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
            hint={`Disponível: ${brl(saldoDisponivel)}`}
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

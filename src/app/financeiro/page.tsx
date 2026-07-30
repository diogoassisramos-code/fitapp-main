"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  KebabMenu,
} from "@/components/ui";
import {
  coach,
  financeiro,
  proximosRecebimentos,
  listTransacoes,
} from "@/lib/data";
import { brl, dataCurta } from "@/lib/format";
import { baixarCsv, csvNum } from "@/lib/csv";
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
  const [sacando, setSacando] = useState(false);
  const [saqueMsg, setSaqueMsg] = useState("");
  const [periodo, setPeriodo] = useState<"6m" | "12m">("6m");
  const [filtroExtrato, setFiltroExtrato] = useState<FiltroExtrato>("todos");

  const [saldoAsaas, setSaldoAsaas] = useState<number | null>(null);
  const [aLiberarAsaas, setALiberarAsaas] = useState<number | null>(null);
  const [proximaLiberacao, setProximaLiberacao] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  // Recebimento aprovado → os dados gerais (KPIs) sobem pra cima e o bloco de
  // "Recebimentos"/"Convidar" desce. Antes de aprovar, a ativação vem primeiro.
  const [recebAtivo, setRecebAtivo] = useState(false);
  const handleStatusReceb = useCallback(
    (s: string) => setRecebAtivo(s === "aprovado"),
    []
  );

  const carregar = useCallback(() => {
    if (!emReal) return;
    fetchFinanceiro()
      .then(setReal)
      .catch(() => {});
    // Saldo REAL da subconta no Asaas (o split cai direto na wallet do coach) +
    // "a liberar" e a data estimada da próxima liberação (cartão libera depois).
    fetch("/api/asaas/saldo")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.ok) return;
        setSaldoAsaas(Number(d.saldo));
        if (d.aLiberar != null) setALiberarAsaas(Number(d.aLiberar));
        setProximaLiberacao(d.proximaLiberacao ?? null);
      })
      .catch(() => {});
  }, [emReal]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Estorna uma cobrança de aluno (Asaas reverte o split). Feedback reusa syncMsg.
  async function estornar(asaasPaymentId: string, alunoNome: string) {
    if (
      !confirm(
        `Estornar a cobrança de ${alunoNome}? O valor volta para o aluno e o split é revertido. Esta ação não pode ser desfeita.`
      )
    )
      return;
    setSyncMsg("");
    try {
      const res = await fetch("/api/asaas/pagamento/estornar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ asaasPaymentId }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setSyncMsg("Cobrança estornada.");
        carregar();
      } else {
        setSyncMsg(d.erro || "Falha ao estornar.");
      }
    } catch {
      setSyncMsg("Falha de conexão.");
    }
  }

  // Reconciliação PULL: puxa as cobranças do Asaas (fallback quando o webhook não
  // chegou) e recarrega os KPIs/extrato.
  async function sincronizar() {
    setSincronizando(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/asaas/sincronizar", { method: "POST" });
      const d = await res.json();
      if (res.ok && d.ok) {
        setSyncMsg(
          d.pagamentos > 0
            ? `${d.pagamentos} cobrança(s) sincronizada(s).`
            : "Nada novo pra sincronizar."
        );
        carregar();
      } else {
        setSyncMsg(d.erro || "Falha ao sincronizar.");
      }
    } catch {
      setSyncMsg("Falha de conexão.");
    } finally {
      setSincronizando(false);
    }
  }

  // Valores efetivos: banco (real) ou mock. Saldo prioriza o valor ao vivo do Asaas.
  const saldoDisponivel = emReal
    ? saldoAsaas ?? real?.saldo ?? 0
    : financeiro.saldoDisponivel;
  const aLiberar = emReal ? aLiberarAsaas ?? real?.aLiberar ?? 0 : financeiro.aLiberar;
  // Prazo de liberação real (Asaas): cartão libera depois (~D+30); PIX cai na hora.
  const diasParaLiberar = proximaLiberacao
    ? Math.max(
        0,
        Math.ceil((new Date(proximaLiberacao).getTime() - Date.now()) / 86400000)
      )
    : null;
  const liberarSub = !emReal
    ? "em processamento"
    : proximaLiberacao
      ? `libera ${dataCurta(proximaLiberacao)}${diasParaLiberar != null ? ` · ~${diasParaLiberar}d` : ""}`
      : aLiberar > 0
        ? "cartão em até ~30 dias"
        : "em processamento";
  const recebidoMes = emReal ? real?.recebidoMes ?? 0 : financeiro.recebidoMes;
  const recebidoMesBruto = emReal ? real?.recebidoMesBruto ?? 0 : financeiro.recebidoMes;
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

  // Saque real: transfere o saldo da subconta do coach via PIX (rota /sacar).
  async function sacar() {
    setSaqueMsg("");
    const valor = Number(valorSaque.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      setSaqueMsg("Informe um valor válido.");
      return;
    }
    if (!emReal) {
      setSacarAberto(false);
      return;
    }
    setSacando(true);
    try {
      const res = await fetch("/api/asaas/sacar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ valor, confirmar: true }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setSacarAberto(false);
        setSyncMsg("Saque solicitado.");
        carregar();
      } else {
        setSaqueMsg(d.erro || "Falha ao solicitar o saque.");
      }
    } catch {
      setSaqueMsg("Falha de conexão.");
    } finally {
      setSacando(false);
    }
  }

  const abrirSacar = () => {
    setValorSaque(saldoDisponivel.toFixed(2).replace(".", ","));
    setSaqueMsg("");
    setSacarAberto(true);
  };

  // Export contábil do extrato (CSV) — abre no Excel/Sheets.
  function exportarExtrato() {
    const linhas = (extratoReal ?? []).map((t) => [
      t.data ?? "",
      t.alunoNome,
      t.metodo,
      statusExtrato(t.status).label,
      csvNum(t.valorBruto),
      csvNum(t.taxaGateway),
      csvNum(t.taxaPlataforma),
      csvNum(t.valor),
    ]);
    baixarCsv(
      `extrato-revo-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Data", "Aluno", "Método", "Status", "Bruto (R$)", "Taxa gateway (R$)", "Taxa plataforma (R$)", "Líquido (R$)"],
      linhas
    );
  }

  // Fechamento mensal (CSV): totais por mês do extrato carregado.
  function exportarFechamento() {
    const porMes = new Map<
      string,
      { bruto: number; gateway: number; plataforma: number; liquido: number; n: number }
    >();
    for (const t of extratoReal ?? []) {
      const mes = (t.data ?? "").slice(0, 7);
      if (!mes) continue;
      const a = porMes.get(mes) ?? { bruto: 0, gateway: 0, plataforma: 0, liquido: 0, n: 0 };
      a.bruto += t.valorBruto;
      a.gateway += t.taxaGateway;
      a.plataforma += t.taxaPlataforma;
      a.liquido += t.valor;
      a.n += 1;
      porMes.set(mes, a);
    }
    const linhas = [...porMes.entries()]
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([mes, a]) => [
        mes,
        a.n,
        csvNum(a.bruto),
        csvNum(a.gateway),
        csvNum(a.plataforma),
        csvNum(a.liquido),
      ]);
    baixarCsv(
      "fechamento-mensal-revo.csv",
      ["Mês", "Cobranças", "Bruto (R$)", "Taxa gateway (R$)", "Taxa plataforma (R$)", "Líquido (R$)"],
      linhas
    );
  }

  // Fluxo 2 — ativar recebimento (subconta Asaas). Keyed p/ reordenar sem remount.
  const ativarEl = <AtivarRecebimento key="ativar" onStatus={handleStatusReceb} />;

  // Dados gerais do financeiro (KPIs).
  const metricsEl = (
    <div key="metrics" className={styles.metrics}>
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
        sub={liberarSub}
        icon="clock"
      />
      <MetricCard
        label="Recebido no mês"
        value={brl(recebidoMes)}
        sub={
          emReal && recebidoMesBruto > recebidoMes
            ? `líquido · bruto ${brl(recebidoMesBruto)}`
            : emReal
              ? "líquido"
              : undefined
        }
        icon="trending-up"
      />
      <MetricCard label="MRR" value={brl(mrr)} icon="repeat" />
    </div>
  );

  return (
    <div className={styles.page}>
      <PageHeader
        title="Financeiro"
        subtitle="Saldo, recebimentos e extrato"
        actions={
          emReal ? (
            <div className={styles.syncBar}>
              {syncMsg && <span className={styles.syncMsg}>{syncMsg}</span>}
              <Button
                variant="outline"
                size="sm"
                icon="download"
                onClick={exportarExtrato}
                disabled={(extratoReal ?? []).length === 0}
              >
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon="file-spreadsheet"
                onClick={exportarFechamento}
                disabled={(extratoReal ?? []).length === 0}
              >
                Fechamento
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon="refresh"
                onClick={sincronizar}
                disabled={sincronizando}
              >
                {sincronizando ? "Sincronizando…" : "Sincronizar"}
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Recebimento aprovado → KPIs primeiro; senão, ativação primeiro. */}
      {recebAtivo ? [metricsEl, ativarEl] : [ativarEl, metricsEl]}

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
                  const temTaxas = t.taxaGateway > 0 || t.taxaPlataforma > 0;
                  const podeEstornar =
                    !!t.asaasPaymentId &&
                    /RECEIV|CONFIRM/.test((t.status || "").toUpperCase());
                  return (
                    <ListRow
                      key={t.id}
                      title={<span className={styles.nome}>{t.alunoNome} · Mensalidade</span>}
                      action={
                        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                          <span className={styles.valorEntrada}>{brl(t.valor)}</span>
                          {podeEstornar && (
                            <KebabMenu
                              items={[
                                {
                                  label: "Estornar cobrança",
                                  icon: "arrow-back-up",
                                  danger: true,
                                  onClick: () => estornar(t.asaasPaymentId as string, t.alunoNome),
                                },
                              ]}
                            />
                          )}
                        </span>
                      }
                      meta={
                        <>
                          <span className={styles.metaRow}>
                            <span className={styles.meta}>
                              {t.metodo}
                              {t.data ? ` · ${dataCurta(t.data)}` : ""}
                            </span>
                            <StatusBadge variant={st.variant}>{st.label}</StatusBadge>
                          </span>
                          {temTaxas && (
                            <span className={styles.breakdown}>
                              bruto {brl(t.valorBruto)}
                              {t.taxaGateway > 0 && (
                                <> · gateway <span className={styles.taxa}>−{brl(t.taxaGateway)}</span></>
                              )}
                              {t.taxaPlataforma > 0 && (
                                <> · plataforma <span className={styles.taxa}>−{brl(t.taxaPlataforma)}</span></>
                              )}
                            </span>
                          )}
                        </>
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
            <Button variant="ghost" onClick={() => setSacarAberto(false)} disabled={sacando}>
              Cancelar
            </Button>
            <Button icon="cash" onClick={sacar} disabled={sacando}>
              {sacando ? "Solicitando…" : "Confirmar saque"}
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
                {emReal ? "Chave PIX cadastrada em Configurações" : `Pix: ${coach.contaSaque.pix ?? "—"}`}
              </span>
            </div>
            <span className={styles.contaNota}>
              {emReal
                ? "O valor vai para a chave PIX do seu Recebimento. Operação irreversível."
                : "Conta cadastrada em Configurações."}
            </span>
          </div>

          {saqueMsg && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-danger)" }}>{saqueMsg}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}

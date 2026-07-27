"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  Button,
  Card,
  MetricCard,
  ListRow,
  StatusBadge,
  Segmented,
  PointsChart,
  EmptyState,
  Modal,
  Input,
  KebabMenu,
} from "@/components/ui";
import type { BadgeVariant } from "@/components/ui";
import { adminFinanceiro, listTransacoesPlataforma } from "@/lib/admin";
import type { TransacaoPlataforma } from "@/lib/admin";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { fetchAdminFinanceiro, type AdminFinanceiroReal } from "@/lib/db";
import {
  fetchSaldoMaster,
  fetchSaques,
  fetchExtratoMaster,
  sincronizarPlataforma,
  solicitarSaque,
  estornarPagamento,
  AdminAsaasError,
  type SaqueMaster,
  type LancamentoExtrato,
} from "@/lib/adminAsaas";
import { brl, dataCurta } from "@/lib/format";
import { baixarCsv, csvNum } from "@/lib/csv";
import { WebhookAsaas } from "./WebhookAsaas";
import styles from "./financeiro.module.css";

type Filtro = "tudo" | "assinatura" | "saida";

const STATUS_TX: Record<
  TransacaoPlataforma["status"],
  { label: string; variant: BadgeVariant }
> = {
  aprovado: { label: "Aprovado", variant: "ok" },
  processando: { label: "Processando", variant: "pending" },
  falhou: { label: "Falhou", variant: "late" },
};

/** Badge para o status real de um pagamento do Asaas. */
function statusExtrato(status: string): { label: string; variant: BadgeVariant } {
  const s = status.toUpperCase();
  if (s.includes("RECEIV") || s.includes("CONFIRM")) return { label: "Recebido", variant: "ok" };
  if (s.includes("OVERDUE") || s.includes("ATRAS")) return { label: "Atrasado", variant: "late" };
  if (s.includes("PENDING") || s.includes("PENDENTE")) return { label: "Pendente", variant: "pending" };
  return { label: status || "—", variant: "off" };
}

/** Badge para o status de um saque/transferência do Asaas. */
function statusSaque(status: string): { label: string; variant: BadgeVariant } {
  const s = status.toUpperCase();
  if (s === "DONE") return { label: "Concluído", variant: "ok" };
  if (s === "FAILED" || s === "CANCELLED") return { label: "Falhou", variant: "late" };
  return { label: "Processando", variant: "pending" };
}

const TIPO_PIX = [
  { label: "CPF", value: "CPF" as const },
  { label: "CNPJ", value: "CNPJ" as const },
  { label: "E-mail", value: "EMAIL" as const },
  { label: "Telefone", value: "PHONE" as const },
  { label: "Aleatória", value: "EVP" as const },
];

export default function AdminFinanceiroPage() {
  const emReal = supabaseEnabled;
  const [filtro, setFiltro] = useState<Filtro>("tudo");
  const [real, setReal] = useState<AdminFinanceiroReal | null>(null);

  // Conta master (Asaas): saldo real, saques e estado das ações.
  const [saldo, setSaldo] = useState<number | null>(null);
  const [masterOff, setMasterOff] = useState(false); // Asaas não configurado / sem permissão
  const [saques, setSaques] = useState<SaqueMaster[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  // Extrato real da conta master (carregado sob demanda).
  const [extratoMaster, setExtratoMaster] = useState<LancamentoExtrato[] | null>(null);
  const [carregandoExtrato, setCarregandoExtrato] = useState(false);

  // Modal de saque.
  const [saqueOpen, setSaqueOpen] = useState(false);
  const [saqueValor, setSaqueValor] = useState("");
  const [saqueChave, setSaqueChave] = useState("");
  const [saqueTipo, setSaqueTipo] = useState<(typeof TIPO_PIX)[number]["value"]>("CPF");
  const [sacando, setSacando] = useState(false);
  const [saqueErro, setSaqueErro] = useState<string | null>(null);

  const carregarReal = useCallback(() => {
    if (!emReal) return Promise.resolve();
    return fetchAdminFinanceiro()
      .then((d) => setReal(d))
      .catch(() => {});
  }, [emReal]);

  const carregarMaster = useCallback(() => {
    if (!emReal) return Promise.resolve();
    // Saldo e saques são independentes; um 503/403 marca a conta master como
    // indisponível (esconde o painel), sem quebrar o resto da tela.
    const s = fetchSaldoMaster()
      .then((r) => {
        setSaldo(r.saldo);
        setMasterOff(false);
      })
      .catch((e) => {
        if (e instanceof AdminAsaasError && (e.status === 503 || e.status === 403)) {
          setMasterOff(true);
        }
      });
    const q = fetchSaques()
      .then((r) => setSaques(r.saques))
      .catch(() => {});
    return Promise.all([s, q]);
  }, [emReal]);

  useEffect(() => {
    if (!emReal) return;
    let active = true;
    void carregarReal();
    void (async () => {
      await carregarMaster();
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, [emReal, carregarReal, carregarMaster]);

  async function handleSincronizar() {
    setSincronizando(true);
    setMsg(null);
    try {
      const r = await sincronizarPlataforma();
      await Promise.all([carregarReal(), carregarMaster()]);
      setMsg({
        tipo: "ok",
        texto: `Sincronizado: ${r.pagamentos} pagamento(s), ${r.consultoriasAtualizadas} consultoria(s) e ${r.alunosAtualizados} aluno(s) atualizados.`,
      });
    } catch (e) {
      const texto =
        e instanceof AdminAsaasError && e.status === 503
          ? "Asaas não configurado neste ambiente."
          : e instanceof Error
            ? e.message
            : "Falha ao sincronizar.";
      setMsg({ tipo: "erro", texto });
    } finally {
      setSincronizando(false);
    }
  }

  async function estornarAdmin(asaasPaymentId: string, descricao: string) {
    if (
      !confirm(
        `Estornar "${descricao}"? O valor volta para o pagador e o split é revertido. Esta ação não pode ser desfeita.`
      )
    )
      return;
    setMsg(null);
    try {
      await estornarPagamento(asaasPaymentId);
      setMsg({ tipo: "ok", texto: "Cobrança estornada." });
      await carregarReal();
    } catch (e) {
      setMsg({
        tipo: "erro",
        texto: e instanceof Error ? e.message : "Falha ao estornar.",
      });
    }
  }

  // Export contábil do extrato da plataforma (CSV).
  function exportarExtratoAdmin() {
    const linhas = extratoReal.map((t) => [
      t.data ?? "",
      t.descricao,
      t.tipo,
      t.metodo,
      statusExtrato(t.status).label,
      csvNum(t.valor),
    ]);
    baixarCsv(
      `extrato-plataforma-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Data", "Descrição", "Tipo", "Método", "Status", "Receita (R$)"],
      linhas
    );
  }

  async function carregarExtratoMaster() {
    setCarregandoExtrato(true);
    try {
      const r = await fetchExtratoMaster(50);
      setExtratoMaster(r.lancamentos);
    } catch {
      setExtratoMaster([]);
    } finally {
      setCarregandoExtrato(false);
    }
  }

  async function handleSacar() {
    setSaqueErro(null);
    const valor = Number(saqueValor.replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      setSaqueErro("Informe um valor válido.");
      return;
    }
    if (!saqueChave.trim()) {
      setSaqueErro("Informe a chave PIX de destino.");
      return;
    }
    if (saldo != null && valor > saldo) {
      setSaqueErro(`Saldo insuficiente (disponível ${brl(saldo)}).`);
      return;
    }
    setSacando(true);
    try {
      const r = await solicitarSaque({
        valor,
        chavePix: saqueChave.trim(),
        tipoChave: saqueTipo,
      });
      setSaqueOpen(false);
      setSaqueValor("");
      setSaqueChave("");
      setMsg({
        tipo: "ok",
        texto: `Saque de ${brl(r.saque.valor)} solicitado (${statusSaque(r.saque.status).label}).`,
      });
      await carregarMaster();
    } catch (e) {
      setSaqueErro(e instanceof Error ? e.message : "Falha ao solicitar saque.");
    } finally {
      setSacando(false);
    }
  }

  // Valores efetivos: banco (real) ou mock.
  const mrr = emReal ? real?.mrrPlataforma ?? 0 : adminFinanceiro.mrrPlataforma;
  const faturamentoMes = emReal ? real?.faturamentoMes ?? 0 : adminFinanceiro.faturamentoMes;
  const volumeMes = emReal ? real?.volumeProcessadoMes ?? 0 : adminFinanceiro.volumeProcessadoMes;
  const receitaAcumulada = emReal ? real?.receitaAcumulada ?? 0 : adminFinanceiro.receitaAcumulada;
  const inadValor = emReal ? real?.inadimplencia.valor ?? 0 : adminFinanceiro.inadimplencia.valor;
  const inadCons = emReal ? real?.inadimplencia.consultorias ?? 0 : adminFinanceiro.inadimplencia.consultorias;
  const faturamento6m = emReal ? real?.faturamento6m ?? [] : adminFinanceiro.faturamento6m;
  const volume6m = emReal ? real?.volume6m ?? [] : adminFinanceiro.volume6m;

  // Terceiro filtro: no mock são "Saídas"; no real são "Taxas" (fatia do split).
  const filtros: { label: string; value: Filtro }[] = [
    { label: "Tudo", value: "tudo" },
    { label: "Assinaturas", value: "assinatura" },
    { label: emReal ? "Taxas" : "Saídas", value: "saida" },
  ];

  const transacoesMock = useMemo(
    () =>
      listTransacoesPlataforma().filter((t) => {
        if (filtro === "tudo") return true;
        if (filtro === "assinatura") return t.tipo === "assinatura";
        return t.tipo === "saida" || t.tipo === "taxa";
      }),
    [filtro]
  );

  const extratoReal = useMemo(() => {
    const lista = real?.extrato ?? [];
    return lista.filter((t) => {
      if (filtro === "tudo") return true;
      if (filtro === "assinatura") return t.tipo === "assinatura";
      return t.tipo === "taxa";
    });
  }, [real, filtro]);

  const mostrarMaster = emReal && !masterOff;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Plataforma"
        title="Financeiro da plataforma"
        subtitle="Receita de assinaturas, volume processado e extrato de movimentações."
      />

      {/* Conta master (Asaas) — saldo real + ações + saques */}
      {mostrarMaster && (
        <Card padded={false}>
          <div className={styles.master}>
            <div className={styles.masterTop}>
              <div className={styles.masterSaldoBloco}>
                <span className={styles.masterEyebrow}>
                  <i className="ti ti-building-bank" aria-hidden />
                  Saldo em conta · Asaas (master)
                </span>
                <span className={styles.masterSaldo}>
                  {saldo == null ? "—" : brl(saldo)}
                </span>
                <span className={styles.masterSaldoSub}>
                  Caixa real da plataforma (assinaturas + fatia do split). Atualizado do Asaas.
                </span>
              </div>
              <div className={styles.masterAcoes}>
                <Button
                  variant="outline"
                  size="sm"
                  icon="refresh"
                  onClick={handleSincronizar}
                  disabled={sincronizando}
                >
                  {sincronizando ? "Sincronizando…" : "Sincronizar"}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon="cash"
                  onClick={() => {
                    setSaqueErro(null);
                    setSaqueOpen(true);
                  }}
                  disabled={saldo == null || saldo <= 0}
                >
                  Sacar
                </Button>
              </div>
            </div>

            {msg && (
              <div
                className={[
                  styles.masterMsg,
                  msg.tipo === "ok" ? styles.masterMsgOk : styles.masterMsgErro,
                ].join(" ")}
              >
                {msg.texto}
              </div>
            )}

            {saques.length > 0 && (
              <div className={styles.masterSaques}>
                <span className={styles.masterSaquesTitulo}>Saques recentes</span>
                <div className={styles.list}>
                  {saques.slice(0, 5).map((s) => {
                    const st = statusSaque(s.status);
                    return (
                      <ListRow
                        key={s.id}
                        title={
                          <span className={styles.descricao}>
                            Saque {s.tipo ? `· ${s.tipo}` : ""}
                          </span>
                        }
                        action={<span className={styles.valorSaida}>- {brl(s.valor)}</span>}
                        meta={
                          <span className={styles.metaRow}>
                            <span className={styles.meta}>
                              {s.criadoEm ? dataCurta(s.criadoEm.slice(0, 10)) : ""}
                              {s.taxa ? ` · taxa ${brl(s.taxa)}` : ""}
                            </span>
                            <StatusBadge variant={st.variant}>{st.label}</StatusBadge>
                          </span>
                        }
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Webhook do Asaas (registro/status) */}
      <WebhookAsaas />

      {/* KPIs */}
      <section className={styles.metrics}>
        <MetricCard
          label="MRR"
          value={brl(mrr)}
          sub="receita recorrente mensal"
          icon="repeat"
        />
        <MetricCard
          label="Receita no mês"
          value={brl(faturamentoMes)}
          sub={emReal ? "taxa do split + assinaturas" : undefined}
          icon="trending-up"
        />
        <MetricCard
          label="Volume processado (GMV)"
          value={brl(volumeMes)}
          sub="transacionado pelas consultorias"
          icon="chart-bar"
        />
        <MetricCard
          label="Receita acumulada"
          value={brl(receitaAcumulada)}
          icon="wallet"
        />
      </section>

      {/* Inadimplência (só quando há) */}
      {inadCons > 0 && (
        <div className={styles.inadimplencia}>
          <div className={styles.inadimplenciaText}>
            <span className={styles.inadimplenciaIcon}>
              <i className="ti ti-alert-triangle" aria-hidden />
            </span>
            <span>
              {inadValor > 0 && (
                <span className={styles.inadimplenciaValor}>
                  {brl(inadValor)} em atraso
                </span>
              )}
              <span className={styles.inadimplenciaSub}>
                {inadCons}{" "}
                {inadCons === 1
                  ? "consultoria com pagamento pendente"
                  : "consultorias com pagamento pendente"}
              </span>
            </span>
          </div>
          <Button variant="outline" size="sm" href="/admin/consultores">
            Ver inadimplentes
          </Button>
        </div>
      )}

      {/* Gráficos */}
      <section className={styles.charts}>
        {faturamento6m.length >= 2 ? (
          <PointsChart
            title="Receita da plataforma (6 meses)"
            data={faturamento6m.map((d, i, a) => ({
              date: d.mes,
              total: d.valor,
              change: i === 0 ? 0 : d.valor - a[i - 1].valor,
            }))}
            formatValue={(v) => "R$ " + Math.round(v).toLocaleString("pt-BR")}
            levels={emReal ? undefined : [{ value: 700, color: "var(--color-text-success)" }]}
          />
        ) : (
          <Card padded>
            <EmptyState
              icon="chart-line"
              title="Sem receita ainda"
              description="A receita da plataforma aparece aqui conforme as consultorias transacionam."
              compact
            />
          </Card>
        )}
        {volume6m.length >= 2 ? (
          <PointsChart
            title="Volume processado (6 meses)"
            data={volume6m.map((d, i, a) => ({
              date: d.mes,
              total: d.valor,
              change: i === 0 ? 0 : d.valor - a[i - 1].valor,
            }))}
            formatValue={(v) => "R$ " + Math.round(v / 1000) + "k"}
            levels={emReal ? undefined : [{ value: 110000, color: "var(--color-text-success)" }]}
          />
        ) : (
          <Card padded>
            <EmptyState
              icon="chart-bar"
              title="Sem volume ainda"
              description="O volume processado (GMV) aparece aqui conforme os alunos pagam."
              compact
            />
          </Card>
        )}
      </section>

      {/* Extrato */}
      <Card padded={false}>
        <div className={styles.extratoFiltro}>
          <Segmented
            options={filtros}
            value={filtro}
            onChange={setFiltro}
            ariaLabel="Filtrar extrato"
          />
          {emReal && (
            <Button
              variant="outline"
              size="sm"
              icon="download"
              onClick={exportarExtratoAdmin}
              disabled={extratoReal.length === 0}
            >
              Exportar CSV
            </Button>
          )}
        </div>

        {emReal ? (
          extratoReal.length === 0 ? (
            <p className={styles.empty}>Nenhuma movimentação neste filtro.</p>
          ) : (
            <div className={styles.list}>
              {extratoReal.map((t) => {
                const st = statusExtrato(t.status);
                const podeEstornar =
                  !!t.asaasPaymentId &&
                  /RECEIV|CONFIRM/.test((t.status || "").toUpperCase());
                return (
                  <ListRow
                    key={t.id}
                    title={<span className={styles.descricao}>{t.descricao}</span>}
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
                                onClick: () => estornarAdmin(t.asaasPaymentId as string, t.descricao),
                              },
                            ]}
                          />
                        )}
                      </span>
                    }
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
        ) : transacoesMock.length === 0 ? (
          <p className={styles.empty}>Nenhuma movimentação neste filtro.</p>
        ) : (
          <div className={styles.list}>
            {transacoesMock.map((t) => {
              const entrada = t.valor >= 0;
              const st = STATUS_TX[t.status];
              return (
                <ListRow
                  key={t.id}
                  title={<span className={styles.descricao}>{t.descricao}</span>}
                  action={
                    <span className={entrada ? styles.valorEntrada : styles.valorSaida}>
                      {entrada ? brl(t.valor) : `- ${brl(Math.abs(t.valor))}`}
                    </span>
                  }
                  meta={
                    <span className={styles.metaRow}>
                      <span className={styles.meta}>
                        {(t.consultoria ? `${t.consultoria} · ` : "") + dataCurta(t.data)}
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

      {/* Extrato REAL da conta master (Asaas) — sob demanda */}
      {mostrarMaster && (
        <Card padded={false}>
          <div className={styles.extratoFiltro}>
            <span className={styles.masterEyebrow}>
              <i className="ti ti-receipt" aria-hidden /> Extrato da conta master (Asaas)
            </span>
          </div>
          {extratoMaster == null ? (
            <div style={{ padding: "var(--space-5)", textAlign: "center" }}>
              <Button
                variant="outline"
                size="sm"
                icon="download"
                onClick={carregarExtratoMaster}
                disabled={carregandoExtrato}
              >
                {carregandoExtrato ? "Carregando…" : "Carregar extrato do Asaas"}
              </Button>
            </div>
          ) : extratoMaster.length === 0 ? (
            <p className={styles.empty}>Sem lançamentos na conta master.</p>
          ) : (
            <div className={styles.list}>
              {extratoMaster.map((l) => {
                const entrada = l.valor >= 0;
                return (
                  <ListRow
                    key={l.id}
                    title={
                      <span className={styles.descricao}>{l.descricao || l.tipo}</span>
                    }
                    action={
                      <span className={entrada ? styles.valorEntrada : styles.valorSaida}>
                        {entrada ? brl(l.valor) : `- ${brl(Math.abs(l.valor))}`}
                      </span>
                    }
                    meta={
                      <span className={styles.metaRow}>
                        <span className={styles.meta}>
                          {l.data ? dataCurta(l.data.slice(0, 10)) : ""}
                          {l.saldo != null ? ` · saldo ${brl(l.saldo)}` : ""}
                        </span>
                      </span>
                    }
                  />
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Modal de saque (movimenta dinheiro real — dupla confirmação) */}
      <Modal
        open={saqueOpen}
        onClose={() => !sacando && setSaqueOpen(false)}
        title="Sacar da conta master"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaqueOpen(false)} disabled={sacando}>
              Cancelar
            </Button>
            <Button variant="primary" icon="cash" onClick={handleSacar} disabled={sacando}>
              {sacando ? "Solicitando…" : "Confirmar saque"}
            </Button>
          </>
        }
      >
        <div className={styles.saqueForm}>
          <div className={styles.saqueAviso}>
            <i className="ti ti-alert-triangle" aria-hidden />
            <span>
              O dinheiro sai da conta da plataforma para a chave PIX informada. A
              operação é <strong>irreversível</strong>. Saldo disponível:{" "}
              <strong>{saldo == null ? "—" : brl(saldo)}</strong>.
            </span>
          </div>
          <Input
            label="Valor (R$)"
            prefix="R$"
            inputMode="decimal"
            placeholder="0,00"
            value={saqueValor}
            onChange={(e) => setSaqueValor(e.target.value)}
          />
          <div>
            <span className={styles.masterSaquesTitulo} style={{ paddingTop: 0 }}>
              Tipo da chave
            </span>
            <Segmented
              options={TIPO_PIX}
              value={saqueTipo}
              onChange={(v) => setSaqueTipo(v as (typeof TIPO_PIX)[number]["value"])}
              ariaLabel="Tipo da chave PIX"
            />
          </div>
          <Input
            label="Chave PIX de destino"
            placeholder="CPF, e-mail, telefone ou chave aleatória"
            value={saqueChave}
            onChange={(e) => setSaqueChave(e.target.value)}
          />
          {saqueErro && <span className={styles.saqueErro}>{saqueErro}</span>}
        </div>
      </Modal>
    </div>
  );
}

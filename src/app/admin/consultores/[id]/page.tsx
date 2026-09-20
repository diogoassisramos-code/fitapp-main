"use client";

import { use, useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Input,
  KebabMenu,
  ListRow,
  MetricCard,
  Modal,
  StatusBadge,
} from "@/components/ui";
import { STATUS_CONSULTORIA } from "@/lib/admin";
import {
  adminFetchConsultoria,
  adminFetchAlunos,
  adminFetchProdutos,
  adminSetConsultoriaStatus,
  adminUpdateProduto,
  adminSetProdutoStatus,
  adminDeleteProduto,
  type AdminConsultoria,
  type AdminAluno,
  type AdminProduto,
} from "@/lib/adminDb";
import { brl, dataLonga } from "@/lib/format";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import type { RecebimentosConsultoria } from "@/app/api/admin/consultorias/[id]/recebimentos/route";
import { AlunosList } from "./AlunosList";
import styles from "./detalhe.module.css";

export default function ConsultoriaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [c, setC] = useState<AdminConsultoria | null | undefined>(undefined);
  const [alunos, setAlunos] = useState<AdminAluno[]>([]);
  const [produtos, setProdutos] = useState<AdminProduto[]>([]);
  // Lado financeiro real (subconta no gateway, taxa retida, atrasos, assinatura SaaS).
  const [rec, setRec] = useState<RecebimentosConsultoria | null | undefined>(undefined);

  // Modal de edição de produto (nome + preço).
  const [editProduto, setEditProduto] = useState<AdminProduto | null>(null);
  const [pNome, setPNome] = useState("");
  const [pPreco, setPPreco] = useState("");
  const [salvandoProduto, setSalvandoProduto] = useState(false);

  const carregar = useCallback(() => {
    adminFetchConsultoria(id).then((x) => setC(x)).catch(() => setC(null));
    adminFetchAlunos(id).then(setAlunos).catch(() => {});
    adminFetchProdutos(id).then(setProdutos).catch(() => {});
    if (supabaseEnabled) {
      fetch(`/api/admin/consultorias/${id}/recebimentos`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setRec(d?.ok ? (d as RecebimentosConsultoria) : null))
        .catch(() => setRec(null));
    } else {
      setRec(null);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function alternarSuspensao() {
    if (!c) return;
    const novo = c.status === "suspenso" ? "ativo" : "suspenso";
    try {
      await adminSetConsultoriaStatus(c.id, novo);
      carregar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao mudar status.");
    }
  }

  function abrirEditProduto(p: AdminProduto) {
    setEditProduto(p);
    setPNome(p.nome);
    setPPreco(String(p.preco));
  }

  async function salvarProduto() {
    if (!editProduto) return;
    setSalvandoProduto(true);
    try {
      await adminUpdateProduto(editProduto.id, {
        nome: pNome.trim() || editProduto.nome,
        preco: Number(pPreco.replace(",", ".")) || 0,
      });
      setEditProduto(null);
      carregar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao salvar produto.");
    } finally {
      setSalvandoProduto(false);
    }
  }

  async function pausarProduto(p: AdminProduto) {
    try {
      await adminSetProdutoStatus(p.id, p.status === "pausado" ? "ativo" : "pausado");
      carregar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao mudar status do produto.");
    }
  }

  async function excluirProduto(p: AdminProduto) {
    if (!confirm(`Excluir o produto "${p.nome}"? Ação irreversível.`)) return;
    try {
      await adminDeleteProduto(p.id);
      carregar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao excluir produto.");
    }
  }

  if (c === undefined) {
    return <PageHeader eyebrow="Consultorias" title="Carregando…" subtitle=" " />;
  }

  if (c === null) {
    return (
      <>
        <PageHeader eyebrow="Consultorias" title="Consultoria não encontrada" subtitle="O registro solicitado não existe ou foi removido." />
        <Card padded>
          <div className={styles.notFound}>
            <span className={styles.notFoundIcon}>
              <i className="ti ti-building-store" aria-hidden />
            </span>
            <p>Não encontramos nenhuma consultoria com este identificador.</p>
            <Button variant="outline" icon="arrow-left" href="/admin/consultores">
              Voltar para consultorias
            </Button>
          </div>
        </Card>
      </>
    );
  }

  const status = STATUS_CONSULTORIA[c.status];
  const novosAlunos = alunos.filter((a) => a.status === "ativo").length;

  return (
    <>
      <Button variant="ghost" icon="arrow-left" href="/admin/consultores">
        Consultorias
      </Button>

      <PageHeader
        title={
          <div className={styles.headTitle}>
            <Avatar name={c.consultor} size={64} />
            <div className={styles.headText}>
              <div className={styles.headName}>
                {c.nomeNegocio}
                <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
              </div>
              <span className={styles.headSub}>{c.consultor}</span>
            </div>
          </div>
        }
        actions={
          <>
            <Button variant="outline" icon="pencil" href={`/admin/consultores/${id}/editar`}>
              Editar
            </Button>
            <Button variant="danger" icon={c.status === "suspenso" ? "player-play" : "ban"} onClick={alternarSuspensao}>
              {c.status === "suspenso" ? "Reativar" : "Suspender"}
            </Button>
          </>
        }
      />

      <div className={styles.metrics}>
        <MetricCard label="Alunos ativos" value={c.alunosAtivos} icon="users" />
        <MetricCard label="MRR" value={brl(c.mrr)} icon="repeat" />
        <MetricCard label="Faturamento mensal" value={brl(c.faturamentoMensal)} sub="GMV gerado" icon="chart-bar" />
        <MetricCard label="Plano" value={c.planoSlug} icon="stack-2" />
      </div>

      <div className={styles.grid2}>
        <Card padded>
          <CardHeader title="Dados do consultor" />
          <dl className={styles.dl}>
            <div className={styles.dlRow}><dt>Consultor</dt><dd>{c.consultor || "—"}</dd></div>
            <div className={styles.dlRow}><dt>E-mail</dt><dd>{c.email || "—"}</dd></div>
            <div className={styles.dlRow}><dt>Telefone</dt><dd>{c.telefone || "—"}</dd></div>
            <div className={styles.dlRow}><dt>Conselho</dt><dd>{c.conselho || "—"}</dd></div>
            <div className={styles.dlRow}><dt>Cadastro</dt><dd>{c.criadoEm ? dataLonga(c.criadoEm) : "—"}</dd></div>
          </dl>
        </Card>

        <Card padded>
          <CardHeader title="Assinatura na plataforma" />
          <dl className={styles.dl}>
            <div className={styles.dlRow}><dt>Plano</dt><dd>{c.planoSlug}</dd></div>
            <div className={styles.dlRow}>
              <dt>Valor de tabela</dt>
              <dd>{brl(rec?.assinatura.precoTabela ?? c.mrr)}<span className={styles.perMes}> /mês</span></dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Status</dt>
              <dd><StatusBadge variant={status.variant}>{status.label}</StatusBadge></dd>
            </div>
            {rec?.assinatura.existe && (
              <>
                <div className={styles.dlRow}>
                  <dt>Cobrado no gateway</dt>
                  <dd>
                    {rec.assinatura.valorGateway == null ? "—" : brl(rec.assinatura.valorGateway)}
                    <span className={styles.perMes}> /{cicloLabel(rec.assinatura.ciclo)}</span>
                    {rec.assinatura.valorGateway != null &&
                      rec.assinatura.valorGateway !== rec.assinatura.precoTabela && (
                        <span className={styles.divergente} title="Valor no gateway diferente do preço de tabela do plano">
                          <i className="ti ti-alert-triangle" aria-hidden /> diverge da tabela
                        </span>
                      )}
                  </dd>
                </div>
                <div className={styles.dlRow}>
                  <dt>Próxima cobrança</dt>
                  <dd>{rec.assinatura.proximaCobranca ? dataLonga(rec.assinatura.proximaCobranca.slice(0, 10)) : "—"}</dd>
                </div>
                <div className={styles.dlRow}>
                  <dt>Assinatura</dt>
                  <dd>{statusAssinaturaLabel(rec.assinatura.status)}</dd>
                </div>
              </>
            )}
            {rec && !rec.assinatura.existe && (
              <div className={styles.dlRow}>
                <dt>Cobrança</dt>
                <dd className={styles.muted}>Sem assinatura recorrente no gateway{c.planoSlug === "free" ? " (plano gratuito)" : ""}.</dd>
              </div>
            )}
          </dl>
          <div className={styles.cardFoot}>
            <Button variant="outline" icon="settings" href="/admin/assinaturas" fullWidth>
              Gerenciar assinaturas
            </Button>
          </div>
        </Card>
      </div>

      {/* Recebimentos: subconta no gateway, taxa retida, atrasos (dados reais) */}
      <Card padded className={styles.recebimentos}>
        <CardHeader title="Recebimentos do consultor" />
        <p className={styles.muted}>
          Subconta de recebimento, fatia da plataforma e inadimplência dos alunos — lidos ao vivo.
        </p>
        {rec === undefined ? (
          <p className={styles.muted}>Consultando o gateway…</p>
        ) : rec === null ? (
          <p className={styles.muted}>Dados de recebimento indisponíveis (sem gateway configurado ou sem permissão).</p>
        ) : (
          <>
            <div className={styles.recMetrics}>
              <MetricCard
                label="Saldo disponível"
                value={rec.subconta.saldo == null ? "—" : brl(rec.subconta.saldo)}
                sub={rec.subconta.criada ? "na subconta do coach" : "subconta não criada"}
                icon="wallet"
              />
              <MetricCard
                label="Taxa retida (total)"
                value={brl(rec.taxa.retidaTotal)}
                sub={`${brl(rec.taxa.retidaMes)} neste mês · ${rec.taxa.pct.toLocaleString("pt-BR")}%`}
                icon="percentage"
              />
              <MetricCard
                label="GMV acumulado"
                value={brl(rec.gmv.total)}
                sub={`${rec.gmv.cobrancasPagas} mensalidade(s) paga(s)`}
                icon="chart-bar"
              />
              <MetricCard
                label="Alunos em atraso"
                value={rec.atrasos.alunos}
                sub={rec.atrasos.cobrancasVencidas > 0 ? `${rec.atrasos.cobrancasVencidas} cobrança(s) · ${brl(rec.atrasos.valorVencido)}` : "nenhuma cobrança vencida"}
                icon="alert-triangle"
              />
            </div>

            <dl className={styles.dl}>
              <div className={styles.dlRow}>
                <dt>Verificação da conta</dt>
                <dd>
                  <StatusBadge variant={VERIFICACAO[rec.subconta.verificacao].variant}>
                    {VERIFICACAO[rec.subconta.verificacao].label}
                  </StatusBadge>
                  {rec.subconta.statusLocal === "aprovado" && rec.subconta.verificacao === "pendente" && (
                    <span className={styles.divergente} title="O banco marca aprovado (bypass de dev), mas o gateway ainda não aprovou">
                      <i className="ti ti-alert-triangle" aria-hidden /> banco diz aprovado
                    </span>
                  )}
                </dd>
              </div>
              {rec.subconta.criada && (
                <div className={styles.dlRow}>
                  <dt>Etapas</dt>
                  <dd className={styles.etapas}>
                    <Etapa nome="Dados comerciais" status={rec.subconta.detalhes.comercial} />
                    <Etapa nome="Conta bancária" status={rec.subconta.detalhes.bancario} />
                    <Etapa nome="Documentos" status={rec.subconta.detalhes.documentacao} />
                  </dd>
                </div>
              )}
              {rec.subconta.pendencias.length > 0 && (
                <div className={styles.dlRow}>
                  <dt>Pendências</dt>
                  <dd>
                    {rec.subconta.pendencias.map((p) => (
                      <div key={p.tipo}>{p.titulo} <span className={styles.muted}>· {p.status.toLowerCase().replace(/_/g, " ")}</span></div>
                    ))}
                  </dd>
                </div>
              )}
              <div className={styles.dlRow}>
                <dt>Wallet</dt>
                <dd className={styles.mono}>{rec.subconta.walletId ?? "—"}</dd>
              </div>
            </dl>
          </>
        )}
      </Card>

      {/* Produtos do consultor (planos que ele vende aos alunos) — CRUD */}
      <Card padded={false} className={styles.alunosCard}>
        <CardHeader title={`Produtos do consultor (${produtos.length})`} />
        {produtos.length === 0 ? (
          <p className={styles.muted} style={{ padding: "var(--space-5)" }}>
            Este consultor ainda não criou produtos (planos).
          </p>
        ) : (
          <div className={styles.rows}>
            {produtos.map((p) => (
              <ListRow
                key={p.id}
                title={p.nome}
                meta={`${p.tipoCobranca}${p.periodoRecorrencia ? ` · ${p.periodoRecorrencia}` : ""} · ${p.assinantes} assinantes`}
                action={
                  <div className={styles.rowActions}>
                    <StatusBadge variant={p.status === "ativo" ? "ok" : "off"}>
                      {p.status === "ativo" ? "Ativo" : "Pausado"}
                    </StatusBadge>
                    <span className={styles.perMes}>{brl(p.preco)}</span>
                    <KebabMenu
                      items={[
                        { label: "Editar", icon: "pencil", onClick: () => abrirEditProduto(p) },
                        { label: p.status === "pausado" ? "Reativar" : "Pausar", icon: p.status === "pausado" ? "player-play" : "player-pause", onClick: () => pausarProduto(p) },
                        { label: "Excluir", icon: "trash", danger: true, separatorBefore: true, onClick: () => excluirProduto(p) },
                      ]}
                    />
                  </div>
                }
              />
            ))}
          </div>
        )}
      </Card>

      {/* Alunos da consultoria */}
      <div className={styles.overviewGrid}>
        <MetricCard label="Alunos no painel" value={alunos.length} sub={`${novosAlunos} ativos`} icon="users" />
      </div>

      <Card padded={false} className={styles.alunosCard}>
        <CardHeader
          title={`Alunos da consultoria (${alunos.length})`}
          action={
            <Button size="sm" variant="outline" icon="plus" href="/admin/alunos">
              Novo aluno
            </Button>
          }
        />
        <AlunosList alunos={alunos} onChanged={carregar} />
      </Card>

      {/* Modal editar produto */}
      <Modal
        open={!!editProduto}
        onClose={() => !salvandoProduto && setEditProduto(null)}
        title="Editar produto"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditProduto(null)} disabled={salvandoProduto}>
              Cancelar
            </Button>
            <Button icon="check" onClick={salvarProduto} disabled={salvandoProduto}>
              {salvandoProduto ? "Salvando…" : "Salvar"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Input label="Nome do produto" value={pNome} onChange={(e) => setPNome(e.target.value)} />
          <Input label="Preço (R$)" prefix="R$" inputMode="decimal" value={pPreco} onChange={(e) => setPPreco(e.target.value)} />
        </div>
      </Modal>
    </>
  );
}

const VERIFICACAO: Record<
  RecebimentosConsultoria["subconta"]["verificacao"],
  { label: string; variant: "ok" | "pending" | "late" | "off" }
> = {
  aprovada: { label: "Aprovada", variant: "ok" },
  pendente: { label: "Pendente", variant: "pending" },
  reprovada: { label: "Reprovada", variant: "late" },
  desconhecida: { label: "Não consultada", variant: "off" },
};

function Etapa({ nome, status }: { nome: string; status?: string }) {
  const s = String(status ?? "").toUpperCase();
  const icon = s === "APPROVED" ? "circle-check" : s === "REJECTED" ? "circle-x" : "clock";
  const tom = s === "APPROVED" ? "ok" : s === "REJECTED" ? "late" : "pending";
  return (
    <span className={styles.etapa} data-tom={tom}>
      <i className={`ti ti-${icon}`} aria-hidden /> {nome}
    </span>
  );
}

function cicloLabel(ciclo: string | null): string {
  switch (String(ciclo ?? "").toUpperCase()) {
    case "YEARLY":
      return "ano";
    case "QUARTERLY":
      return "trimestre";
    case "SEMIANNUALLY":
      return "semestre";
    case "WEEKLY":
      return "semana";
    default:
      return "mês";
  }
}

function statusAssinaturaLabel(status: string | null): string {
  switch (String(status ?? "").toUpperCase()) {
    case "ACTIVE":
      return "Ativa";
    case "INACTIVE":
      return "Suspensa";
    case "EXPIRED":
      return "Expirada";
    default:
      return status ?? "—";
  }
}

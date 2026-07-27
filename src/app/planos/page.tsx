"use client";

import { useCallback, useEffect, useState } from "react";
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
import { listPlanos } from "@/lib/data";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { useSetupGate } from "@/lib/useSetupGate";
import {
  fetchPlanosConsultor,
  savePlano,
  setPlanoStatus,
  deletePlano,
  toPlanoInput,
} from "@/lib/db";
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

// Fator de mensalização do preço recorrente (para o MRR real).
const PERIODO_FATOR: Record<PeriodoRecorrencia, number> = {
  semanal: 52 / 12,
  mensal: 1,
  trimestral: 1 / 3,
  anual: 1 / 12,
};

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

function mrrDoPlano(p: Plano): number {
  if (p.tipoCobranca !== "recorrente" || p.status !== "ativo") return 0;
  return p.preco * PERIODO_FATOR[p.periodoRecorrencia ?? "mensal"] * p.assinantesAtivos;
}

/** Copia texto com fallback (clipboard API falha fora de foco/contexto seguro). */
async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    /* cai no fallback */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export default function PlanosPage() {
  const router = useRouter();
  const podeReal = supabaseEnabled;

  const [planos, setPlanos] = useState<Plano[]>(podeReal ? [] : listPlanos());
  const [carregando, setCarregando] = useState(podeReal);
  const [erro, setErro] = useState("");
  const [editing, setEditing] = useState<QuickEdit | null>(null);
  const [salvandoQuick, setSalvandoQuick] = useState(false);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<Plano | null>(null);

  // Gating: só cria plano com recebimento ativado E anamnese decidida (criada
  // ou opt-out). Regra centralizada em useSetupGate (mesma do /planos/novo).
  const gate = useSetupGate();
  const setupOk = gate.setupOk;

  const carregar = useCallback(async () => {
    if (!podeReal) return;
    setCarregando(true);
    setErro("");
    try {
      setPlanos(await fetchPlanosConsultor());
    } catch {
      setErro("Não foi possível carregar seus planos.");
    } finally {
      setCarregando(false);
    }
  }, [podeReal]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const mrr = planos.reduce((acc, p) => acc + mrrDoPlano(p), 0);
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

  async function salvarEdicaoRapida() {
    if (!editing) return;
    const base = planos.find((p) => p.id === editing.id);
    if (!base) return setEditing(null);
    const precoNum = Number(String(editing.preco).replace(",", "."));
    const atualizado: Plano = {
      ...base,
      nome: editing.nome.trim() || base.nome,
      preco: Number.isFinite(precoNum) && precoNum >= 0 ? precoNum : base.preco,
      periodoRecorrencia: editing.recorrencia,
      status: editing.status,
    };
    setSalvandoQuick(true);
    setErro("");
    try {
      if (podeReal) await savePlano(toPlanoInput(atualizado), atualizado.id);
      setPlanos((prev) => prev.map((p) => (p.id === atualizado.id ? atualizado : p)));
      setEditing(null);
    } catch {
      setErro("Não foi possível salvar a edição.");
    } finally {
      setSalvandoQuick(false);
    }
  }

  async function alternarStatus(p: Plano) {
    const novo: StatusPlano = p.status === "ativo" ? "pausado" : "ativo";
    setPlanos((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: novo } : x)));
    if (!podeReal) return;
    try {
      await setPlanoStatus(p.id, novo);
    } catch {
      setErro("Não foi possível atualizar o status.");
      carregar();
    }
  }

  async function duplicar(p: Plano) {
    const copia = { ...toPlanoInput(p), nome: `${p.nome} (cópia)`, status: "pausado" as StatusPlano };
    if (!podeReal) {
      setPlanos((prev) => [
        ...prev,
        { ...p, id: `local-${Date.now()}`, nome: copia.nome, status: "pausado", assinantesAtivos: 0 },
      ]);
      return;
    }
    setErro("");
    try {
      const novo = await savePlano(copia);
      setPlanos((prev) => [...prev, novo]);
    } catch {
      setErro("Não foi possível duplicar o plano.");
    }
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    const alvo = excluindo;
    setPlanos((prev) => prev.filter((p) => p.id !== alvo.id));
    setExcluindo(null);
    if (!podeReal) return;
    try {
      await deletePlano(alvo.id);
    } catch {
      setErro("Não foi possível excluir o plano.");
      carregar();
    }
  }

  async function copiarLink(p: Plano) {
    setErro("");
    setLinkGerado(null);
    // Modo protótipo: usa o link estático do mock.
    if (!podeReal) {
      await copiarTexto(p.linkPagamento);
      setCopiadoId(p.id);
      setTimeout(() => setCopiadoId(null), 1800);
      return;
    }
    // Real: gera um convite (link de onboarding do aluno) com o preço do plano.
    // Separa a chamada da API do clipboard — antes, um clipboard bloqueado caía
    // no catch e aparecia como "falha ao gerar o link" (mascarava a causa).
    let link: string;
    try {
      const res = await fetch("/api/convites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ valor: p.preco, planoId: p.id, descricao: p.nome }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setErro(data.erro || "Não foi possível gerar o link.");
        return;
      }
      link = `${window.location.origin}/onboarding/${data.token}`;
    } catch (e) {
      setErro(
        "Falha de conexão ao gerar o link" +
          (e instanceof Error && e.message ? ` (${e.message})` : "") +
          "."
      );
      return;
    }
    // Link gerado. Tenta copiar; se o clipboard for bloqueado, mostra pra copiar
    // manualmente (o link JÁ existe — não é erro de geração).
    const copiou = await copiarTexto(link);
    if (copiou) {
      setCopiadoId(p.id);
      setTimeout(() => setCopiadoId(null), 1800);
    } else {
      setLinkGerado(link);
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Planos & pagamentos"
        subtitle="Gerencie seus planos, preços e links de pagamento."
        actions={
          setupOk ? (
            <Button icon="plus" href="/planos/novo">
              Criar plano
            </Button>
          ) : (
            <Button icon="plus" disabled>
              Criar plano
            </Button>
          )
        }
      />

      {!gate.loading && !setupOk && (
        <Card padded>
          <h3 style={{ margin: "0 0 var(--space-2)", fontSize: 16 }}>
            Configure antes de criar planos
          </h3>
          <p style={{ margin: "0 0 var(--space-3)", color: "var(--color-text-secondary)", fontSize: 14 }}>
            Dois passos rápidos pra começar a vender e mandar o link da sua consultoria.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {[
              { ok: gate.recebimentoOk, titulo: "Ative seus recebimentos", desc: "Crie sua conta de recebimento pra receber dos alunos.", href: "/financeiro", cta: "Ativar" },
              { ok: gate.anamneseOk, titulo: "Configure a anamnese", desc: "Crie a anamnese — ou marque que não vai usar — em Configurações.", href: "/configuracoes", cta: "Configurar" },
            ].map((passo) => (
              <div key={passo.titulo} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <i
                  className={`ti ti-${passo.ok ? "circle-check" : "circle-dashed"}`}
                  style={{ color: passo.ok ? "var(--color-text-success)" : "var(--color-text-tertiary)", fontSize: 20 }}
                  aria-hidden
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 14 }}>{passo.titulo}</strong>
                  <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{passo.desc}</div>
                </div>
                {!passo.ok && (
                  <Button variant="outline" size="sm" href={passo.href}>
                    {passo.cta}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

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

      {erro && (
        <p style={{ color: "var(--color-text-danger)", fontSize: 13, margin: 0 }}>{erro}</p>
      )}

      {linkGerado && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            flexWrap: "wrap",
            background: "var(--color-background-secondary)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--border-radius-md)",
            padding: "var(--space-3)",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            Link gerado — copie e envie ao aluno:
          </span>
          <code
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              wordBreak: "break-all",
            }}
          >
            {linkGerado}
          </code>
          <Button
            variant="outline"
            size="sm"
            icon="copy"
            onClick={() => copiarTexto(linkGerado)}
          >
            Copiar
          </Button>
        </div>
      )}

      <Card padded={false}>
        {carregando ? (
          <div className={styles.emptyWrap}>
            <EmptyState icon="loader" title="Carregando planos…" description="Buscando seus planos." />
          </div>
        ) : planos.length === 0 ? (
          <div className={styles.emptyWrap}>
            <EmptyState
              icon="credit-card"
              title="Nenhum plano criado"
              description="Crie seu primeiro plano para começar a receber assinantes."
              action={
                setupOk ? (
                  <Button icon="plus" href="/planos/novo">
                    Criar plano
                  </Button>
                ) : (
                  <Button icon="plus" disabled>
                    Criar plano
                  </Button>
                )
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
                        <StatusBadge variant={p.status === "ativo" ? "ok" : "off"}>
                          {p.status === "ativo" ? "Ativo" : "Pausado"}
                        </StatusBadge>
                        <span className={styles.preco}>{precoLinha(p)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={copiadoId === p.id ? "check" : "link"}
                          onClick={() => copiarLink(p)}
                        >
                          {copiadoId === p.id ? "Copiado" : "Copiar link"}
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
                              icon: p.status === "ativo" ? "player-pause" : "player-play",
                              onClick: () => alternarStatus(p),
                            },
                            { label: "Duplicar", icon: "copy", onClick: () => duplicar(p) },
                            {
                              label: copiadoId === p.id ? "Copiado!" : "Copiar link",
                              icon: "link",
                              onClick: () => copiarLink(p),
                            },
                            {
                              label: "Excluir",
                              icon: "trash",
                              danger: true,
                              separatorBefore: true,
                              onClick: () => setExcluindo(p),
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
              <Button variant="outline" onClick={() => setEditing(null)} disabled={salvandoQuick}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={salvarEdicaoRapida} disabled={salvandoQuick}>
                {salvandoQuick ? "Salvando…" : "Salvar"}
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
              onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
            />
            <Input
              label="Preço"
              prefix="R$"
              inputMode="decimal"
              value={editing.preco}
              onChange={(e) => setEditing({ ...editing, preco: e.target.value })}
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
                onChange={(b) => setEditing({ ...editing, status: b ? "ativo" : "pausado" })}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={excluindo !== null}
        onClose={() => setExcluindo(null)}
        title="Excluir plano"
        size="sm"
        footer={
          <div className={styles.modalFooter}>
            <Button variant="outline" onClick={() => setExcluindo(null)}>
              Cancelar
            </Button>
            <Button variant="danger" icon="trash" onClick={confirmarExclusao}>
              Excluir
            </Button>
          </div>
        }
      >
        <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>
          Excluir <strong>{excluindo?.nome}</strong>? Os assinantes atuais não são cobrados por
          este link depois disso. Essa ação não pode ser desfeita.
        </p>
      </Modal>
    </div>
  );
}

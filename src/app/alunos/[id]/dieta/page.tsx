"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAlunoResolvido } from "@/lib/useAlunoResolvido";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  Input,
  Textarea,
  Segmented,
  Modal,
  StatusBadge,
  EmptyState,
  KebabMenu,
  SortableList,
} from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { getDieta, alimentoLibrary } from "@/lib/data";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { fetchDietaByAluno, saveDieta } from "@/lib/db";
import type { Refeicao, Alimento, AlimentoModelo, Macros } from "@/lib/types";
import { brlNumber } from "@/lib/format";
import styles from "./dieta.module.css";

/** Macros escalados por um fator — SEM arredondar (preserva a base por-unidade). */
function escalarMacros(m: Macros, f: number): Macros {
  return { kcal: m.kcal * f, p: m.p * f, c: m.c * f, g: m.g * f };
}

/** Arredonda os macros pra exibição (só no valor final, nunca na base). */
function arredondarMacros(m: Macros): Macros {
  return {
    kcal: Math.round(m.kcal),
    p: Math.round(m.p),
    c: Math.round(m.c),
    g: Math.round(m.g),
  };
}

/** "100 g" -> { valor: 100, unidade: "g" }; fallback 1 porção. */
function parsePorcao(porcao: string): { valor: number; unidade: string } {
  const match = (porcao ?? "").trim().match(/^([\d.,]+)\s*(.*)$/);
  if (!match) return { valor: 1, unidade: "porção" };
  const valor = parseFloat(match[1].replace(",", ".")) || 1;
  return { valor, unidade: match[2].trim() || "porção" };
}

export default function DietaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { nome: nomeAluno } = useAlunoResolvido(id);

  const dieta = supabaseEnabled ? undefined : getDieta(id);
  const [dietaId, setDietaId] = useState<string | undefined>(dieta?.id);
  const [refeicoes, setRefeicoes] = useState<Refeicao[]>(
    dieta?.refeicoes ?? []
  );
  const [metaKcal, setMetaKcal] = useState(dieta?.metaKcal ?? 2000);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  // Com Supabase: carrega a dieta existente do aluno (se houver).
  useEffect(() => {
    if (!supabaseEnabled) return;
    let vivo = true;
    fetchDietaByAluno(id)
      .then((d) => {
        if (!vivo || !d) return;
        setDietaId(d.id);
        setMetaKcal(d.metaKcal);
        setRefeicoes(d.refeicoes.map((r) => ({ ...r })));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [id]);

  async function handleEnviar() {
    if (!supabaseEnabled) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      const saved = await saveDieta(id, {
        id: dietaId,
        metaKcal,
        rascunho: false,
        refeicoes,
      });
      setDietaId(saved.id);
      router.push(`/alunos/${id}`);
      router.refresh();
    } catch (e) {
      const msg = (e as { message?: string })?.message;
      setErroSalvar(
        msg ? `Falha ao salvar: ${msg}` : "Falha ao salvar."
      );
      setSalvando(false);
    }
  }

  // Contador incremental para ids únicos (nunca Date.now()).
  const [contador, setContador] = useState(1);

  // Modal de criação de alimento próprio
  const [criarOpen, setCriarOpen] = useState(false);
  const formVazio = {
    nome: "",
    valor: "",
    unidade: "g",
    kcal: "",
    p: "",
    c: "",
    g: "",
  };
  const [form, setForm] = useState(formVazio);

  const UNIDADES = ["g", "ml", "unid", "fatias", "porção"];

  // Total de kcal somando todos os alimentos de todas as refeições
  const totalKcal = useMemo(
    () =>
      refeicoes.reduce(
        (acc, r) =>
          acc + r.alimentos.reduce((s, a) => s + a.macros.kcal, 0),
        0
      ),
    [refeicoes]
  );

  const resultadosBusca = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return alimentoLibrary;
    return alimentoLibrary.filter((a) => a.nome.toLowerCase().includes(q));
  }, [busca]);

  function kcalRefeicao(r: Refeicao) {
    return r.alimentos.reduce((s, a) => s + a.macros.kcal, 0);
  }

  // Gera id único a partir do contador incremental no estado.
  function novoId(prefix: string) {
    const n = contador;
    setContador((c) => c + 1);
    return `${prefix}-${n}`;
  }

  function alimentoDeModelo(m: AlimentoModelo, id: string): Alimento {
    const q = parsePorcao(m.porcao);
    return {
      id,
      nome: m.nome,
      quantidade: q,
      macros: { ...m.macros },
      // base por unidade → macros acompanham a quantidade ao editar
      macrosBase:
        q.valor > 0 ? escalarMacros(m.macros, 1 / q.valor) : { ...m.macros },
      substituicoes: [],
    };
  }

  function adicionarAlimento(refeicaoId: string, m: AlimentoModelo) {
    const id = novoId("a");
    setRefeicoes((prev) =>
      prev.map((r) =>
        r.id === refeicaoId
          ? { ...r, alimentos: [...r.alimentos, alimentoDeModelo(m, id)] }
          : r
      )
    );
  }

  // Atualiza a quantidade (valor ou unidade) de um alimento.
  function atualizarQuantidade(
    refeicaoId: string,
    alimentoId: string,
    patch: Partial<Alimento["quantidade"]>
  ) {
    setRefeicoes((prev) =>
      prev.map((r) => {
        if (r.id !== refeicaoId) return r;
        return {
          ...r,
          alimentos: r.alimentos.map((a) => {
            if (a.id !== alimentoId) return a;
            const novaQtd = { ...a.quantidade, ...patch };
            // Só o valor escala os macros (mudar a unidade não recalcula).
            if (patch.valor === undefined) return { ...a, quantidade: novaQtd };
            // Base por unidade: usa a guardada ou deriva do estado atual.
            const base =
              a.macrosBase ??
              (a.quantidade.valor > 0
                ? escalarMacros(a.macros, 1 / a.quantidade.valor)
                : a.macros);
            return {
              ...a,
              quantidade: novaQtd,
              macrosBase: base,
              macros: arredondarMacros(escalarMacros(base, patch.valor)),
            };
          }),
        };
      })
    );
  }

  // Atualiza campos arbitrários de um alimento (ex.: observações).
  function atualizarAlimento(
    refeicaoId: string,
    alimentoId: string,
    patch: Partial<Alimento>
  ) {
    setRefeicoes((prev) =>
      prev.map((r) =>
        r.id === refeicaoId
          ? {
              ...r,
              alimentos: r.alimentos.map((a) =>
                a.id === alimentoId ? { ...a, ...patch } : a
              ),
            }
          : r
      )
    );
  }

  // Atualiza campos arbitrários de uma refeição (ex.: observações).
  function atualizarRefeicao(refeicaoId: string, patch: Partial<Refeicao>) {
    setRefeicoes((prev) =>
      prev.map((r) => (r.id === refeicaoId ? { ...r, ...patch } : r))
    );
  }

  // Cria um alimento próprio a partir do formulário do modal.
  function criarAlimento() {
    if (!form.nome.trim()) return;
    const refeicaoAlvo = refeicoes[0];
    if (!refeicaoAlvo) return;

    const algumMacro =
      form.kcal !== "" || form.p !== "" || form.c !== "" || form.g !== "";
    const semMacros = !algumMacro;

    const valor = Number(form.valor) || 0;
    const macros: Macros = {
      kcal: Number(form.kcal) || 0,
      p: Number(form.p) || 0,
      c: Number(form.c) || 0,
      g: Number(form.g) || 0,
    };
    const novo: Alimento = {
      id: novoId("custom"),
      nome: form.nome.trim(),
      quantidade: { valor, unidade: form.unidade },
      macros,
      macrosBase: valor > 0 ? escalarMacros(macros, 1 / valor) : macros,
      substituicoes: [],
      custom: true,
      ...(semMacros ? { semMacros: true } : {}),
    };

    setRefeicoes((prev) =>
      prev.map((r) =>
        r.id === refeicaoAlvo.id
          ? { ...r, alimentos: [...r.alimentos, novo] }
          : r
      )
    );
    setForm(formVazio);
    setCriarOpen(false);
  }

  // Adiciona à primeira refeição (atalho da busca)
  function adicionarNaPrimeira(m: AlimentoModelo) {
    if (refeicoes.length === 0) return;
    adicionarAlimento(refeicoes[0].id, m);
  }

  function removerAlimento(refeicaoId: string, alimentoId: string) {
    setRefeicoes((prev) =>
      prev.map((r) =>
        r.id === refeicaoId
          ? { ...r, alimentos: r.alimentos.filter((a) => a.id !== alimentoId) }
          : r
      )
    );
  }

  function removerRefeicao(refeicaoId: string) {
    setRefeicoes((prev) => prev.filter((r) => r.id !== refeicaoId));
  }

  function adicionarRefeicao() {
    setRefeicoes((prev) => [
      ...prev,
      {
        id: novoId("r"),
        ordem: prev.length + 1,
        nome: `Refeição ${prev.length + 1}`,
        horario: "12:00",
        alimentos: [],
      },
    ]);
  }

  const semRefeicoes = refeicoes.length === 0;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow={nomeAluno || "Aluno"}
        title={
          <span className={styles.titleRow}>
            Dieta
            <StatusBadge variant="off" noDot icon="pencil">
              Rascunho
            </StatusBadge>
          </span>
        }
        subtitle={
          <span className={styles.metaKcal}>
            <i className="ti ti-flame" aria-hidden />
            <strong>{brlNumber(totalKcal).replace(/,\d+$/, "")}</strong>
            <span className={styles.metaSep}>
              / {metaKcal.toLocaleString("pt-BR")} kcal
            </span>
          </span>
        }
        actions={
          <div className={styles.headerActions}>
            <Button variant="ghost" icon="arrow-left" href={`/alunos/${id}`}>
              Voltar
            </Button>
            <Button icon="send" onClick={handleEnviar} disabled={salvando}>
              {salvando ? "Enviando…" : "Enviar para o aluno"}
            </Button>
          </div>
        }
      />
      {erroSalvar && (
        <p
          role="alert"
          style={{ color: "var(--color-text-danger)", fontSize: 14, margin: 0 }}
        >
          {erroSalvar}
        </p>
      )}

      {/* Busca TACO */}
      <Card>
        <CardHeader
          title={
            <span className={styles.searchTitle}>
              <i className="ti ti-database" aria-hidden /> Tabela TACO
            </span>
          }
          action={
            <span className={styles.searchHint}>
              {refeicoes.length === 0
                ? "Crie uma refeição para adicionar alimentos"
                : `Adiciona em: ${refeicoes[0].nome}`}
            </span>
          }
        />
        <div className={styles.searchBody}>
          <div className={styles.searchTopRow}>
            <div className={styles.searchInput}>
              <Input
                icon="search"
                placeholder="Buscar alimento (TACO)…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              icon="sparkles"
              disabled={semRefeicoes}
              onClick={() => {
                setForm(formVazio);
                setCriarOpen(true);
              }}
            >
              Criar alimento
            </Button>
          </div>
          <div className={styles.tacoList}>
            {resultadosBusca.length === 0 ? (
              <EmptyState
                compact
                icon="search-off"
                title="Nenhum alimento encontrado"
                description="Tente outro termo de busca."
              />
            ) : (
              resultadosBusca.map((m) => (
                <div key={m.id} className={styles.tacoRow}>
                  <div className={styles.tacoInfo}>
                    <span className={styles.tacoNome}>{m.nome}</span>
                    <span className={styles.tacoMacros}>
                      {m.porcao} · {m.macros.kcal} kcal · P {m.macros.p} · C{" "}
                      {m.macros.c} · G {m.macros.g}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    icon="plus"
                    disabled={semRefeicoes}
                    onClick={() => adicionarNaPrimeira(m)}
                  >
                    Adicionar
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      {/* Refeições */}
      {semRefeicoes ? (
        <EmptyState
          icon="salad"
          title="Nenhuma refeição ainda"
          description="Comece adicionando a primeira refeição da dieta deste aluno."
          action={
            <Button variant="primary" icon="plus" onClick={adicionarRefeicao}>
              Adicionar refeição
            </Button>
          }
        />
      ) : (
        <SortableList
          items={refeicoes}
          getKey={(r) => r.id}
          onReorder={(next) => setRefeicoes(next)}
          renderItem={(r, _i, handleClassName) => (
            <Card className={styles.refeicaoCard}>
              <div className={styles.refeicaoHead}>
                <span className={`${handleClassName} ${styles.refeicaoGrip}`}>
                  <i className="ti ti-grip-vertical" aria-hidden />
                </span>
                <div
                  className={styles.refeicaoTitle}
                  style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, minWidth: 0 }}
                >
                  <input
                    value={r.nome}
                    onChange={(e) =>
                      atualizarRefeicao(r.id, { nome: e.target.value })
                    }
                    aria-label="Nome da refeição"
                    placeholder="Nome da refeição"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontWeight: 700,
                      fontSize: 15,
                      color: "var(--color-text-primary)",
                      background: "var(--color-background-secondary)",
                      border: "1px solid var(--color-border-secondary)",
                      borderRadius: 8,
                      padding: "6px 10px",
                    }}
                  />
                  <input
                    type="time"
                    value={r.horario}
                    onChange={(e) =>
                      atualizarRefeicao(r.id, { horario: e.target.value })
                    }
                    aria-label="Horário da refeição"
                    style={{
                      fontSize: 13,
                      color: "var(--color-text-secondary)",
                      background: "var(--color-background-secondary)",
                      border: "1px solid var(--color-border-secondary)",
                      borderRadius: 8,
                      padding: "6px 8px",
                    }}
                  />
                </div>
                <span className={styles.refeicaoKcal}>
                  {kcalRefeicao(r)} kcal
                </span>
                <KebabMenu
                  items={[
                    {
                      label: "Remover refeição",
                      icon: "trash",
                      danger: true,
                      onClick: () => removerRefeicao(r.id),
                    },
                  ]}
                />
              </div>

              <div className={styles.refeicaoObs}>
                <Textarea
                  rows={2}
                  label="Orientações da refeição (como/quando consumir)"
                  placeholder="Orientações da refeição (como/quando consumir)"
                  value={r.observacoes ?? ""}
                  onChange={(e) =>
                    atualizarRefeicao(r.id, { observacoes: e.target.value })
                  }
                />
              </div>

              <div className={styles.alimentos}>
                {r.alimentos.length === 0 ? (
                  <p className={styles.semAlimentos}>
                    Nenhum alimento nesta refeição.
                  </p>
                ) : (
                  r.alimentos.map((a) => (
                    <div key={a.id} className={styles.alimentoRow}>
                      <div className={styles.alimentoLinha1}>
                        <span className={styles.alimentoGrip}>
                          <i className="ti ti-grip-vertical" aria-hidden />
                        </span>
                        <span className={styles.alimentoNome}>{a.nome}</span>
                        {a.custom && (
                          <Chip icon="sparkles">Criado</Chip>
                        )}
                        <KebabMenu
                          items={[
                            { label: "Substituir", icon: "repeat" },
                            {
                              label: "Remover",
                              icon: "trash",
                              danger: true,
                              separatorBefore: true,
                              onClick: () => removerAlimento(r.id, a.id),
                            },
                          ]}
                        />
                      </div>
                      <div className={styles.alimentoLinha2}>
                        <div className={styles.qtdEditor}>
                          <div className={styles.qtdInput}>
                            <Input
                              type="number"
                              value={String(a.quantidade.valor)}
                              onChange={(e) =>
                                atualizarQuantidade(r.id, a.id, {
                                  valor: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <Segmented
                            options={UNIDADES.map((u) => ({
                              label: u,
                              value: u,
                            }))}
                            value={a.quantidade.unidade}
                            onChange={(v) =>
                              atualizarQuantidade(r.id, a.id, { unidade: v })
                            }
                          />
                        </div>
                        {a.semMacros ? (
                          <span className={styles.alimentoSemMacros}>
                            macros não informados
                          </span>
                        ) : (
                          <span className={styles.alimentoMacros}>
                            {a.macros.kcal} kcal · P {a.macros.p} · C{" "}
                            {a.macros.c} · G {a.macros.g}
                          </span>
                        )}
                      </div>
                      {a.substituicoes.length > 0 ? (
                        <div className={styles.subs}>
                          <span className={styles.subsLabel}>Substituições:</span>
                          {a.substituicoes.map((s) => (
                            <Chip key={s} icon="repeat">
                              {s}
                            </Chip>
                          ))}
                          <Chip icon="plus">adicionar</Chip>
                        </div>
                      ) : (
                        <div className={styles.subs}>
                          <Chip icon="plus">adicionar substituição</Chip>
                        </div>
                      )}
                      <div className={styles.alimentoObs}>
                        <Textarea
                          rows={2}
                          label="Como consumir este alimento (preparo, modo de comer…)"
                          placeholder="Como consumir este alimento (preparo, modo de comer…)"
                          value={a.observacoes ?? ""}
                          onChange={(e) =>
                            atualizarAlimento(r.id, a.id, {
                              observacoes: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className={styles.refeicaoFooter}>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="plus"
                  onClick={() => adicionarAlimento(r.id, alimentoLibrary[0])}
                >
                  Adicionar alimento
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="sparkles"
                  onClick={() => {
                    setForm(formVazio);
                    setCriarOpen(true);
                  }}
                >
                  Criar alimento
                </Button>
              </div>
            </Card>
          )}
        />
      )}

      {/* Rodapé geral */}
      {!semRefeicoes && (
        <div className={styles.rodape}>
          <Button variant="outline" icon="plus" onClick={adicionarRefeicao}>
            Adicionar refeição
          </Button>
          <Button variant="ghost" icon="bookmark">
            Salvar como modelo
          </Button>
        </div>
      )}

      {/* Modal: criar alimento próprio */}
      <Modal
        open={criarOpen}
        onClose={() => setCriarOpen(false)}
        title="Criar alimento"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCriarOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              icon="plus"
              disabled={!form.nome.trim() || semRefeicoes}
              onClick={criarAlimento}
            >
              Adicionar
            </Button>
          </>
        }
      >
        <div className={styles.modalBody}>
          {refeicoes[0] && (
            <p className={styles.modalAlvo}>
              <i className="ti ti-arrow-down-right" aria-hidden /> Adiciona em:{" "}
              <strong>{refeicoes[0].nome}</strong>
            </p>
          )}

          <Input
            label="Nome"
            placeholder="Ex.: Pão caseiro"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
          />

          <div className={styles.modalQtd}>
            <div className={styles.modalQtdValor}>
              <Input
                label="Quantidade"
                type="number"
                placeholder="0"
                value={form.valor}
                onChange={(e) =>
                  setForm((f) => ({ ...f, valor: e.target.value }))
                }
              />
            </div>
            <div className={styles.modalQtdUnidade}>
              <span className={styles.modalUnidLabel}>Unidade</span>
              <Segmented
                options={UNIDADES.map((u) => ({ label: u, value: u }))}
                value={form.unidade}
                onChange={(v) => setForm((f) => ({ ...f, unidade: v }))}
              />
            </div>
          </div>

          <div className={styles.modalMacros}>
            <div className={styles.modalMacrosHead}>
              <span className={styles.modalMacrosTitle}>Macros</span>
              <StatusBadge variant="off" noDot>
                Opcional
              </StatusBadge>
            </div>
            <p className={styles.modalMacrosHint}>
              Deixe em branco se ainda não souber os valores — o alimento será
              marcado como “macros não informados”.
            </p>
            <div className={styles.modalMacrosGrid}>
              <Input
                label="Calorias (kcal)"
                type="number"
                placeholder="0"
                value={form.kcal}
                onChange={(e) =>
                  setForm((f) => ({ ...f, kcal: e.target.value }))
                }
              />
              <Input
                label="Proteína (P, g)"
                type="number"
                placeholder="0"
                value={form.p}
                onChange={(e) => setForm((f) => ({ ...f, p: e.target.value }))}
              />
              <Input
                label="Carboidrato (C, g)"
                type="number"
                placeholder="0"
                value={form.c}
                onChange={(e) => setForm((f) => ({ ...f, c: e.target.value }))}
              />
              <Input
                label="Gordura (G, g)"
                type="number"
                placeholder="0"
                value={form.g}
                onChange={(e) => setForm((f) => ({ ...f, g: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

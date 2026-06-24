"use client";

import { use, useMemo, useState } from "react";
import { useAlunoResolvido } from "@/lib/useAlunoResolvido";
import {
  Button,
  Card,
  CardHeader,
  Input,
  Textarea,
  Modal,
  StatusBadge,
  EmptyState,
  KebabMenu,
  SortableList,
} from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { getProtocolo, suplementoLibrary } from "@/lib/data";
import type {
  ProtocoloBloco,
  ProtocoloItem,
  SuplementoModelo,
} from "@/lib/types";
import styles from "./protocolo.module.css";

export default function ProtocoloPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { nome: nomeAluno } = useAlunoResolvido(id);

  const protocolo = getProtocolo(id);
  const [blocos, setBlocos] = useState<ProtocoloBloco[]>(
    protocolo?.blocos ?? []
  );
  const [busca, setBusca] = useState("");

  // Contador incremental para ids únicos (nunca Date.now()).
  const [contador, setContador] = useState(1);

  // Modal de criação de item — pode mirar um bloco específico (ou o primeiro).
  const [criarOpen, setCriarOpen] = useState(false);
  const [blocoAlvoId, setBlocoAlvoId] = useState<string | null>(null);
  const formVazio = {
    nome: "",
    dose: "",
    horario: "",
    observacoes: "",
  };
  const [form, setForm] = useState(formVazio);

  // Total de itens somando todos os blocos.
  const totalItens = useMemo(
    () => blocos.reduce((acc, b) => acc + b.itens.length, 0),
    [blocos]
  );

  const resultadosBusca = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return suplementoLibrary;
    return suplementoLibrary.filter(
      (s) =>
        s.nome.toLowerCase().includes(q) ||
        s.categoria.toLowerCase().includes(q)
    );
  }, [busca]);

  // Gera id único a partir do contador incremental no estado.
  function novoId(prefix: string) {
    const n = contador;
    setContador((c) => c + 1);
    return `${prefix}-${n}`;
  }

  function itemDeModelo(m: SuplementoModelo, itemId: string): ProtocoloItem {
    return {
      id: itemId,
      ordem: 0,
      nome: m.nome,
      dose: m.doseSugerida,
    };
  }

  // Adiciona um ProtocoloItem ao bloco indicado.
  function adicionarItem(blocoId: string, item: ProtocoloItem) {
    setBlocos((prev) =>
      prev.map((b) =>
        b.id === blocoId
          ? {
              ...b,
              itens: [...b.itens, { ...item, ordem: b.itens.length + 1 }],
            }
          : b
      )
    );
  }

  // Atalho da busca: adiciona no primeiro bloco.
  function adicionarNaPrimeira(m: SuplementoModelo) {
    if (blocos.length === 0) return;
    adicionarItem(blocos[0].id, itemDeModelo(m, novoId("i")));
  }

  // Atualiza campos editáveis de um item imutavelmente.
  function atualizarItem(
    blocoId: string,
    itemId: string,
    patch: Partial<ProtocoloItem>
  ) {
    setBlocos((prev) =>
      prev.map((b) =>
        b.id === blocoId
          ? {
              ...b,
              itens: b.itens.map((it) =>
                it.id === itemId ? { ...it, ...patch } : it
              ),
            }
          : b
      )
    );
  }

  function removerItem(blocoId: string, itemId: string) {
    setBlocos((prev) =>
      prev.map((b) =>
        b.id === blocoId
          ? { ...b, itens: b.itens.filter((it) => it.id !== itemId) }
          : b
      )
    );
  }

  // Reordena os itens dentro de um bloco.
  function reordenarItens(blocoId: string, next: ProtocoloItem[]) {
    setBlocos((prev) =>
      prev.map((b) => (b.id === blocoId ? { ...b, itens: next } : b))
    );
  }

  function removerBloco(blocoId: string) {
    setBlocos((prev) => prev.filter((b) => b.id !== blocoId));
  }

  function adicionarBloco() {
    setBlocos((prev) => [
      ...prev,
      {
        id: novoId("b"),
        ordem: prev.length + 1,
        nome: `Bloco ${prev.length + 1}`,
        itens: [],
      },
    ]);
  }

  // Abre o modal de criar item mirando um bloco (ou o primeiro).
  function abrirCriar(blocoId?: string) {
    setForm(formVazio);
    setBlocoAlvoId(blocoId ?? blocos[0]?.id ?? null);
    setCriarOpen(true);
  }

  // Cria um item próprio a partir do formulário do modal.
  function criarItem() {
    if (!form.nome.trim()) return;
    const alvoId = blocoAlvoId ?? blocos[0]?.id;
    if (!alvoId) return;

    const novo: ProtocoloItem = {
      id: novoId("custom"),
      ordem: 0,
      nome: form.nome.trim(),
      dose: form.dose.trim(),
      ...(form.horario.trim() ? { horario: form.horario.trim() } : {}),
      ...(form.observacoes.trim()
        ? { observacoes: form.observacoes.trim() }
        : {}),
    };

    adicionarItem(alvoId, novo);
    setForm(formVazio);
    setCriarOpen(false);
  }

  const semBlocos = blocos.length === 0;
  const blocoAlvo = blocos.find((b) => b.id === blocoAlvoId) ?? blocos[0];

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow={`PROTOCOLO · ${nomeAluno || "Aluno"}`}
        title={
          <span className={styles.titleRow}>
            Protocolo
            <StatusBadge variant="off" noDot icon="pencil">
              Rascunho
            </StatusBadge>
          </span>
        }
        subtitle={
          <span className={styles.metaItens}>
            <i className="ti ti-pill" aria-hidden />
            <strong>{totalItens}</strong>
            <span className={styles.metaSep}>
              {totalItens === 1 ? "item no total" : "itens no total"}
            </span>
          </span>
        }
        actions={
          <div className={styles.headerActions}>
            <Button variant="ghost" icon="arrow-left" href={`/alunos/${id}`}>
              Voltar
            </Button>
            <Button icon="send">Enviar para o aluno</Button>
          </div>
        }
      />

      {/* Biblioteca de suplementos */}
      <Card>
        <CardHeader
          title={
            <span className={styles.searchTitle}>
              <i className="ti ti-database" aria-hidden /> Biblioteca
            </span>
          }
          action={
            <span className={styles.searchHint}>
              {semBlocos
                ? "Crie um bloco para adicionar itens"
                : `Adiciona em: ${blocos[0].nome}`}
            </span>
          }
        />
        <div className={styles.searchBody}>
          <div className={styles.searchTopRow}>
            <div className={styles.searchInput}>
              <Input
                icon="search"
                placeholder="Buscar suplemento…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              icon="sparkles"
              disabled={semBlocos}
              onClick={() => abrirCriar()}
            >
              Criar item
            </Button>
          </div>
          <div className={styles.supList}>
            {resultadosBusca.length === 0 ? (
              <EmptyState
                compact
                icon="search-off"
                title="Nenhum suplemento encontrado"
                description="Tente outro termo de busca."
              />
            ) : (
              resultadosBusca.map((m) => (
                <div key={m.id} className={styles.supRow}>
                  <div className={styles.supInfo}>
                    <span className={styles.supNome}>{m.nome}</span>
                    <span className={styles.supMeta}>
                      <span className={styles.supCategoria}>{m.categoria}</span>
                      {" · "}
                      {m.doseSugerida}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    icon="plus"
                    disabled={semBlocos}
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

      {/* Blocos */}
      {semBlocos ? (
        <EmptyState
          icon="pill"
          title="Monte o protocolo"
          description="Adicione suplementos da biblioteca ou crie itens."
          action={
            <Button variant="primary" icon="plus" onClick={adicionarBloco}>
              Adicionar bloco
            </Button>
          }
        />
      ) : (
        <SortableList
          items={blocos}
          getKey={(b) => b.id}
          onReorder={(next) => setBlocos(next)}
          renderItem={(b, _i, handleClassName) => (
            <Card className={styles.blocoCard}>
              <div className={styles.blocoHead}>
                <span className={`${handleClassName} ${styles.blocoGrip}`}>
                  <i className="ti ti-grip-vertical" aria-hidden />
                </span>
                <div className={styles.blocoTitle}>
                  <span className={styles.blocoNome}>{b.nome}</span>
                </div>
                <span className={styles.blocoCount}>
                  {b.itens.length}{" "}
                  {b.itens.length === 1 ? "item" : "itens"}
                </span>
                <KebabMenu
                  items={[
                    { label: "Renomear", icon: "pencil" },
                    {
                      label: "Remover bloco",
                      icon: "trash",
                      danger: true,
                      separatorBefore: true,
                      onClick: () => removerBloco(b.id),
                    },
                  ]}
                />
              </div>

              <div className={styles.itens}>
                {b.itens.length === 0 ? (
                  <p className={styles.semItens}>Nenhum item neste bloco.</p>
                ) : (
                  <SortableList
                    items={b.itens}
                    getKey={(it) => it.id}
                    onReorder={(next) => reordenarItens(b.id, next)}
                    renderItem={(it, _j, itemHandleClassName) => (
                      <div className={styles.itemRow}>
                        <div className={styles.itemLinha1}>
                          <span
                            className={`${itemHandleClassName} ${styles.itemGrip}`}
                          >
                            <i className="ti ti-grip-vertical" aria-hidden />
                          </span>
                          <span className={styles.itemNome}>{it.nome}</span>
                          <KebabMenu
                            items={[
                              {
                                label: "Remover",
                                icon: "trash",
                                danger: true,
                                onClick: () => removerItem(b.id, it.id),
                              },
                            ]}
                          />
                        </div>
                        <div className={styles.itemLinha2}>
                          <div className={styles.itemDose}>
                            <Input
                              label="Dose"
                              placeholder="Ex.: 5 g"
                              value={it.dose}
                              onChange={(e) =>
                                atualizarItem(b.id, it.id, {
                                  dose: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className={styles.itemHorario}>
                            <Input
                              label="Horário"
                              placeholder="Ex.: Pós-treino"
                              value={it.horario ?? ""}
                              onChange={(e) =>
                                atualizarItem(b.id, it.id, {
                                  horario: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className={styles.itemObs}>
                            <Textarea
                              label="Aviso curto"
                              placeholder="Ex.: evitar após as 17h"
                              rows={2}
                              value={it.observacoes ?? ""}
                              onChange={(e) =>
                                atualizarItem(b.id, it.id, {
                                  observacoes: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>

                        <div className={styles.itemDetalhe}>
                          <Textarea
                            label="Como usar — o aluno vê isso"
                            placeholder="Explique como usar: quando, com o quê e por quê…"
                            rows={2}
                            value={it.comoUsar ?? ""}
                            onChange={(e) =>
                              atualizarItem(b.id, it.id, {
                                comoUsar: e.target.value,
                              })
                            }
                          />
                          <div className={styles.itemDetalheGrid}>
                            <Input
                              label="Com o quê"
                              placeholder="Ex.: 250 ml de água"
                              value={it.comOQue ?? ""}
                              onChange={(e) =>
                                atualizarItem(b.id, it.id, {
                                  comOQue: e.target.value,
                                })
                              }
                            />
                            <Input
                              label="Duração"
                              placeholder="Ex.: Contínuo"
                              value={it.duracao ?? ""}
                              onChange={(e) =>
                                atualizarItem(b.id, it.id, {
                                  duracao: e.target.value,
                                })
                              }
                            />
                            <Input
                              label="Para que serve"
                              placeholder="Benefício pro aluno"
                              value={it.beneficio ?? ""}
                              onChange={(e) =>
                                atualizarItem(b.id, it.id, {
                                  beneficio: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  />
                )}
              </div>

              <div className={styles.blocoFooter}>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="plus"
                  onClick={() => abrirCriar(b.id)}
                >
                  Adicionar item
                </Button>
              </div>
            </Card>
          )}
        />
      )}

      {/* Rodapé geral */}
      {!semBlocos && (
        <div className={styles.rodape}>
          <Button variant="outline" icon="plus" onClick={adicionarBloco}>
            Adicionar bloco
          </Button>
          <Button variant="ghost" icon="bookmark">
            Salvar como modelo
          </Button>
        </div>
      )}

      {/* Modal: criar item do protocolo */}
      <Modal
        open={criarOpen}
        onClose={() => setCriarOpen(false)}
        title="Criar item do protocolo"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCriarOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              icon="plus"
              disabled={!form.nome.trim() || semBlocos}
              onClick={criarItem}
            >
              Adicionar
            </Button>
          </>
        }
      >
        <div className={styles.modalBody}>
          {blocoAlvo && (
            <p className={styles.modalAlvo}>
              <i className="ti ti-arrow-down-right" aria-hidden /> Adiciona em:{" "}
              <strong>{blocoAlvo.nome}</strong>
            </p>
          )}

          <Input
            label="Nome"
            placeholder="Ex.: Creatina monohidratada"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
          />

          <div className={styles.modalGrid}>
            <Input
              label="Dose"
              placeholder='Ex.: "5 g", "2 cápsulas"'
              value={form.dose}
              onChange={(e) => setForm((f) => ({ ...f, dose: e.target.value }))}
            />
            <Input
              label="Horário"
              placeholder="Ex.: Pós-treino"
              value={form.horario}
              onChange={(e) =>
                setForm((f) => ({ ...f, horario: e.target.value }))
              }
            />
          </div>

          <Textarea
            label="Observações"
            placeholder="Como/quando tomar"
            rows={3}
            value={form.observacoes}
            onChange={(e) =>
              setForm((f) => ({ ...f, observacoes: e.target.value }))
            }
          />
        </div>
      </Modal>
    </div>
  );
}

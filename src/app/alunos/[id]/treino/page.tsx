"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAlunoResolvido } from "@/lib/useAlunoResolvido";
import {
  Button,
  Card,
  CardBody,
  StatusBadge,
  Input,
  EmptyState,
  KebabMenu,
  SortableList,
  Segmented,
  Chip,
  Textarea,
  Modal,
} from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { getTreino, exercicioLibrary } from "@/lib/data";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { fetchTreinosByAluno, saveTreinos } from "@/lib/db";
import type { Exercicio, SerieSpec, VideoOrigem } from "@/lib/types";
import styles from "./treino.module.css";

/** Um treino no editor: `key` (estável no cliente) + `id` do banco (se já existe). */
type TreinoEdit = { key: string; id?: string; nome: string; exercicios: Exercicio[] };

const LETRA = (i: number) => String.fromCharCode(65 + (i % 26)); // 0->A, 1->B…

function novoTreino(indice: number): TreinoEdit {
  return { key: `t-${crypto.randomUUID()}`, nome: `Treino ${LETRA(indice)}`, exercicios: [] };
}

export default function TreinoBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { nome: nomeAluno } = useAlunoResolvido(id);

  // Estado inicial: mock (protótipo) vira 1 treino; Supabase carrega no efeito.
  const [treinos, setTreinos] = useState<TreinoEdit[]>(() => {
    if (supabaseEnabled) return [];
    const t = getTreino(id);
    return t
      ? [{ key: `t-${crypto.randomUUID()}`, id: t.id, nome: t.nome, exercicios: t.exercicios.map((e) => ({ ...e })) }]
      : [];
  });
  const [removidos, setRemovidos] = useState<string[]>([]); // ids do banco removidos
  const [alvoKey, setAlvoKey] = useState<string>(""); // treino que recebe da biblioteca
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  // Com Supabase: carrega o split existente do aluno.
  useEffect(() => {
    if (!supabaseEnabled) return;
    let vivo = true;
    fetchTreinosByAluno(id)
      .then((lista) => {
        if (!vivo) return;
        setTreinos(
          lista.map((t) => ({
            key: `t-${crypto.randomUUID()}`,
            id: t.id,
            nome: t.nome,
            exercicios: t.exercicios.map((e) => ({ ...e })),
          }))
        );
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [id]);

  // Garante que o alvo da biblioteca aponta para um treino existente (o 1º).
  const alvo = treinos.find((t) => t.key === alvoKey) ?? treinos[0];
  useEffect(() => {
    if (treinos.length && !treinos.some((t) => t.key === alvoKey)) {
      setAlvoKey(treinos[0].key);
    }
  }, [treinos, alvoKey]);

  // ---- helpers de estado ----
  function updateExs(treinoKey: string, updater: (exs: Exercicio[]) => Exercicio[]) {
    setTreinos((prev) =>
      prev.map((t) => (t.key === treinoKey ? { ...t, exercicios: updater(t.exercicios) } : t))
    );
  }
  function proximaOrdem(exs: Exercicio[]) {
    return exs.reduce((max, e) => Math.max(max, e.ordem), 0) + 1;
  }

  // ---- treinos (nível do split) ----
  function adicionarTreino() {
    setTreinos((prev) => {
      const t = novoTreino(prev.length);
      setAlvoKey(t.key);
      return [...prev, t];
    });
  }
  function removerTreino(treinoKey: string) {
    setTreinos((prev) => {
      const alvoT = prev.find((t) => t.key === treinoKey);
      if (alvoT?.id) setRemovidos((r) => [...r, alvoT.id as string]);
      return prev.filter((t) => t.key !== treinoKey);
    });
  }
  function renomearTreino(treinoKey: string, nome: string) {
    setTreinos((prev) => prev.map((t) => (t.key === treinoKey ? { ...t, nome } : t)));
  }

  async function handleEnviar() {
    if (!supabaseEnabled) return; // stub no protótipo
    if (treinos.length === 0) {
      setErroSalvar("Adicione ao menos um treino.");
      return;
    }
    for (const t of treinos) {
      if (!t.nome.trim()) {
        setErroSalvar("Todo treino precisa de um nome.");
        return;
      }
      if (t.exercicios.length === 0) {
        setErroSalvar(`"${t.nome}" está vazio — adicione exercícios ou remova o treino.`);
        return;
      }
      if (t.exercicios.some((e) => !e.nome.trim())) {
        setErroSalvar("Todos os exercícios precisam de um nome.");
        return;
      }
    }
    setSalvando(true);
    setErroSalvar(null);
    try {
      await saveTreinos(
        id,
        treinos.map((t) => ({ id: t.id, nome: t.nome, exercicios: t.exercicios })),
        removidos
      );
      router.push(`/alunos/${id}`);
      router.refresh();
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : "Falha ao salvar.");
      setSalvando(false);
    }
  }

  // ---- modal criar exercício ----
  const [modalAberto, setModalAberto] = useState(false);
  const [modalTreinoKey, setModalTreinoKey] = useState<string>("");
  const [novoNome, setNovoNome] = useState("");
  const [novoGrupo, setNovoGrupo] = useState("");
  const [novoSeries, setNovoSeries] = useState("3");
  const [novoReps, setNovoReps] = useState("10-12");
  const [novoDescanso, setNovoDescanso] = useState("60");

  function abrirModalCriar(treinoKey: string) {
    setModalTreinoKey(treinoKey);
    setModalAberto(true);
  }
  function fecharModalCriar() {
    setModalAberto(false);
    setNovoNome("");
    setNovoGrupo("");
    setNovoSeries("3");
    setNovoReps("10-12");
    setNovoDescanso("60");
  }
  function confirmarCriar() {
    const nome = novoNome.trim();
    if (!nome || !modalTreinoKey) return;
    updateExs(modalTreinoKey, (exs) => [
      ...exs,
      {
        id: `ex-${crypto.randomUUID()}`,
        ordem: proximaOrdem(exs),
        nome,
        grupo: novoGrupo.trim(),
        series: Number(novoSeries.replace(/\D/g, "")) || 3,
        reps: novoReps.trim() || "10-12",
        descansoSeg: Number(novoDescanso.replace(/\D/g, "")) || 60,
        video: { origem: "vazio" },
      },
    ]);
    fecharModalCriar();
  }

  // ---- biblioteca ----
  const buscaNorm = busca.trim().toLowerCase();
  const resultados = exercicioLibrary.filter((m) => {
    if (!buscaNorm) return true;
    return (
      m.nome.toLowerCase().includes(buscaNorm) || m.grupo.toLowerCase().includes(buscaNorm)
    );
  });
  function adicionarDaBiblioteca(treinoKey: string, modeloId: string) {
    const modelo = exercicioLibrary.find((m) => m.id === modeloId);
    if (!modelo) return;
    updateExs(treinoKey, (exs) => [
      ...exs,
      {
        id: `ex-${crypto.randomUUID()}`,
        ordem: proximaOrdem(exs),
        nome: modelo.nome,
        grupo: modelo.grupo,
        series: 3,
        reps: "10-12",
        descansoSeg: 60,
        video: { origem: "biblioteca", url: modelo.videoUrl },
      },
    ]);
  }

  // ---- exercícios (por treino) ----
  function removerPorId(treinoKey: string, exId: string) {
    updateExs(treinoKey, (exs) => exs.filter((e) => e.id !== exId));
  }
  function duplicar(treinoKey: string, exId: string) {
    updateExs(treinoKey, (exs) => {
      const idx = exs.findIndex((e) => e.id === exId);
      if (idx === -1) return exs;
      const copia: Exercicio = { ...exs[idx], id: `ex-${crypto.randomUUID()}`, ordem: proximaOrdem(exs) };
      const novo = [...exs];
      novo.splice(idx + 1, 0, copia);
      return novo;
    });
  }
  function definirOrigemVideo(treinoKey: string, exId: string, origem: VideoOrigem) {
    updateExs(treinoKey, (exs) =>
      exs.map((e) =>
        e.id === exId
          ? {
              ...e,
              video:
                origem === "biblioteca"
                  ? {
                      origem,
                      url: exercicioLibrary.find((m) => m.nome === e.nome)?.videoUrl ?? e.video.url,
                    }
                  : { origem },
            }
          : e
      )
    );
  }
  function atualizarCampo(
    treinoKey: string,
    exId: string,
    campo: "series" | "reps" | "descansoSeg",
    valor: string
  ) {
    updateExs(treinoKey, (exs) =>
      exs.map((e) => {
        if (e.id !== exId) return e;
        if (campo === "reps") return { ...e, reps: valor };
        const num = Number(valor.replace(/\D/g, "")) || 0;
        return { ...e, [campo]: num };
      })
    );
  }
  function atualizarExercicio(treinoKey: string, exId: string, patch: Partial<Exercicio>) {
    updateExs(treinoKey, (exs) => exs.map((e) => (e.id === exId ? { ...e, ...patch } : e)));
  }
  function detalharSeries(treinoKey: string, exId: string) {
    updateExs(treinoKey, (exs) =>
      exs.map((e) => {
        if (e.id !== exId || e.seriesDetalhe) return e;
        const n = Math.max(1, e.series);
        const seriesDetalhe: SerieSpec[] = Array.from({ length: n }, (_, i) => ({
          rotulo: i === 0 && n > 1 ? "Aquecimento" : "Válida",
          reps: e.reps,
          descansoSeg: e.descansoSeg,
        }));
        return { ...e, seriesDetalhe };
      })
    );
  }
  function removerDetalhe(treinoKey: string, exId: string) {
    updateExs(treinoKey, (exs) =>
      exs.map((e) => {
        if (e.id !== exId) return e;
        const { seriesDetalhe: _omit, ...rest } = e;
        return rest;
      })
    );
  }
  function atualizarSerie(treinoKey: string, exId: string, idx: number, patch: Partial<SerieSpec>) {
    updateExs(treinoKey, (exs) =>
      exs.map((e) =>
        e.id === exId && e.seriesDetalhe
          ? {
              ...e,
              seriesDetalhe: e.seriesDetalhe.map((sp, i) => (i === idx ? { ...sp, ...patch } : sp)),
            }
          : e
      )
    );
  }
  function addSerie(treinoKey: string, exId: string) {
    updateExs(treinoKey, (exs) =>
      exs.map((e) => {
        if (e.id !== exId || !e.seriesDetalhe) return e;
        const ult = e.seriesDetalhe[e.seriesDetalhe.length - 1];
        const seriesDetalhe = [
          ...e.seriesDetalhe,
          { rotulo: "Válida", reps: ult?.reps ?? e.reps, descansoSeg: ult?.descansoSeg ?? e.descansoSeg },
        ];
        return { ...e, seriesDetalhe, series: seriesDetalhe.length };
      })
    );
  }
  function removerSerie(treinoKey: string, exId: string, idx: number) {
    updateExs(treinoKey, (exs) =>
      exs.map((e) => {
        if (e.id !== exId || !e.seriesDetalhe) return e;
        const seriesDetalhe = e.seriesDetalhe.filter((_, i) => i !== idx);
        if (seriesDetalhe.length === 0) {
          const { seriesDetalhe: _omit, ...rest } = e;
          return rest;
        }
        return { ...e, seriesDetalhe, series: seriesDetalhe.length };
      })
    );
  }

  const totalExercicios = treinos.reduce((s, t) => s + t.exercicios.length, 0);

  // ---- render de um exercício (dentro de um treino) ----
  function renderExercicio(
    treinoKey: string,
    ex: Exercicio,
    i: number,
    handle: string
  ) {
    return (
      <Card className={styles.exCard}>
        <CardBody className={styles.exBody}>
          <div className={styles.exTop}>
            <span className={`${handle} ${styles.handle}`} aria-hidden>
              <i className="ti ti-grip-vertical" />
            </span>
            <span className={styles.exNum}>{i + 1}</span>
            <div className={styles.exInfo}>
              <span className={styles.exName}>{ex.nome}</span>
              <span className={`mono-label ${styles.exGroup}`}>{ex.grupo}</span>
            </div>
            <KebabMenu
              items={[
                { label: "Substituir vídeo", icon: "video", onClick: () => definirOrigemVideo(treinoKey, ex.id, "vazio") },
                { label: "Duplicar", icon: "copy", onClick: () => duplicar(treinoKey, ex.id) },
                {
                  label: "Remover",
                  icon: "trash",
                  danger: true,
                  separatorBefore: true,
                  onClick: () => removerPorId(treinoKey, ex.id),
                },
              ]}
            />
          </div>

          {!ex.seriesDetalhe && (
            <div className={styles.exFields}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Séries</span>
                <Input value={String(ex.series)} inputMode="numeric" onChange={(e) => atualizarCampo(treinoKey, ex.id, "series", e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Reps</span>
                <Input value={ex.reps} placeholder="8-12" onChange={(e) => atualizarCampo(treinoKey, ex.id, "reps", e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Descanso (s)</span>
                <Input value={String(ex.descansoSeg)} inputMode="numeric" onChange={(e) => atualizarCampo(treinoKey, ex.id, "descansoSeg", e.target.value)} />
              </label>
            </div>
          )}

          {ex.seriesDetalhe ? (
            <div className={styles.seriesDetail}>
              <div className={styles.seriesDetailHead}>
                <span className="mono-label">Séries detalhadas · {ex.seriesDetalhe.length}</span>
                <Button variant="ghost" size="sm" icon="arrow-back-up" onClick={() => removerDetalhe(treinoKey, ex.id)}>
                  Voltar pro simples
                </Button>
              </div>
              {ex.seriesDetalhe.map((sp, si) => (
                <div key={si} className={styles.serieItem}>
                  <div className={styles.serieRow}>
                    <span className={styles.serieNum}>{si + 1}</span>
                    <Input value={sp.rotulo} placeholder="Aquecimento / Válida" onChange={(e) => atualizarSerie(treinoKey, ex.id, si, { rotulo: e.target.value })} />
                    <Input value={sp.reps} placeholder="reps" onChange={(e) => atualizarSerie(treinoKey, ex.id, si, { reps: e.target.value })} />
                    <Input value={String(sp.descansoSeg)} inputMode="numeric" placeholder="desc (s)" onChange={(e) => atualizarSerie(treinoKey, ex.id, si, { descansoSeg: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                    <button type="button" className={styles.serieDel} aria-label="Remover série" onClick={() => removerSerie(treinoKey, ex.id, si)}>
                      <i className="ti ti-trash" aria-hidden />
                    </button>
                  </div>
                  <Input value={sp.obs ?? ""} placeholder="orientação desta série (opcional)" onChange={(e) => atualizarSerie(treinoKey, ex.id, si, { obs: e.target.value })} />
                </div>
              ))}
              <Button variant="outline" size="sm" icon="plus" onClick={() => addSerie(treinoKey, ex.id)}>
                Adicionar série
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" icon="list-numbers" onClick={() => detalharSeries(treinoKey, ex.id)}>
              Detalhar séries (aquecimento, válidas…)
            </Button>
          )}

          <div className={styles.exVideo}>
            {ex.video.origem === "biblioteca" && <Chip icon="books">Vídeo da biblioteca</Chip>}
            {ex.video.origem === "proprio" && (
              <StatusBadge variant="ok" icon="video" noDot>
                Seu vídeo
              </StatusBadge>
            )}
            {ex.video.origem === "vazio" && (
              <div className={styles.videoEmpty}>
                <span className={styles.videoEmptyLabel}>
                  <i className="ti ti-video-off" aria-hidden /> Sem vídeo
                </span>
                <div className={styles.videoOpts}>
                  <Button variant="outline" size="sm" icon="upload" onClick={() => definirOrigemVideo(treinoKey, ex.id, "proprio")}>
                    Gravar/enviar
                  </Button>
                  <Button variant="outline" size="sm" icon="link" onClick={() => definirOrigemVideo(treinoKey, ex.id, "proprio")}>
                    Colar link YouTube/IG
                  </Button>
                  <Button variant="outline" size="sm" icon="books" onClick={() => definirOrigemVideo(treinoKey, ex.id, "biblioteca")}>
                    Usar o da biblioteca
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Textarea
            className={styles.exObs}
            label="Observações / como executar"
            placeholder="Cadência, amplitude, postura, dicas de execução…"
            rows={2}
            value={ex.observacoes ?? ""}
            onChange={(e) => atualizarExercicio(treinoKey, ex.id, { observacoes: e.target.value })}
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow={`Treino · ${nomeAluno || "Aluno"}`}
        title={
          <span className={styles.titleRow}>
            Treinos
            <StatusBadge variant="off" icon="pencil" noDot>
              Rascunho
            </StatusBadge>
          </span>
        }
        subtitle={`${treinos.length} treino${treinos.length === 1 ? "" : "s"} · ${totalExercicios} exercício${totalExercicios === 1 ? "" : "s"}`}
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
        <p role="alert" style={{ color: "var(--color-text-danger)", fontSize: 14, margin: 0 }}>
          {erroSalvar}
        </p>
      )}

      {/* Biblioteca de exercícios (adiciona no treino selecionado) */}
      <Card>
        <CardBody className={styles.libBody}>
          <div className={styles.libHead}>
            <div className={styles.libHeadText}>
              <span className="mono-label">Biblioteca de exercícios</span>
              <p className={styles.libHint}>
                {alvo
                  ? "Busque e adicione ao treino selecionado. Ajusta séries, reps e vídeo depois."
                  : "Crie um treino abaixo para começar a adicionar exercícios."}
              </p>
            </div>
            <Button variant="outline" size="sm" icon="sparkles" disabled={!alvo} onClick={() => alvo && abrirModalCriar(alvo.key)}>
              Criar exercício
            </Button>
          </div>

          {treinos.length > 1 && alvo && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="mono-label">Adicionar em</span>
              <Segmented
                ariaLabel="Treino que recebe os exercícios da biblioteca"
                value={alvo.key}
                onChange={(k) => setAlvoKey(k)}
                options={treinos.map((t) => ({ label: t.nome || "Treino", value: t.key }))}
              />
            </div>
          )}

          <Input icon="search" placeholder="Buscar exercício na biblioteca…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <div className={styles.libResults}>
            {!alvo ? (
              <p className={styles.libEmpty}>Adicione um treino para habilitar a biblioteca.</p>
            ) : resultados.length === 0 ? (
              <p className={styles.libEmpty}>Nenhum exercício encontrado para “{busca}”.</p>
            ) : (
              resultados.map((m) => {
                const jaAdicionado = alvo.exercicios.some((e) => e.nome.toLowerCase() === m.nome.toLowerCase());
                return (
                  <div key={m.id} className={styles.libItem}>
                    <div className={styles.libItemInfo}>
                      <span className={styles.libItemName}>{m.nome}</span>
                      <span className={`mono-label ${styles.libItemGroup}`}>{m.grupo}</span>
                    </div>
                    <Button variant={jaAdicionado ? "ghost" : "outline"} size="sm" icon={jaAdicionado ? "check" : "plus"} onClick={() => adicionarDaBiblioteca(alvo.key, m.id)}>
                      {jaAdicionado ? "Adicionar +1" : "Adicionar"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </CardBody>
      </Card>

      {/* Split: um card por treino */}
      {treinos.length === 0 ? (
        <EmptyState
          icon="barbell"
          title="Nenhum treino ainda"
          description="Crie o primeiro treino do split deste aluno (Treino A, B, C…)."
          action={
            <Button variant="primary" icon="plus" onClick={adicionarTreino}>
              Adicionar treino
            </Button>
          }
        />
      ) : (
        treinos.map((treino) => (
          <Card key={treino.key} style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                value={treino.nome}
                onChange={(e) => renomearTreino(treino.key, e.target.value)}
                aria-label="Nome do treino"
                placeholder="Nome do treino"
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontWeight: 700,
                  fontSize: 16,
                  color: "var(--color-text-primary)",
                  background: "var(--color-background-secondary)",
                  border: "1px solid var(--color-border-secondary)",
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              />
              <span className="mono-label" style={{ whiteSpace: "nowrap", color: "var(--color-text-secondary)" }}>
                {treino.exercicios.length} exerc.
              </span>
              <KebabMenu
                items={[
                  { label: "Remover treino", icon: "trash", danger: true, onClick: () => removerTreino(treino.key) },
                ]}
              />
            </div>

            {treino.exercicios.length === 0 ? (
              <EmptyState compact icon="barbell" title="Treino vazio" description="Selecione este treino na biblioteca acima ou crie um exercício." />
            ) : (
              <SortableList
                items={treino.exercicios}
                getKey={(e) => e.id}
                onReorder={(next) => updateExs(treino.key, () => next)}
                renderItem={(ex, i, handle) => renderExercicio(treino.key, ex, i, handle)}
              />
            )}

            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              <Button variant="outline" size="sm" icon="plus" onClick={() => setAlvoKey(treino.key)} disabled={alvo?.key === treino.key}>
                {alvo?.key === treino.key ? "Recebendo da biblioteca" : "Adicionar da biblioteca aqui"}
              </Button>
              <Button variant="ghost" size="sm" icon="sparkles" onClick={() => abrirModalCriar(treino.key)}>
                Criar exercício
              </Button>
            </div>
          </Card>
        ))
      )}

      {/* Rodapé: adicionar treino */}
      {treinos.length > 0 && (
        <div className={styles.footer}>
          <Button variant="outline" icon="plus" onClick={adicionarTreino}>
            Adicionar treino
          </Button>
          <Button variant="ghost" icon="bookmark">
            Salvar como modelo
          </Button>
        </div>
      )}

      <Modal
        open={modalAberto}
        onClose={fecharModalCriar}
        title="Criar exercício"
        footer={
          <>
            <Button variant="ghost" onClick={fecharModalCriar}>
              Cancelar
            </Button>
            <Button icon="plus" onClick={confirmarCriar} disabled={!novoNome.trim()}>
              Adicionar
            </Button>
          </>
        }
      >
        <div className={styles.modalForm}>
          {(() => {
            const t = treinos.find((x) => x.key === modalTreinoKey);
            return t ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-secondary)" }}>
                <i className="ti ti-arrow-down-right" aria-hidden /> Adiciona em: <strong>{t.nome}</strong>
              </p>
            ) : null;
          })()}
          <Input label="Nome do exercício" placeholder="Ex.: Crucifixo inclinado" autoFocus value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
          <Input label="Grupo muscular" hint="Opcional" placeholder="Ex.: Peito" value={novoGrupo} onChange={(e) => setNovoGrupo(e.target.value)} />
          <div className={styles.modalFields}>
            <Input label="Séries" inputMode="numeric" value={novoSeries} onChange={(e) => setNovoSeries(e.target.value)} />
            <Input label="Reps" placeholder="10-12" value={novoReps} onChange={(e) => setNovoReps(e.target.value)} />
            <Input label="Descanso (s)" inputMode="numeric" value={novoDescanso} onChange={(e) => setNovoDescanso(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

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
  Chip,
  Textarea,
  Modal,
} from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { getTreino, exercicioLibrary } from "@/lib/data";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { fetchTreinoByAluno, saveTreino } from "@/lib/db";
import type { Exercicio, SerieSpec, VideoOrigem } from "@/lib/types";
import styles from "./treino.module.css";

export default function TreinoBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { nome: nomeAluno } = useAlunoResolvido(id);

  // Sem Supabase: mock. Com Supabase: carrega no useEffect abaixo.
  const treinoInicial = supabaseEnabled ? undefined : getTreino(id);

  const [treinoId, setTreinoId] = useState<string | undefined>(
    treinoInicial?.id
  );
  const [nomeTreino, setNomeTreino] = useState(
    treinoInicial?.nome ?? "Novo treino"
  );
  const [exercicios, setExercicios] = useState<Exercicio[]>(
    () => (treinoInicial?.exercicios ?? []).map((e) => ({ ...e }))
  );
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  // Com Supabase: carrega o treino existente do aluno (se houver).
  useEffect(() => {
    if (!supabaseEnabled) return;
    let vivo = true;
    fetchTreinoByAluno(id)
      .then((t) => {
        if (!vivo || !t) return;
        setTreinoId(t.id);
        setNomeTreino(t.nome);
        setExercicios(t.exercicios.map((e) => ({ ...e })));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [id]);

  async function handleEnviar() {
    if (!supabaseEnabled) return; // stub no protótipo
    if (exercicios.length === 0) {
      setErroSalvar("Adicione ao menos um exercício.");
      return;
    }
    if (exercicios.some((e) => !e.nome.trim())) {
      setErroSalvar("Todos os exercícios precisam de um nome.");
      return;
    }
    setSalvando(true);
    setErroSalvar(null);
    try {
      const saved = await saveTreino(id, {
        id: treinoId,
        nome: nomeTreino,
        rascunho: false,
        exercicios,
      });
      setTreinoId(saved.id);
      router.push(`/alunos/${id}`);
      router.refresh(); // invalida o cache RSC da ficha pra mostrar o treino novo
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : "Falha ao salvar.");
      setSalvando(false);
    }
  }

  const [novoCount, setNovoCount] = useState(0);
  const [modalAberto, setModalAberto] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoGrupo, setNovoGrupo] = useState("");
  const [novoSeries, setNovoSeries] = useState("3");
  const [novoReps, setNovoReps] = useState("10-12");
  const [novoDescanso, setNovoDescanso] = useState("60");

  const idsNaLista = new Set(
    exercicios.map((e) => e.nome.toLowerCase())
  );

  const buscaNorm = busca.trim().toLowerCase();
  const resultados = exercicioLibrary.filter((m) => {
    if (!buscaNorm) return true;
    return (
      m.nome.toLowerCase().includes(buscaNorm) ||
      m.grupo.toLowerCase().includes(buscaNorm)
    );
  });

  function adicionarDaBiblioteca(modeloId: string) {
    const modelo = exercicioLibrary.find((m) => m.id === modeloId);
    if (!modelo) return;
    const proximaOrdem =
      exercicios.reduce((max, e) => Math.max(max, e.ordem), 0) + 1;
    const novo: Exercicio = {
      id: `ex-${crypto.randomUUID()}`,
      ordem: proximaOrdem,
      nome: modelo.nome,
      grupo: modelo.grupo,
      series: 3,
      reps: "10-12",
      descansoSeg: 60,
      video: { origem: "biblioteca", url: modelo.videoUrl },
    };
    setExercicios((prev) => [...prev, novo]);
  }

  function abrirModalCriar() {
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
    if (!nome) return;
    const proximaOrdem =
      exercicios.reduce((max, e) => Math.max(max, e.ordem), 0) + 1;
    const novo: Exercicio = {
      id: `ex-${crypto.randomUUID()}`,
      ordem: proximaOrdem,
      nome,
      grupo: novoGrupo.trim(),
      series: Number(novoSeries.replace(/\D/g, "")) || 3,
      reps: novoReps.trim() || "10-12",
      descansoSeg: Number(novoDescanso.replace(/\D/g, "")) || 60,
      video: { origem: "vazio" },
    };
    setNovoCount((n) => n + 1);
    setExercicios((prev) => [...prev, novo]);
    fecharModalCriar();
  }

  function removerPorId(exId: string) {
    setExercicios((prev) => prev.filter((e) => e.id !== exId));
  }

  function duplicar(exId: string) {
    setExercicios((prev) => {
      const idx = prev.findIndex((e) => e.id === exId);
      if (idx === -1) return prev;
      const proximaOrdem =
        prev.reduce((max, e) => Math.max(max, e.ordem), 0) + 1;
      const copia: Exercicio = {
        ...prev[idx],
        id: `ex-${crypto.randomUUID()}`,
        ordem: proximaOrdem,
      };
      const novo = [...prev];
      novo.splice(idx + 1, 0, copia);
      return novo;
    });
  }

  function definirOrigemVideo(exId: string, origem: VideoOrigem) {
    setExercicios((prev) =>
      prev.map((e) =>
        e.id === exId
          ? {
              ...e,
              video:
                origem === "biblioteca"
                  ? {
                      origem,
                      url:
                        exercicioLibrary.find((m) => m.nome === e.nome)
                          ?.videoUrl ?? e.video.url,
                    }
                  : { origem },
            }
          : e
      )
    );
  }

  function atualizarCampo(
    exId: string,
    campo: "series" | "reps" | "descansoSeg",
    valor: string
  ) {
    setExercicios((prev) =>
      prev.map((e) => {
        if (e.id !== exId) return e;
        if (campo === "reps") return { ...e, reps: valor };
        const num = Number(valor.replace(/\D/g, "")) || 0;
        return { ...e, [campo]: num };
      })
    );
  }

  function atualizarExercicio(exId: string, patch: Partial<Exercicio>) {
    setExercicios((prev) =>
      prev.map((e) => (e.id === exId ? { ...e, ...patch } : e))
    );
  }

  // ---- Séries detalhadas (aquecimento, válidas, top-set…) ----
  function detalharSeries(exId: string) {
    setExercicios((prev) =>
      prev.map((e) => {
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

  function removerDetalhe(exId: string) {
    setExercicios((prev) =>
      prev.map((e) => {
        if (e.id !== exId) return e;
        const { seriesDetalhe: _omit, ...rest } = e;
        return rest;
      })
    );
  }

  function atualizarSerie(exId: string, idx: number, patch: Partial<SerieSpec>) {
    setExercicios((prev) =>
      prev.map((e) =>
        e.id === exId && e.seriesDetalhe
          ? {
              ...e,
              seriesDetalhe: e.seriesDetalhe.map((sp, i) =>
                i === idx ? { ...sp, ...patch } : sp
              ),
            }
          : e
      )
    );
  }

  function addSerie(exId: string) {
    setExercicios((prev) =>
      prev.map((e) => {
        if (e.id !== exId || !e.seriesDetalhe) return e;
        const ult = e.seriesDetalhe[e.seriesDetalhe.length - 1];
        const seriesDetalhe = [
          ...e.seriesDetalhe,
          {
            rotulo: "Válida",
            reps: ult?.reps ?? e.reps,
            descansoSeg: ult?.descansoSeg ?? e.descansoSeg,
          },
        ];
        return { ...e, seriesDetalhe, series: seriesDetalhe.length };
      })
    );
  }

  function removerSerie(exId: string, idx: number) {
    setExercicios((prev) =>
      prev.map((e) => {
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

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow={`Treino · ${nomeAluno || "Aluno"}`}
        title={
          <div className={styles.titleRow}>
            <input
              className={styles.titleInput}
              value={nomeTreino}
              onChange={(e) => setNomeTreino(e.target.value)}
              aria-label="Nome do treino"
              placeholder="Nome do treino"
            />
            <StatusBadge variant="off" icon="pencil" noDot>
              Rascunho
            </StatusBadge>
          </div>
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
          style={{ color: "var(--color-danger)", fontSize: 14, margin: 0 }}
        >
          {erroSalvar}
        </p>
      )}

      <Card>
        <CardBody className={styles.libBody}>
          <div className={styles.libHead}>
            <div className={styles.libHeadText}>
              <span className="mono-label">Biblioteca de exercícios</span>
              <p className={styles.libHint}>
                Busque e adicione exercícios prontos. Você ajusta séries, reps e
                vídeo depois.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              icon="sparkles"
              onClick={abrirModalCriar}
            >
              Criar exercício
            </Button>
          </div>
          <Input
            icon="search"
            placeholder="Buscar exercício na biblioteca…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <div className={styles.libResults}>
            {resultados.length === 0 ? (
              <p className={styles.libEmpty}>
                Nenhum exercício encontrado para “{busca}”.
              </p>
            ) : (
              resultados.map((m) => {
                const jaAdicionado = idsNaLista.has(m.nome.toLowerCase());
                return (
                  <div key={m.id} className={styles.libItem}>
                    <div className={styles.libItemInfo}>
                      <span className={styles.libItemName}>{m.nome}</span>
                      <span className={`mono-label ${styles.libItemGroup}`}>
                        {m.grupo}
                      </span>
                    </div>
                    <Button
                      variant={jaAdicionado ? "ghost" : "outline"}
                      size="sm"
                      icon={jaAdicionado ? "check" : "plus"}
                      onClick={() => adicionarDaBiblioteca(m.id)}
                    >
                      {jaAdicionado ? "Adicionar +1" : "Adicionar"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </CardBody>
      </Card>

      <div className={styles.listHead}>
        <span className="mono-label">
          Exercícios do treino · {exercicios.length}
        </span>
      </div>

      {exercicios.length === 0 ? (
        <EmptyState
          icon="barbell"
          title="Monte o treino"
          description="Adicione exercícios da biblioteca acima."
        />
      ) : (
        <SortableList
          items={exercicios}
          getKey={(e) => e.id}
          onReorder={setExercicios}
          renderItem={(ex, i, handle) => (
            <Card className={styles.exCard}>
              <CardBody className={styles.exBody}>
                <div className={styles.exTop}>
                  <span className={`${handle} ${styles.handle}`} aria-hidden>
                    <i className="ti ti-grip-vertical" />
                  </span>
                  <span className={styles.exNum}>{i + 1}</span>
                  <div className={styles.exInfo}>
                    <span className={styles.exName}>{ex.nome}</span>
                    <span className={`mono-label ${styles.exGroup}`}>
                      {ex.grupo}
                    </span>
                  </div>
                  <KebabMenu
                    items={[
                      {
                        label: "Substituir vídeo",
                        icon: "video",
                        onClick: () => definirOrigemVideo(ex.id, "vazio"),
                      },
                      {
                        label: "Duplicar",
                        icon: "copy",
                        onClick: () => duplicar(ex.id),
                      },
                      {
                        label: "Remover",
                        icon: "trash",
                        danger: true,
                        separatorBefore: true,
                        onClick: () => removerPorId(ex.id),
                      },
                    ]}
                  />
                </div>

                {!ex.seriesDetalhe && (
                  <div className={styles.exFields}>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Séries</span>
                      <Input
                        value={String(ex.series)}
                        inputMode="numeric"
                        onChange={(e) =>
                          atualizarCampo(ex.id, "series", e.target.value)
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Reps</span>
                      <Input
                        value={ex.reps}
                        placeholder="8-12"
                        onChange={(e) =>
                          atualizarCampo(ex.id, "reps", e.target.value)
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Descanso (s)</span>
                      <Input
                        value={String(ex.descansoSeg)}
                        inputMode="numeric"
                        onChange={(e) =>
                          atualizarCampo(ex.id, "descansoSeg", e.target.value)
                        }
                      />
                    </label>
                  </div>
                )}

                {ex.seriesDetalhe ? (
                  <div className={styles.seriesDetail}>
                    <div className={styles.seriesDetailHead}>
                      <span className="mono-label">
                        Séries detalhadas · {ex.seriesDetalhe.length}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="arrow-back-up"
                        onClick={() => removerDetalhe(ex.id)}
                      >
                        Voltar pro simples
                      </Button>
                    </div>
                    {ex.seriesDetalhe.map((sp, si) => (
                      <div key={si} className={styles.serieItem}>
                        <div className={styles.serieRow}>
                          <span className={styles.serieNum}>{si + 1}</span>
                          <Input
                            value={sp.rotulo}
                            placeholder="Aquecimento / Válida"
                            onChange={(e) =>
                              atualizarSerie(ex.id, si, {
                                rotulo: e.target.value,
                              })
                            }
                          />
                          <Input
                            value={sp.reps}
                            placeholder="reps"
                            onChange={(e) =>
                              atualizarSerie(ex.id, si, { reps: e.target.value })
                            }
                          />
                          <Input
                            value={String(sp.descansoSeg)}
                            inputMode="numeric"
                            placeholder="desc (s)"
                            onChange={(e) =>
                              atualizarSerie(ex.id, si, {
                                descansoSeg:
                                  Number(e.target.value.replace(/\D/g, "")) || 0,
                              })
                            }
                          />
                          <button
                            type="button"
                            className={styles.serieDel}
                            aria-label="Remover série"
                            onClick={() => removerSerie(ex.id, si)}
                          >
                            <i className="ti ti-trash" aria-hidden />
                          </button>
                        </div>
                        <Input
                          value={sp.obs ?? ""}
                          placeholder="orientação desta série (opcional)"
                          onChange={(e) =>
                            atualizarSerie(ex.id, si, { obs: e.target.value })
                          }
                        />
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      icon="plus"
                      onClick={() => addSerie(ex.id)}
                    >
                      Adicionar série
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="list-numbers"
                    onClick={() => detalharSeries(ex.id)}
                  >
                    Detalhar séries (aquecimento, válidas…)
                  </Button>
                )}

                <div className={styles.exVideo}>
                  {ex.video.origem === "biblioteca" && (
                    <Chip icon="books">Vídeo da biblioteca</Chip>
                  )}
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
                        <Button
                          variant="outline"
                          size="sm"
                          icon="upload"
                          onClick={() =>
                            definirOrigemVideo(ex.id, "proprio")
                          }
                        >
                          Gravar/enviar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          icon="link"
                          onClick={() =>
                            definirOrigemVideo(ex.id, "proprio")
                          }
                        >
                          Colar link YouTube/IG
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          icon="books"
                          onClick={() =>
                            definirOrigemVideo(ex.id, "biblioteca")
                          }
                        >
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
                  onChange={(e) =>
                    atualizarExercicio(ex.id, { observacoes: e.target.value })
                  }
                />
              </CardBody>
            </Card>
          )}
        />
      )}

      <div className={styles.footer}>
        <Button variant="outline" icon="plus" onClick={abrirModalCriar}>
          Criar exercício do zero
        </Button>
        <Button variant="ghost" icon="bookmark">
          Salvar como modelo
        </Button>
      </div>

      <Modal
        open={modalAberto}
        onClose={fecharModalCriar}
        title="Criar exercício"
        footer={
          <>
            <Button variant="ghost" onClick={fecharModalCriar}>
              Cancelar
            </Button>
            <Button
              icon="plus"
              onClick={confirmarCriar}
              disabled={!novoNome.trim()}
            >
              Adicionar
            </Button>
          </>
        }
      >
        <div className={styles.modalForm}>
          <Input
            label="Nome do exercício"
            placeholder="Ex.: Crucifixo inclinado"
            autoFocus
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
          />
          <Input
            label="Grupo muscular"
            hint="Opcional"
            placeholder="Ex.: Peito"
            value={novoGrupo}
            onChange={(e) => setNovoGrupo(e.target.value)}
          />
          <div className={styles.modalFields}>
            <Input
              label="Séries"
              inputMode="numeric"
              value={novoSeries}
              onChange={(e) => setNovoSeries(e.target.value)}
            />
            <Input
              label="Reps"
              placeholder="10-12"
              value={novoReps}
              onChange={(e) => setNovoReps(e.target.value)}
            />
            <Input
              label="Descanso (s)"
              inputMode="numeric"
              value={novoDescanso}
              onChange={(e) => setNovoDescanso(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

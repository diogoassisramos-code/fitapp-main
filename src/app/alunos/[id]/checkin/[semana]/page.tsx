"use client";

import { use, useState } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  MetricCard,
  StatusBadge,
  Textarea,
  PointsChart,
  Modal,
  EmptyState,
} from "@/components/ui";
import { getAluno, getCheckin, getCheckins } from "@/lib/data";
import { dataLonga } from "@/lib/format";
import type { FotoCheckin } from "@/lib/types";
import styles from "./checkin.module.css";

export default function RevisaoCheckinPage({
  params,
}: {
  params: Promise<{ id: string; semana: string }>;
}) {
  const { id, semana } = use(params);
  const semanaNum = Number(semana);
  const checkin = getCheckin(id, semanaNum);
  const aluno = getAluno(id);

  if (!checkin || !aluno) notFound();

  const [resposta, setResposta] = useState("");
  const [fotoAtiva, setFotoAtiva] = useState<FotoCheckin | null>(null);
  const [comparando, setComparando] = useState(false);

  const historico = getCheckins(id);
  const anterior = historico.find((c) => c.semana === semanaNum - 1);
  const deltaPeso =
    anterior !== undefined
      ? Number((checkin.peso - anterior.peso).toFixed(1))
      : undefined;

  const pesoData = historico.map((c, i, arr) => ({
    date: "S" + c.semana,
    total: c.peso,
    change: i === 0 ? 0 : c.peso - arr[i - 1].peso,
  }));

  const feedbackItens: { label: string; nota: number; icon: string }[] = [
    { label: "Energia", nota: checkin.avaliacoes.energia, icon: "bolt" },
    { label: "Sono", nota: checkin.avaliacoes.sono, icon: "moon" },
    { label: "Dieta", nota: checkin.avaliacoes.dieta, icon: "salad" },
  ];

  const fotos = checkin.fotos;
  const fotosSemana1 = historico.find((c) => c.semana === 1)?.fotos ?? [];

  // Ângulos presentes em qualquer das duas semanas, preservando ordem.
  const angulosComparacao: string[] = [];
  for (const f of [...fotosSemana1, ...fotos]) {
    if (!angulosComparacao.includes(f.angulo)) angulosComparacao.push(f.angulo);
  }

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Revisão de check-in"
        title={`${aluno.nome} · Check-in`}
        subtitle={
          <StatusBadge variant="new" icon="calendar-week" noDot>
            {`Semana ${checkin.semana} · enviado ${dataLonga(checkin.enviadoEm)}`}
          </StatusBadge>
        }
        actions={
          <Button variant="ghost" icon="arrow-left" href={`/alunos/${id}`}>
            Voltar à ficha
          </Button>
        }
      />

      <div className={styles.metrics}>
        <MetricCard
          label="Peso"
          value={`${checkin.peso} kg`}
          icon="weight"
          delta={
            deltaPeso !== undefined
              ? {
                  value: `${deltaPeso > 0 ? "+" : ""}${deltaPeso} kg`,
                  dir: deltaPeso < 0 ? "down" : deltaPeso > 0 ? "up" : "flat",
                }
              : undefined
          }
          sub={anterior ? `vs. S${anterior.semana}` : "primeira semana"}
        />
        <MetricCard
          label="Treinos"
          value={`${checkin.treinosFeitos}/${checkin.treinosTotais}`}
          icon="barbell"
          sub="treinos realizados"
        />
        <MetricCard
          label="Dieta"
          value={`${checkin.avaliacoes.dieta}/5`}
          icon="salad"
          sub="aderência relatada"
        />
      </div>

      <PointsChart
        title="Evolução do peso"
        data={pesoData}
        format="decimal1"
        unit=" kg"
      />

      <Card>
        <CardHeader
          title="Fotos da semana"
          action={
            fotos.length > 0 && semanaNum !== 1 ? (
              <Button
                variant="outline"
                size="sm"
                icon="versions"
                onClick={() => setComparando(true)}
              >
                Comparar com a semana 1
              </Button>
            ) : undefined
          }
        />
        <CardBody>
          {fotos.length === 0 ? (
            <EmptyState
              compact
              icon="photo-off"
              title="O aluno não enviou fotos nesta semana"
            />
          ) : (
            <div className={styles.fotos}>
              {fotos.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={styles.foto}
                  onClick={() => setFotoAtiva(f)}
                >
                  <span className={styles.fotoThumb}>
                    <img src={f.url} alt={f.angulo} loading="lazy" />
                  </span>
                  <span className={styles.fotoLabel}>{f.angulo}</span>
                </button>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={fotoAtiva !== null}
        onClose={() => setFotoAtiva(null)}
        title={fotoAtiva ? `${fotoAtiva.angulo} · Semana ${checkin.semana}` : ""}
      >
        {fotoAtiva && (
          <div className={styles.lightbox}>
            <img
              className={styles.lightboxImg}
              src={fotoAtiva.url}
              alt={fotoAtiva.angulo}
            />
            <p className={styles.lightboxMeta}>
              {fotoAtiva.angulo} · Semana {checkin.semana} ·{" "}
              {dataLonga(checkin.enviadoEm)}
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={comparando}
        onClose={() => setComparando(false)}
        title={`Comparação · Semana 1 vs. Semana ${checkin.semana}`}
        size="lg"
      >
        {fotosSemana1.length === 0 ? (
          <EmptyState
            compact
            icon="photo-off"
            title="Sem fotos na semana 1"
            description="A semana 1 não tem fotos enviadas para comparar."
          />
        ) : (
          <div className={styles.comparar}>
            {angulosComparacao.map((angulo) => {
              const a = fotosSemana1.find((f) => f.angulo === angulo);
              const b = fotos.find((f) => f.angulo === angulo);
              return (
                <div key={angulo} className={styles.compararLinha}>
                  <span className={styles.compararAngulo}>{angulo}</span>
                  <div className={styles.compararPar}>
                    <figure className={styles.compararItem}>
                      <span className={styles.compararLabel}>Semana 1</span>
                      {a ? (
                        <img src={a.url} alt={`${angulo} · Semana 1`} />
                      ) : (
                        <span className={styles.compararVazio}>—</span>
                      )}
                    </figure>
                    <figure className={styles.compararItem}>
                      <span className={styles.compararLabel}>
                        Semana {checkin.semana}
                      </span>
                      {b ? (
                        <img
                          src={b.url}
                          alt={`${angulo} · Semana ${checkin.semana}`}
                        />
                      ) : (
                        <span className={styles.compararVazio}>—</span>
                      )}
                    </figure>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <Card>
        <CardHeader title="Feedback do aluno" />
        <CardBody>
          <div className={styles.feedback}>
            {feedbackItens.map((item) => (
              <div key={item.label} className={styles.pill}>
                <span className={styles.pillTop}>
                  <i className={`ti ti-${item.icon}`} aria-hidden />
                  {item.label}
                </span>
                <span className={styles.pillNota}>
                  <span className={styles.pillNotaValor}>{item.nota}</span>
                  <span className={styles.pillNotaMax}>/5</span>
                </span>
                <span className={styles.dots} aria-hidden>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className={
                        n <= item.nota ? styles.dotOn : styles.dotOff
                      }
                    />
                  ))}
                </span>
              </div>
            ))}
          </div>
          <blockquote className={styles.quote}>
            <i className="ti ti-quote" aria-hidden />
            <p>{checkin.comentario}</p>
          </blockquote>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Sua resposta" />
        <CardBody>
          <Textarea
            placeholder="Escreva o feedback da semana…"
            maxLength={500}
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
          />
          <div className={styles.actions}>
            <Button
              variant="outline"
              icon="barbell"
              href={`/alunos/${id}/treino`}
            >
              Ajustar treino
            </Button>
            <Button
              variant="outline"
              icon="salad"
              href={`/alunos/${id}/dieta`}
            >
              Ajustar dieta
            </Button>
            <Button icon="send">Enviar resposta</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

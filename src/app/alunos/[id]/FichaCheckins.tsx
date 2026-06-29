"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardBody,
  StatusBadge,
  Button,
  EmptyState,
  ListRow,
  PointsChart,
} from "@/components/ui";
import { resolveCheckinsConsultor } from "@/lib/checkinsClient";
import { dataLonga } from "@/lib/format";
import type { CheckIn } from "@/lib/types";
import styles from "./ficha.module.css";

/**
 * Seção de check-ins da ficha (cliente). Lê do banco para alunos reais e de
 * mock+localStorage para alunos de exemplo / submissões de protótipo — assim o
 * que o aluno envia aparece aqui ponta a ponta.
 */
export function FichaCheckins({ alunoId }: { alunoId: string }) {
  const [checkins, setCheckins] = useState<CheckIn[] | null>(null);

  useEffect(() => {
    let active = true;
    resolveCheckinsConsultor(alunoId)
      .then(({ checkins }) => active && setCheckins(checkins))
      .catch(() => active && setCheckins([]));
    return () => {
      active = false;
    };
  }, [alunoId]);

  const lista = checkins ?? [];
  const checkin = lista.length ? lista[lista.length - 1] : undefined;
  const historico = [...lista].sort((a, b) => b.semana - a.semana);
  const pesoData = [...lista]
    .sort((a, b) => a.semana - b.semana)
    .map((c, i, arr) => ({
      date: `S${c.semana}`,
      total: c.peso,
      change: i === 0 ? 0 : c.peso - arr[i - 1].peso,
    }));

  return (
    <>
      {/* 4) Último check-in */}
      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle}>Último check-in</h2>
        </div>
        {checkins === null ? (
          <Card padded>
            <EmptyState icon="loader" title="Carregando check-ins…" compact />
          </Card>
        ) : checkin ? (
          <Card
            className={styles.checkinCard}
            data-pending={checkin.status === "pendente" || undefined}
          >
            <CardBody className={styles.checkinBody}>
              <div className={styles.checkinTop}>
                <div className={styles.checkinHeadText}>
                  {checkin.status === "pendente" ? (
                    <StatusBadge variant="new" icon="bell" noDot>
                      Aguardando sua resposta
                    </StatusBadge>
                  ) : (
                    <StatusBadge variant="ok" icon="check" noDot>
                      Respondido
                    </StatusBadge>
                  )}
                  <span className={styles.checkinWeek}>
                    Semana {checkin.semana}
                  </span>
                </div>
                <span className={styles.checkinDate}>
                  {dataLonga(checkin.enviadoEm)}
                </span>
              </div>

              <div className={styles.checkinStats}>
                <div className={styles.checkinStat}>
                  <span className={styles.checkinStatLabel}>Peso</span>
                  <span className={styles.checkinStatVal}>{checkin.peso} kg</span>
                </div>
                <div className={styles.checkinStat}>
                  <span className={styles.checkinStatLabel}>Treinos</span>
                  <span className={styles.checkinStatVal}>
                    {checkin.treinosFeitos}/{checkin.treinosTotais}
                  </span>
                </div>
                <div className={styles.checkinStat}>
                  <span className={styles.checkinStatLabel}>Energia</span>
                  <span className={styles.checkinStatVal}>
                    {checkin.avaliacoes.energia}/5
                  </span>
                </div>
                <div className={styles.checkinStat}>
                  <span className={styles.checkinStatLabel}>Sono</span>
                  <span className={styles.checkinStatVal}>
                    {checkin.avaliacoes.sono}/5
                  </span>
                </div>
                <div className={styles.checkinStat}>
                  <span className={styles.checkinStatLabel}>Dieta</span>
                  <span className={styles.checkinStatVal}>
                    {checkin.avaliacoes.dieta}/5
                  </span>
                </div>
              </div>

              {checkin.comentario && (
                <blockquote className={styles.checkinQuote}>
                  <i className="ti ti-quote" aria-hidden />
                  <span>{checkin.comentario}</span>
                </blockquote>
              )}

              {checkin.status === "pendente" && (
                <div className={styles.checkinAction}>
                  <Button
                    icon="message-2"
                    href={`/alunos/${alunoId}/checkin/${checkin.semana}`}
                  >
                    Responder e ajustar
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        ) : (
          <Card padded>
            <EmptyState
              icon="clipboard-list"
              title="Nenhum check-in ainda"
              description="Quando o aluno enviar o primeiro check-in, ele aparece aqui."
              compact
            />
          </Card>
        )}
      </section>

      {/* 4b) Histórico de check-ins */}
      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle}>Histórico de check-ins</h2>
          <p className={styles.blockSub}>
            Todos os check-ins enviados pelo aluno.
          </p>
        </div>
        {historico.length > 0 ? (
          <Card>
            <CardBody className={styles.historyBody}>
              {historico.map((c) => (
                <ListRow
                  key={c.id}
                  href={`/alunos/${alunoId}/checkin/${c.semana}`}
                  title={`Semana ${c.semana}`}
                  meta={`${dataLonga(c.enviadoEm)} · ${c.peso} kg · Treinos ${c.treinosFeitos}/${c.treinosTotais}`}
                  tags={
                    c.fotos.length > 0 ? (
                      <StatusBadge variant="off" icon="photo" noDot>
                        {c.fotos.length} fotos
                      </StatusBadge>
                    ) : undefined
                  }
                  action={
                    c.status === "pendente" ? (
                      <StatusBadge variant="new" icon="bell" noDot>
                        Aguardando resposta
                      </StatusBadge>
                    ) : (
                      <StatusBadge variant="ok" icon="check" noDot>
                        Respondido
                      </StatusBadge>
                    )
                  }
                />
              ))}
            </CardBody>
          </Card>
        ) : (
          <Card padded>
            <EmptyState
              icon="history"
              title="Nenhum check-in recebido ainda"
              compact
            />
          </Card>
        )}
      </section>

      {/* 4c) Evolução do peso */}
      {pesoData.length >= 2 && (
        <section className={styles.block}>
          <div className={styles.blockHead}>
            <h2 className={styles.blockTitle}>Evolução do peso</h2>
            <p className={styles.blockSub}>Peso registrado a cada check-in.</p>
          </div>
          <PointsChart data={pesoData} format="decimal1" unit=" kg" />
        </section>
      )}
    </>
  );
}

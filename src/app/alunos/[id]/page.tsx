import {
  Card,
  CardBody,
  CardHeader,
  MetricCard,
  StatusBadge,
  Button,
  Avatar,
  EmptyState,
  ListRow,
  PointsChart,
} from "@/components/ui";
import { TestAlunoFicha } from "@/components/screens/test-aluno/TestAlunoFicha";
import {
  getAluno,
  getTreino,
  getDieta,
  getProtocolo,
  ultimoCheckin,
  getCheckins,
  getPlano,
  planoNome,
} from "@/lib/data";
import {
  brl,
  dataLonga,
  STATUS_PAGAMENTO,
  MODALIDADE_LABEL,
} from "@/lib/format";
import styles from "./ficha.module.css";

// Bolhas de conversa mock (sem estado — visual)
const CONVERSA = [
  { de: "aluno", texto: "Oi Rafael! Terminei o treino de hoje, mandei bem nas pernas 💪", hora: "09:12" },
  { de: "coach", texto: "Boa! Vi seu check-in, evolução tá ótima. Vou ajustar a carga do agachamento.", hora: "09:30" },
  { de: "aluno", texto: "Perfeito. Uma dúvida: posso trocar o frango do almoço por tilápia?", hora: "10:04" },
  { de: "coach", texto: "Pode sim, são equivalentes. Já deixei a substituição na sua dieta.", hora: "10:11" },
] as const;

export default async function FichaAlunoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const aluno = getAluno(id);
  if (!aluno) return <TestAlunoFicha id={id} />;

  const status = STATUS_PAGAMENTO[aluno.statusPagamento];
  const plano = getPlano(aluno.planoId);
  const modalidade = plano?.modalidade
    ? MODALIDADE_LABEL[plano.modalidade]
    : null;

  const deltaPeso = aluno.pesoAtual - aluno.pesoInicial;
  const deltaPesoStr = `${deltaPeso >= 0 ? "+" : ""}${deltaPeso.toFixed(1)} kg`;

  const treino = getTreino(aluno.id);
  const dieta = getDieta(aluno.id);
  const protocolo = getProtocolo(aluno.id);
  const protocoloItens =
    protocolo?.blocos.reduce((acc, b) => acc + b.itens.length, 0) ?? 0;
  const checkin = ultimoCheckin(aluno.id);
  const historico = [...getCheckins(aluno.id)].sort((a, b) => b.semana - a.semana);
  const pesoData = [...getCheckins(aluno.id)]
    .sort((a, b) => a.semana - b.semana)
    .map((c, i, arr) => ({
      date: `S${c.semana}`,
      total: c.peso,
      change: i === 0 ? 0 : c.peso - arr[i - 1].peso,
    }));

  return (
    <div className={styles.page}>
      {/* 1) Header */}
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <Avatar name={aluno.nome} size={64} />
          <div className={styles.heroText}>
            <h1 className={styles.name}>{aluno.nome}</h1>
            <p className={styles.meta}>
              {modalidade && (
                <>
                  <span>{modalidade}</span>
                  <span className={styles.dot}>·</span>
                </>
              )}
              <span>{planoNome(aluno.planoId)}</span>
              <span className={styles.dot}>·</span>
              <span>{aluno.objetivo}</span>
            </p>
            <div className={styles.heroBadge}>
              <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
            </div>
          </div>
        </div>
        <div className={styles.heroActions}>
          <Button variant="outline" icon="message">
            Conversar
          </Button>
          <Button variant="outline" icon="edit">
            Editar
          </Button>
        </div>
      </header>

      {/* 2) Métricas */}
      <div className={styles.metrics}>
        <MetricCard
          label="Peso atual"
          value={`${aluno.pesoAtual} kg`}
          delta={{
            value: deltaPesoStr,
            dir: aluno.pesoAtual < aluno.pesoInicial ? "down" : "up",
          }}
          sub={`Inicial ${aluno.pesoInicial} kg`}
          icon="scale"
        />
        <MetricCard
          label="Aderência ao treino"
          value={`${aluno.aderenciaTreino}%`}
          sub="Últimas semanas"
          icon="activity"
        />
        <MetricCard
          label="Próx. vencimento"
          value={dataLonga(aluno.proximoVencimento)}
          sub={status.label}
          icon="calendar"
        />
      </div>

      {/* 3) Protocolo atual */}
      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle}>Protocolo atual</h2>
          <p className={styles.blockSub}>
            O que o aluno está seguindo agora.
          </p>
        </div>
        <div className={styles.protocols}>
          {/* Treino */}
          <Card padded className={styles.protocol}>
            <div className={styles.protoIcon} data-tone="info">
              <i className="ti ti-barbell" aria-hidden />
            </div>
            <span className="mono-label">Treino</span>
            <p className={styles.protoName}>
              {treino ? treino.nome : "Ainda não montado"}
            </p>
            <p className={styles.protoMeta}>
              {treino
                ? `${treino.exercicios.length} exercícios`
                : "Monte o programa de treino"}
            </p>
            <div className={styles.protoAction}>
              <Button
                variant="ghost"
                size="sm"
                iconRight={treino ? "arrow-right" : "plus"}
                href={`/alunos/${aluno.id}/treino`}
              >
                {treino ? "Abrir" : "Montar"}
              </Button>
            </div>
          </Card>

          {/* Dieta */}
          <Card padded className={styles.protocol}>
            <div className={styles.protoIcon} data-tone="success">
              <i className="ti ti-salad" aria-hidden />
            </div>
            <span className="mono-label">Dieta</span>
            <p className={styles.protoName}>
              {dieta ? `${dieta.metaKcal} kcal` : "Ainda não montada"}
            </p>
            <p className={styles.protoMeta}>
              {dieta
                ? `${dieta.refeicoes.length} refeições`
                : "Monte o plano alimentar"}
            </p>
            <div className={styles.protoAction}>
              <Button
                variant="ghost"
                size="sm"
                iconRight={dieta ? "arrow-right" : "plus"}
                href={`/alunos/${aluno.id}/dieta`}
              >
                {dieta ? "Abrir" : "Montar"}
              </Button>
            </div>
          </Card>

          {/* Protocolos extras */}
          <Card padded className={styles.protocol}>
            <div className={styles.protoIcon} data-tone="warning">
              <i className="ti ti-pill" aria-hidden />
            </div>
            <span className="mono-label">Protocolos extras</span>
            <p className={styles.protoName}>
              {protocolo ? `${protocoloItens} itens` : "Ainda não montado"}
            </p>
            <p className={styles.protoMeta}>
              {protocolo
                ? protocolo.blocos.map((b) => b.nome).join(" · ")
                : "Suplementos, manipulados e mais"}
            </p>
            <div className={styles.protoAction}>
              <Button
                variant="ghost"
                size="sm"
                iconRight={protocolo ? "arrow-right" : "plus"}
                href={`/alunos/${aluno.id}/protocolo`}
              >
                {protocolo ? "Abrir" : "Montar"}
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* 4) Último check-in */}
      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle}>Último check-in</h2>
        </div>
        {checkin ? (
          <Card className={styles.checkinCard} data-pending={checkin.status === "pendente" || undefined}>
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
                  <span className={styles.checkinWeek}>Semana {checkin.semana}</span>
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
                  <span className={styles.checkinStatVal}>{checkin.avaliacoes.energia}/5</span>
                </div>
                <div className={styles.checkinStat}>
                  <span className={styles.checkinStatLabel}>Sono</span>
                  <span className={styles.checkinStatVal}>{checkin.avaliacoes.sono}/5</span>
                </div>
                <div className={styles.checkinStat}>
                  <span className={styles.checkinStatLabel}>Dieta</span>
                  <span className={styles.checkinStatVal}>{checkin.avaliacoes.dieta}/5</span>
                </div>
              </div>

              <blockquote className={styles.checkinQuote}>
                <i className="ti ti-quote" aria-hidden />
                <span>{checkin.comentario}</span>
              </blockquote>

              {checkin.status === "pendente" && (
                <div className={styles.checkinAction}>
                  <Button
                    icon="message-2"
                    href={`/alunos/${aluno.id}/checkin/${checkin.semana}`}
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
                  href={`/alunos/${aluno.id}/checkin/${c.semana}`}
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
            <p className={styles.blockSub}>
              Peso registrado a cada check-in.
            </p>
          </div>
          <PointsChart data={pesoData} format="decimal1" unit=" kg" />
        </section>
      )}

      {/* 5) + 6) Pagamento e Conversa lado a lado */}
      <div className={styles.bottomGrid}>
        {/* Pagamento */}
        <Card>
          <CardHeader
            title="Pagamento"
            action={
              <Button variant="ghost" size="sm" iconRight="arrow-right" href="/financeiro">
                Ver no financeiro
              </Button>
            }
          />
          <CardBody className={styles.payBody}>
            <div className={styles.payRow}>
              <span className={styles.payLabel}>Plano</span>
              <span className={styles.payValue}>{planoNome(aluno.planoId)}</span>
            </div>
            <div className={styles.payRow}>
              <span className={styles.payLabel}>Valor</span>
              <span className={styles.payValue}>
                {plano ? brl(plano.preco) : "—"}
              </span>
            </div>
            <div className={styles.payRow}>
              <span className={styles.payLabel}>Status</span>
              <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
            </div>
            <div className={styles.payRow}>
              <span className={styles.payLabel}>Próx. vencimento</span>
              <span className={styles.payValue}>
                {dataLonga(aluno.proximoVencimento)}
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Conversa */}
        <Card className={styles.chatCard}>
          <CardHeader
            title="Conversa"
            action={
              <span className={styles.chatStatus}>
                <i className="ti ti-circle-filled" aria-hidden /> Online
              </span>
            }
          />
          <CardBody className={styles.chatBody}>
            <div className={styles.chatThread}>
              {CONVERSA.map((m, i) => (
                <div
                  key={i}
                  className={styles.bubbleRow}
                  data-de={m.de}
                >
                  <div className={styles.bubble} data-de={m.de}>
                    <span className={styles.bubbleText}>{m.texto}</span>
                    <span className={styles.bubbleTime}>{m.hora}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.chatInput}>
              <i className="ti ti-mood-smile" aria-hidden />
              <span className={styles.chatInputPlaceholder}>
                Escreva uma mensagem…
              </span>
              <button className={styles.chatSend} type="button" aria-label="Enviar">
                <i className="ti ti-send" aria-hidden />
              </button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

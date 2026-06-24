import { PageHeader } from "@/components/PageHeader";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  CardBody,
  MetricCard,
  StatusBadge,
  EmptyState,
} from "@/components/ui";
import { getAlunoPlataforma, getConsultoria } from "@/lib/admin";
import {
  getAluno,
  getTreino,
  getDieta,
  getProtocolo,
  getCheckins,
  planoNome,
  getPlano,
} from "@/lib/data";
import { brl, dataLonga, dataCurta, STATUS_PAGAMENTO } from "@/lib/format";
import styles from "./aluno.module.css";

export default async function AdminAlunoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ap = getAlunoPlataforma(id);

  if (!ap) {
    return (
      <>
        <PageHeader
          eyebrow="Alunos"
          title="Aluno não encontrado"
          subtitle="O registro solicitado não existe ou foi removido."
        />
        <Card padded>
          <div className={styles.notFound}>
            <i className="ti ti-user-question" aria-hidden />
            <p>Não encontramos nenhum aluno com este identificador.</p>
            <Button variant="outline" icon="arrow-left" href="/admin/alunos">
              Voltar para alunos
            </Button>
          </div>
        </Card>
      </>
    );
  }

  const consultoria = getConsultoria(ap.consultoriaId);
  const coachId = ap.coachAlunoId;

  // Dados ricos do app do consultor (quando o aluno está ligado).
  const aluno = coachId ? getAluno(coachId) : undefined;
  const treino = coachId ? getTreino(coachId) : undefined;
  const dieta = coachId ? getDieta(coachId) : undefined;
  const protocolo = coachId ? getProtocolo(coachId) : undefined;
  const checkins = coachId
    ? [...getCheckins(coachId)].sort((a, b) => b.semana - a.semana)
    : [];
  const plano = aluno ? getPlano(aluno.planoId) : undefined;
  const pgto = aluno ? STATUS_PAGAMENTO[aluno.statusPagamento] : undefined;
  const totalItensProto =
    protocolo?.blocos.reduce((s, b) => s + b.itens.length, 0) ?? 0;

  return (
    <>
      <Button
        variant="ghost"
        icon="arrow-left"
        href={`/admin/consultores/${ap.consultoriaId}`}
      >
        {consultoria?.nomeNegocio ?? "Consultoria"}
      </Button>

      <PageHeader
        eyebrow={`Aluno · ${ap.consultor}`}
        title={
          <div className={styles.headTitle}>
            <Avatar name={ap.nome} size={56} />
            <div>
              <div className={styles.headName}>
                {ap.nome}
                <StatusBadge variant={ap.status === "ativo" ? "ok" : "off"}>
                  {ap.status === "ativo" ? "Ativo" : "Inativo"}
                </StatusBadge>
              </div>
              <span className={styles.headSub}>
                {ap.objetivo} · desde {dataLonga(ap.desde)}
              </span>
            </div>
          </div>
        }
      />

      {/* Métricas (quando há dados ricos) */}
      {aluno && (
        <div className={styles.metrics}>
          <MetricCard
            label="Peso atual"
            value={`${aluno.pesoAtual} kg`}
            delta={{
              value: `${aluno.pesoAtual - aluno.pesoInicial >= 0 ? "+" : ""}${(
                aluno.pesoAtual - aluno.pesoInicial
              ).toFixed(1)} kg`,
              dir: aluno.pesoAtual < aluno.pesoInicial ? "down" : "up",
            }}
            sub={`Inicial ${aluno.pesoInicial} kg`}
            icon="scale"
          />
          <MetricCard
            label="Aderência ao treino"
            value={`${aluno.aderenciaTreino}%`}
            icon="activity"
          />
          <MetricCard
            label="Próx. vencimento"
            value={dataLonga(aluno.proximoVencimento)}
            icon="calendar"
          />
        </div>
      )}

      <div className={styles.grid2}>
        {/* Dados cadastrais */}
        <Card padded>
          <CardHeader title="Dados cadastrais" />
          <dl className={styles.dl}>
            <div className={styles.dlRow}>
              <dt>Nome</dt>
              <dd>{ap.nome}</dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Consultoria</dt>
              <dd>{consultoria?.nomeNegocio ?? "—"}</dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Consultor</dt>
              <dd>{ap.consultor}</dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Objetivo</dt>
              <dd>{ap.objetivo}</dd>
            </div>
            {aluno && (
              <>
                <div className={styles.dlRow}>
                  <dt>E-mail</dt>
                  <dd>{aluno.email}</dd>
                </div>
                <div className={styles.dlRow}>
                  <dt>CPF</dt>
                  <dd>{aluno.cpf}</dd>
                </div>
              </>
            )}
            <div className={styles.dlRow}>
              <dt>Início</dt>
              <dd>{dataLonga(aluno?.inicio ?? ap.desde)}</dd>
            </div>
          </dl>
        </Card>

        {/* Pagamento / plano */}
        <Card padded>
          <CardHeader title="Plano & pagamento" />
          {aluno && plano ? (
            <dl className={styles.dl}>
              <div className={styles.dlRow}>
                <dt>Plano</dt>
                <dd>{planoNome(aluno.planoId)}</dd>
              </div>
              <div className={styles.dlRow}>
                <dt>Valor</dt>
                <dd>{brl(plano.preco)}</dd>
              </div>
              <div className={styles.dlRow}>
                <dt>Status</dt>
                <dd>
                  {pgto && (
                    <StatusBadge variant={pgto.variant}>{pgto.label}</StatusBadge>
                  )}
                </dd>
              </div>
              <div className={styles.dlRow}>
                <dt>Próx. vencimento</dt>
                <dd>{dataLonga(aluno.proximoVencimento)}</dd>
              </div>
            </dl>
          ) : (
            <p className={styles.muted}>
              Dados de plano/pagamento não disponíveis para este aluno de
              demonstração.
            </p>
          )}
        </Card>
      </div>

      {!aluno && (
        <Card padded>
          <EmptyState
            compact
            icon="database-off"
            title="Sem dados detalhados"
            description="Treino, dieta, protocolo e check-ins deste aluno não estão disponíveis nesta demonstração. Os dados completos existem para os alunos da consultoria CoachFit."
          />
        </Card>
      )}

      {/* Treino, Dieta e Protocolo entregues ao aluno */}
      {aluno && (
        <>
          <Card padded={false} className={styles.bloco}>
            <CardHeader
              title="Treino"
              action={
                coachId && treino ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    iconRight="external-link"
                    href={`/alunos/${coachId}/treino`}
                  >
                    Abrir construtor
                  </Button>
                ) : undefined
              }
            />
            <CardBody>
              {treino ? (
                <>
                  <p className={styles.blocoSub}>
                    {treino.nome} · {treino.exercicios.length} exercícios
                  </p>
                  <ul className={styles.lista}>
                    {treino.exercicios.map((e) => (
                      <li key={e.id} className={styles.item}>
                        <span className={styles.itemNome}>{e.nome}</span>
                        <span className={styles.itemMeta}>
                          {e.grupo} · {e.series}×{e.reps} · {e.descansoSeg}s
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className={styles.muted}>Treino ainda não montado.</p>
              )}
            </CardBody>
          </Card>

          <Card padded={false} className={styles.bloco}>
            <CardHeader
              title="Dieta"
              action={
                coachId && dieta ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    iconRight="external-link"
                    href={`/alunos/${coachId}/dieta`}
                  >
                    Abrir construtor
                  </Button>
                ) : undefined
              }
            />
            <CardBody>
              {dieta ? (
                <>
                  <p className={styles.blocoSub}>
                    Meta {dieta.metaKcal.toLocaleString("pt-BR")} kcal ·{" "}
                    {dieta.refeicoes.length} refeições
                  </p>
                  <ul className={styles.lista}>
                    {dieta.refeicoes.map((r) => (
                      <li key={r.id} className={styles.item}>
                        <span className={styles.itemNome}>
                          {r.nome} <span className={styles.hora}>{r.horario}</span>
                        </span>
                        <span className={styles.itemMeta}>
                          {r.alimentos.length} alimentos ·{" "}
                          {r.alimentos.reduce((s, a) => s + a.macros.kcal, 0)} kcal
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className={styles.muted}>Dieta ainda não montada.</p>
              )}
            </CardBody>
          </Card>

          <Card padded={false} className={styles.bloco}>
            <CardHeader
              title="Protocolo (extras)"
              action={
                coachId && protocolo ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    iconRight="external-link"
                    href={`/alunos/${coachId}/protocolo`}
                  >
                    Abrir construtor
                  </Button>
                ) : undefined
              }
            />
            <CardBody>
              {protocolo && totalItensProto > 0 ? (
                <>
                  <p className={styles.blocoSub}>{totalItensProto} itens</p>
                  {protocolo.blocos.map((b) => (
                    <div key={b.id} className={styles.protoBloco}>
                      <span className={styles.protoBlocoNome}>{b.nome}</span>
                      <ul className={styles.lista}>
                        {b.itens.map((it) => (
                          <li key={it.id} className={styles.item}>
                            <span className={styles.itemNome}>{it.nome}</span>
                            <span className={styles.itemMeta}>
                              {it.dose}
                              {it.horario ? ` · ${it.horario}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </>
              ) : (
                <p className={styles.muted}>Protocolo ainda não montado.</p>
              )}
            </CardBody>
          </Card>

          {/* Check-ins */}
          <Card padded={false} className={styles.bloco}>
            <CardHeader title={`Check-ins (${checkins.length})`} />
            <CardBody>
              {checkins.length === 0 ? (
                <p className={styles.muted}>Nenhum check-in enviado ainda.</p>
              ) : (
                <ul className={styles.lista}>
                  {checkins.map((c) => (
                    <li key={c.id} className={styles.item}>
                      <span className={styles.itemNome}>
                        Semana {c.semana}{" "}
                        <span className={styles.hora}>
                          {dataCurta(c.enviadoEm)}
                        </span>
                      </span>
                      <span className={styles.itemMeta}>
                        {c.peso} kg · treinos {c.treinosFeitos}/{c.treinosTotais}
                        {"  "}
                        <StatusBadge
                          variant={c.status === "pendente" ? "new" : "ok"}
                          noDot
                        >
                          {c.status === "pendente"
                            ? "Aguardando resposta"
                            : "Respondido"}
                        </StatusBadge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </>
  );
}

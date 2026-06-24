import { PageHeader } from "@/components/PageHeader";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  CardBody,
  MetricCard,
  StatusBadge,
} from "@/components/ui";
import {
  getConsultoria,
  getAssinaturaPorConsultoria,
  listAlunosPorConsultoria,
  planoPlataformaNome,
  STATUS_CONSULTORIA,
} from "@/lib/admin";
import { brl, dataLonga } from "@/lib/format";
import { getAluno } from "@/lib/data";
import { AlunosList } from "./AlunosList";
import styles from "./detalhe.module.css";

const STATUS_ASSINATURA: Record<
  string,
  { label: string; variant: "ok" | "late" | "pending" | "new" | "off" }
> = {
  ativa: { label: "Ativa", variant: "ok" },
  trial: { label: "Trial", variant: "new" },
  inadimplente: { label: "Inadimplente", variant: "late" },
  cancelada: { label: "Cancelada", variant: "off" },
};

export default async function ConsultoriaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = getConsultoria(id);

  if (!c) {
    return (
      <>
        <PageHeader
          eyebrow="Consultorias"
          title="Consultoria não encontrada"
          subtitle="O registro solicitado não existe ou foi removido."
        />
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
  const assinatura = getAssinaturaPorConsultoria(c.id);
  const alunos = listAlunosPorConsultoria(c.id);

  // Visão geral dos alunos da consultoria
  const novosAlunos = alunos.filter((a) => a.desde >= "2026-06-01").length;
  const naoAtendidos = alunos.filter((a) => {
    if (a.status === "inativo") return true;
    if (a.coachAlunoId) {
      const rico = getAluno(a.coachAlunoId);
      return !!(rico?.aguardandoProtocolo || rico?.checkinPendente);
    }
    return false;
  }).length;

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
            <Button variant="danger" icon="ban">
              Suspender
            </Button>
          </>
        }
      />

      <div className={styles.metrics}>
        <MetricCard label="Alunos ativos" value={c.alunosAtivos} icon="users" />
        <MetricCard label="MRR" value={brl(c.mrr)} icon="repeat" />
        <MetricCard
          label="Faturamento mensal"
          value={brl(c.faturamentoMensal)}
          sub="GMV gerado"
          icon="chart-bar"
        />
        <MetricCard
          label="Plano"
          value={planoPlataformaNome(c.planoPlataformaId)}
          icon="stack-2"
        />
      </div>

      <div className={styles.grid2}>
        <Card padded>
          <CardHeader title="Dados do consultor" />
          <dl className={styles.dl}>
            <div className={styles.dlRow}>
              <dt>Consultor</dt>
              <dd>{c.consultor}</dd>
            </div>
            <div className={styles.dlRow}>
              <dt>E-mail</dt>
              <dd>{c.email}</dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Telefone</dt>
              <dd>{c.telefone}</dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Conselho</dt>
              <dd>{c.conselho}</dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Cidade</dt>
              <dd>{c.cidade}</dd>
            </div>
            <div className={styles.dlRow}>
              <dt>Cadastro</dt>
              <dd>{dataLonga(c.criadoEm)}</dd>
            </div>
          </dl>
        </Card>

        <Card padded>
          <CardHeader title="Assinatura na plataforma" />
          {assinatura ? (
            <>
              <dl className={styles.dl}>
                <div className={styles.dlRow}>
                  <dt>Plano</dt>
                  <dd>{planoPlataformaNome(assinatura.planoId)}</dd>
                </div>
                <div className={styles.dlRow}>
                  <dt>Valor</dt>
                  <dd>
                    {brl(assinatura.valor)}
                    <span className={styles.perMes}> /mês</span>
                  </dd>
                </div>
                <div className={styles.dlRow}>
                  <dt>Status</dt>
                  <dd>
                    {(() => {
                      const s = STATUS_ASSINATURA[assinatura.status];
                      return <StatusBadge variant={s.variant}>{s.label}</StatusBadge>;
                    })()}
                  </dd>
                </div>
                <div className={styles.dlRow}>
                  <dt>Início</dt>
                  <dd>{dataLonga(assinatura.inicio)}</dd>
                </div>
                <div className={styles.dlRow}>
                  <dt>Próxima cobrança</dt>
                  <dd>{dataLonga(assinatura.proximaCobranca)}</dd>
                </div>
                <div className={styles.dlRow}>
                  <dt>Método</dt>
                  <dd>{assinatura.metodo}</dd>
                </div>
              </dl>
              <div className={styles.cardFoot}>
                <Button variant="outline" icon="settings" href="/admin/assinaturas" fullWidth>
                  Gerenciar assinatura
                </Button>
              </div>
            </>
          ) : (
            <p className={styles.muted}>Sem assinatura registrada para esta consultoria.</p>
          )}
        </Card>
      </div>

      {/* Visão geral dos alunos da consultoria */}
      <div className={styles.overviewGrid}>
        <MetricCard
          label="Alunos no painel"
          value={alunos.length}
          sub={`${c.alunosAtivos} ativos no total`}
          icon="users"
        />
        <MetricCard label="Novos no mês" value={novosAlunos} icon="user-plus" />
        <MetricCard
          label="Precisam de atenção"
          value={naoAtendidos}
          sub="Aguardando protocolo / check-in"
          icon="alert-triangle"
        />
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
        <AlunosList alunos={alunos} />
      </Card>
    </>
  );
}

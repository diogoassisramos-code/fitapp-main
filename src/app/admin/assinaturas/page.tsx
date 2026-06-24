"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import {
  Avatar,
  Card,
  Chip,
  EmptyState,
  KebabMenu,
  ListRow,
  MetricCard,
  StatusBadge,
} from "@/components/ui";
import {
  getConsultoria,
  listAssinaturas,
  planoPlataformaNome,
  type StatusAssinatura,
} from "@/lib/admin";
import { brl, dataCurta } from "@/lib/format";
import styles from "./assinaturas.module.css";

type Filtro = "todas" | StatusAssinatura;

const STATUS_ASSINATURA: Record<
  StatusAssinatura,
  { label: string; variant: "ok" | "new" | "late" | "off" }
> = {
  ativa: { label: "Ativa", variant: "ok" },
  trial: { label: "Trial", variant: "new" },
  inadimplente: { label: "Inadimplente", variant: "late" },
  cancelada: { label: "Cancelada", variant: "off" },
};

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "ativa", label: "Ativas" },
  { id: "trial", label: "Trial" },
  { id: "inadimplente", label: "Inadimplentes" },
  { id: "cancelada", label: "Canceladas" },
];

export default function AssinaturasPage() {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const assinaturas = useMemo(() => listAssinaturas(), []);

  const kpis = useMemo(() => {
    const ativas = assinaturas.filter((a) => a.status === "ativa").length;
    const mrr = assinaturas
      .filter((a) => a.status === "ativa" || a.status === "trial")
      .reduce((s, a) => s + a.valor, 0);
    const trial = assinaturas.filter((a) => a.status === "trial").length;
    const inadimplentes = assinaturas.filter(
      (a) => a.status === "inadimplente"
    ).length;
    return { ativas, mrr, trial, inadimplentes };
  }, [assinaturas]);

  const contagem = useMemo(() => {
    const map: Record<Filtro, number> = {
      todas: assinaturas.length,
      ativa: 0,
      trial: 0,
      inadimplente: 0,
      cancelada: 0,
    };
    for (const a of assinaturas) map[a.status] += 1;
    return map;
  }, [assinaturas]);

  const lista = useMemo(
    () =>
      filtro === "todas"
        ? assinaturas
        : assinaturas.filter((a) => a.status === filtro),
    [assinaturas, filtro]
  );

  return (
    <div className={styles.page}>
      <PageHeader
        title="Assinaturas"
        subtitle="Assinaturas das consultorias na plataforma."
      />

      <div className={styles.metrics}>
        <MetricCard
          label="Assinaturas ativas"
          value={kpis.ativas}
          sub="Cobrança recorrente em dia"
          icon="circle-check"
        />
        <MetricCard
          label="MRR"
          value={brl(kpis.mrr)}
          sub="Receita recorrente mensal"
          icon="trending-up"
        />
        <MetricCard
          label="Em trial"
          value={kpis.trial}
          sub="Período de teste"
          icon="hourglass"
        />
        <MetricCard
          label="Inadimplentes"
          value={kpis.inadimplentes}
          sub="Pagamento em atraso"
          icon="alert-triangle"
        />
      </div>

      <div className={styles.filtros}>
        {FILTROS.map((f) => (
          <Chip
            key={f.id}
            selected={filtro === f.id}
            count={contagem[f.id]}
            onClick={() => setFiltro(f.id)}
          >
            {f.label}
          </Chip>
        ))}
      </div>

      <Card padded={false}>
        {lista.length === 0 ? (
          <EmptyState
            icon="receipt-off"
            title="Nenhuma assinatura"
            description="Não há assinaturas com este status no momento."
          />
        ) : (
          lista.map((a) => {
            const consultoria = getConsultoria(a.consultoriaId);
            const st = STATUS_ASSINATURA[a.status];
            const ativa = a.status === "ativa" || a.status === "trial";

            const acoes = [
              { label: "Mudar plano", icon: "arrows-exchange" },
              ativa
                ? { label: "Suspender", icon: "player-pause" }
                : { label: "Reativar", icon: "player-play" },
              {
                label: "Cancelar",
                icon: "x",
                danger: true,
                separatorBefore: true,
              },
            ];

            return (
              <ListRow
                key={a.id}
                onClick={() =>
                  consultoria &&
                  router.push(`/admin/consultores/${consultoria.id}`)
                }
                leading={<Avatar name={consultoria?.consultor ?? "—"} />}
                title={consultoria?.nomeNegocio ?? "Consultoria removida"}
                action={
                  <div className={styles.acaoLinha}>
                    <StatusBadge variant={st.variant}>{st.label}</StatusBadge>
                    <span className={styles.valor}>{brl(a.valor)}/mês</span>
                    <KebabMenu items={acoes} />
                  </div>
                }
                meta={`${planoPlataformaNome(a.planoId)} · próxima cobrança ${dataCurta(
                  a.proximaCobranca
                )} · ${a.metodo}`}
                tags={
                  consultoria && (
                    <span className={styles.stats}>
                      <span className={styles.stat}>
                        <i className="ti ti-users" aria-hidden />{" "}
                        {consultoria.alunosAtivos} clientes
                      </span>
                      <span className={styles.stat}>
                        <i className="ti ti-chart-bar" aria-hidden /> volume{" "}
                        {brl(consultoria.faturamentoMensal)}/mês
                      </span>
                      <span className={styles.stat} data-receita>
                        <i className="ti ti-trending-up" aria-hidden /> traz{" "}
                        {brl(consultoria.mrr)}/mês
                      </span>
                    </span>
                  )
                }
              />
            );
          })
        )}
      </Card>
    </div>
  );
}

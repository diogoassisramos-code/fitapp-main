"use client";

import { useEffect, useMemo, useState } from "react";
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
import { STATUS_CONSULTORIA, type StatusConsultoria } from "@/lib/admin";
import { adminFetchAssinaturas, type AdminAssinatura } from "@/lib/adminDb";
import { mudarAssinaturaConsultoria } from "@/lib/adminAsaas";
import { brl } from "@/lib/format";
import styles from "./assinaturas.module.css";

type Filtro = "todas" | StatusConsultoria;

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "ativo", label: "Ativas" },
  { id: "trial", label: "Trial" },
  { id: "inadimplente", label: "Inadimplentes" },
  { id: "cancelado", label: "Canceladas" },
];

export default function AssinaturasPage() {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [assinaturas, setAssinaturas] = useState<AdminAssinatura[] | null>(null);

  const carregar = () => adminFetchAssinaturas().then(setAssinaturas).catch(() => setAssinaturas([]));
  useEffect(() => {
    carregar();
  }, []);

  const todas = assinaturas ?? [];

  const kpis = useMemo(() => {
    const ativas = todas.filter((a) => a.status === "ativo").length;
    const mrr = todas.filter((a) => a.status === "ativo" || a.status === "trial").reduce((s, a) => s + a.valor, 0);
    const trial = todas.filter((a) => a.status === "trial").length;
    const inadimplentes = todas.filter((a) => a.status === "inadimplente").length;
    return { ativas, mrr, trial, inadimplentes };
  }, [todas]);

  const contagem = useMemo(() => {
    const map: Record<Filtro, number> = { todas: todas.length, ativo: 0, trial: 0, inadimplente: 0, suspenso: 0, cancelado: 0 };
    for (const a of todas) map[a.status] += 1;
    return map;
  }, [todas]);

  const lista = useMemo(
    () => (filtro === "todas" ? todas : todas.filter((a) => a.status === filtro)),
    [todas, filtro]
  );

  // Cancelar/reativar ligando o Asaas de verdade (suspende/reativa a assinatura
  // e ajusta o plano_status). Sem assinatura no Asaas (free), só muda o status.
  async function alterarAssinatura(
    a: AdminAssinatura,
    acao: "cancelar" | "reativar"
  ) {
    try {
      await mudarAssinaturaConsultoria(a.consultoriaId, acao);
      carregar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao atualizar assinatura.");
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader title="Assinaturas" subtitle="Assinaturas das consultorias na plataforma." />

      <div className={styles.metrics}>
        <MetricCard label="Assinaturas ativas" value={kpis.ativas} sub="Cobrança recorrente em dia" icon="circle-check" />
        <MetricCard label="MRR" value={brl(kpis.mrr)} sub="Receita recorrente mensal" icon="trending-up" />
        <MetricCard label="Em trial" value={kpis.trial} sub="Período de teste" icon="hourglass" />
        <MetricCard label="Inadimplentes" value={kpis.inadimplentes} sub="Pagamento em atraso" icon="alert-triangle" />
      </div>

      <div className={styles.filtros}>
        {FILTROS.map((f) => (
          <Chip key={f.id} selected={filtro === f.id} count={contagem[f.id]} onClick={() => setFiltro(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>

      <Card padded={false}>
        {assinaturas === null ? null : lista.length === 0 ? (
          <EmptyState icon="receipt-off" title="Nenhuma assinatura" description="Não há assinaturas com este status no momento." />
        ) : (
          lista.map((a) => {
            const st = STATUS_CONSULTORIA[a.status];
            const ativa = a.status === "ativo" || a.status === "trial";
            return (
              <ListRow
                key={a.id}
                onClick={() => router.push(`/admin/consultores/${a.consultoriaId}`)}
                leading={<Avatar name={a.consultor || a.nomeNegocio} />}
                title={a.nomeNegocio}
                action={
                  <div className={styles.acaoLinha}>
                    <StatusBadge variant={st.variant}>{st.label}</StatusBadge>
                    <span className={styles.valor}>{brl(a.valor)}/mês</span>
                    <KebabMenu
                      items={[
                        { label: "Mudar plano", icon: "arrows-exchange", onClick: () => router.push(`/admin/consultores/${a.consultoriaId}/editar`) },
                        ativa
                          ? { label: "Cancelar assinatura", icon: "x", danger: true, separatorBefore: true, onClick: () => { if (confirm(`Cancelar a assinatura de "${a.nomeNegocio}"? A cobrança recorrente é suspensa no Asaas e a conta é mantida.`)) alterarAssinatura(a, "cancelar"); } }
                          : { label: "Reativar assinatura", icon: "player-play", onClick: () => alterarAssinatura(a, "reativar") },
                      ]}
                    />
                  </div>
                }
                meta={`plano ${a.planoSlug} · ${a.metodo}${a.asaasSubscriptionId ? " · Asaas" : ""}`}
              />
            );
          })
        )}
      </Card>
    </div>
  );
}

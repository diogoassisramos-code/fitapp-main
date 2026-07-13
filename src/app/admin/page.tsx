"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  Button,
  Card,
  CardHeader,
  MetricCard,
  StatusBadge,
  ListRow,
  Avatar,
  PointsChart,
  EmptyState,
} from "@/components/ui";
import { STATUS_CONSULTORIA } from "@/lib/admin";
import { adminFetchConsultorias, type AdminConsultoria } from "@/lib/adminDb";
import { fetchAdminFinanceiro, type AdminFinanceiroReal } from "@/lib/db";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { brl } from "@/lib/format";
import styles from "./visao-geral.module.css";

export default function AdminVisaoGeralPage() {
  const [consultorias, setConsultorias] = useState<AdminConsultoria[] | null>(null);
  const [fin, setFin] = useState<AdminFinanceiroReal | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) {
      setConsultorias([]);
      return;
    }
    let active = true;
    adminFetchConsultorias().then((c) => active && setConsultorias(c)).catch(() => active && setConsultorias([]));
    fetchAdminFinanceiro().then((f) => active && setFin(f)).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const cs = consultorias ?? [];
    const mes = new Date().toISOString().slice(0, 7);
    return {
      total: cs.length,
      ativas: cs.filter((c) => c.status === "ativo" || c.status === "trial").length,
      alunos: cs.reduce((s, c) => s + c.alunosAtivos, 0),
      mrr: cs.reduce((s, c) => s + c.mrr, 0),
      volume: cs.reduce((s, c) => s + c.faturamentoMensal, 0),
      novas: cs.filter((c) => c.criadoEm.slice(0, 7) === mes).length,
      inadimplentes: cs.filter((c) => c.status === "inadimplente").length,
    };
  }, [consultorias]);

  const top = useMemo(
    () => [...(consultorias ?? [])].sort((a, b) => b.alunosAtivos - a.alunosAtivos).slice(0, 5),
    [consultorias]
  );

  const carregando = consultorias === null;
  const fat6 = fin?.faturamento6m ?? [];
  const vol6 = fin?.volume6m ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Painel da plataforma"
        title="Visão geral"
        subtitle="Saúde da plataforma Revo"
        actions={
          <Button icon="plus" href="/admin/consultores/novo">
            Nova consultoria
          </Button>
        }
      />

      <section className={styles.metrics}>
        <MetricCard label="Consultorias ativas" value={`${stats.ativas} / ${stats.total}`} icon="briefcase" />
        <MetricCard label="Alunos na plataforma" value={stats.alunos} icon="users" />
        <MetricCard label="MRR da plataforma" value={brl(stats.mrr)} icon="repeat" />
        <MetricCard label="Volume processado" value={brl(stats.volume)} sub="GMV no mês" icon="chart-bar" />
        <MetricCard label="Novas no mês" value={stats.novas} icon="sparkles" />
        <MetricCard label="Inadimplentes" value={stats.inadimplentes} icon="alert-triangle" />
      </section>

      {(fat6.length >= 2 || vol6.length >= 2) && (
        <section className={styles.charts}>
          {fat6.length >= 2 && (
            <PointsChart
              title="Receita da plataforma (6 meses)"
              data={fat6.map((f, i, a) => ({ date: f.mes, total: f.valor, change: i === 0 ? 0 : f.valor - a[i - 1].valor }))}
              formatValue={(v) => "R$ " + Math.round(v).toLocaleString("pt-BR")}
            />
          )}
          {vol6.length >= 2 && (
            <PointsChart
              title="Volume processado (6 meses)"
              data={vol6.map((f, i, a) => ({ date: f.mes, total: f.valor, change: i === 0 ? 0 : f.valor - a[i - 1].valor }))}
              formatValue={(v) => "R$ " + (v / 1000).toFixed(0) + "k"}
            />
          )}
        </section>
      )}

      <Card padded={false}>
        <CardHeader
          title="Top consultorias"
          action={
            <Button variant="ghost" size="sm" iconRight="arrow-right" href="/admin/consultores">
              Ver todas
            </Button>
          }
        />
        {carregando ? (
          <p className={styles.carregando}>Carregando…</p>
        ) : top.length === 0 ? (
          <EmptyState icon="building-store" title="Sem consultorias ainda" description="As consultorias aparecem aqui conforme os consultores se cadastram." compact />
        ) : (
          <div className={styles.lista}>
            {top.map((c) => {
              const status = STATUS_CONSULTORIA[c.status];
              return (
                <ListRow
                  key={c.id}
                  href={`/admin/consultores/${c.id}`}
                  leading={<Avatar name={c.consultor} />}
                  title={c.nomeNegocio + " · " + c.consultor}
                  action={
                    <div className={styles.rowAction}>
                      <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                      <span className={styles.mrr}>{brl(c.mrr)}/mês</span>
                    </div>
                  }
                  meta={<>{c.planoSlug} · {c.alunosAtivos} alunos ativos</>}
                />
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}

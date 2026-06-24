"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  KebabMenu,
  ListRow,
  MetricCard,
  StatusBadge,
} from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import {
  listConsultorias,
  planoPlataformaNome,
  STATUS_CONSULTORIA,
  type StatusConsultoria,
} from "@/lib/admin";
import { brl } from "@/lib/format";
import styles from "./consultores.module.css";

type Filtro = "todas" | StatusConsultoria;

const FILTROS: { id: Filtro; label: string; match?: StatusConsultoria }[] = [
  { id: "todas", label: "Todas" },
  { id: "ativo", label: "Ativas", match: "ativo" },
  { id: "trial", label: "Trial", match: "trial" },
  { id: "inadimplente", label: "Inadimplentes", match: "inadimplente" },
  { id: "suspenso", label: "Suspensas", match: "suspenso" },
];

export default function ConsultoriasPage() {
  const router = useRouter();
  const todas = listConsultorias();

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const totalConsultorias = todas.length;
  const totalAlunos = todas.reduce((s, c) => s + c.alunosAtivos, 0);
  const mrr = todas.reduce(
    (s, c) => s + (c.status === "ativo" || c.status === "trial" ? c.mrr : 0),
    0
  );

  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = {
      todas: todas.length,
      ativo: 0,
      trial: 0,
      inadimplente: 0,
      suspenso: 0,
      cancelado: 0,
    };
    todas.forEach((x) => {
      c[x.status] += 1;
    });
    return c;
  }, [todas]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return todas.filter((c) => {
      if (filtro !== "todas" && c.status !== filtro) return false;
      if (!termo) return true;
      return (
        c.nomeNegocio.toLowerCase().includes(termo) ||
        c.consultor.toLowerCase().includes(termo) ||
        c.email.toLowerCase().includes(termo)
      );
    });
  }, [todas, busca, filtro]);

  const temFiltro = busca.trim() !== "" || filtro !== "todas";

  return (
    <div className={styles.page}>
      <PageHeader
        title="Consultorias"
        subtitle={`${totalConsultorias} consultorias na plataforma`}
        actions={
          <Button icon="plus" href="/admin/consultores/novo">
            Nova consultoria
          </Button>
        }
      />

      <div className={styles.metrics}>
        <MetricCard
          label="Consultorias"
          value={totalConsultorias}
          sub="Contas na plataforma"
          icon="building-store"
        />
        <MetricCard
          label="Alunos ativos"
          value={totalAlunos}
          sub="Somados de todas as consultorias"
          icon="users"
        />
        <MetricCard
          label="MRR da plataforma"
          value={brl(mrr)}
          sub="Assinaturas ativas e trial"
          icon="currency-dollar"
        />
      </div>

      <div className={styles.controls}>
        <div className={styles.search}>
          <Input
            icon="search"
            placeholder="Buscar por nome, negócio ou e-mail"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className={styles.chips}>
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
      </div>

      <Card padded={false}>
        {lista.length === 0 ? (
          <EmptyState
            icon="search-off"
            title="Nenhuma consultoria encontrada"
            description="Ajuste a busca ou os filtros para ver outras consultorias."
            action={
              <Button
                variant="outline"
                icon="rotate"
                onClick={() => {
                  setBusca("");
                  setFiltro("todas");
                }}
              >
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <div className={styles.list}>
            {lista.map((c) => {
              const badge = STATUS_CONSULTORIA[c.status];
              const verDetalhes = () => router.push(`/admin/consultores/${c.id}`);
              return (
                <ListRow
                  key={c.id}
                  onClick={verDetalhes}
                  leading={<Avatar name={c.consultor} />}
                  title={<span className={styles.nome}>{c.nomeNegocio}</span>}
                  action={
                    <div className={styles.rowActions}>
                      <StatusBadge variant={badge.variant}>
                        {badge.label}
                      </StatusBadge>
                      <span className={styles.alunos}>
                        <i className="ti ti-users" aria-hidden />
                        {c.alunosAtivos} alunos
                      </span>
                      <KebabMenu
                        items={[
                          {
                            label: "Ver detalhes",
                            icon: "eye",
                            onClick: verDetalhes,
                          },
                          {
                            label: "Editar",
                            icon: "pencil",
                            onClick: () =>
                              router.push(`/admin/consultores/${c.id}/editar`),
                          },
                          {
                            label:
                              c.status === "suspenso" ? "Reativar" : "Suspender",
                            icon:
                              c.status === "suspenso"
                                ? "player-play"
                                : "player-pause",
                          },
                          {
                            label: "Excluir",
                            icon: "trash",
                            danger: true,
                            separatorBefore: true,
                          },
                        ]}
                      />
                    </div>
                  }
                  meta={
                    <>
                      {c.consultor} · {planoPlataformaNome(c.planoPlataformaId)} ·
                      MRR {brl(c.mrr)} · {c.cidade}
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

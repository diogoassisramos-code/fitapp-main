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
  Modal,
  StatusBadge,
} from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import {
  listAlunosPlataforma,
  listConsultorias,
  type AlunoPlataforma,
} from "@/lib/admin";
import { dataCurta } from "@/lib/format";
import styles from "./alunos.module.css";

type StatusFiltro = "todos" | "ativo" | "inativo";

export default function AlunosPlataformaPage() {
  const router = useRouter();
  const alunos = useMemo(() => listAlunosPlataforma(), []);
  const consultorias = useMemo(() => listConsultorias(), []);

  const [busca, setBusca] = useState("");
  const [consultoriaId, setConsultoriaId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFiltro>("todos");
  const [novoOpen, setNovoOpen] = useState(false);

  const total = alunos.length;
  const ativos = alunos.filter((a) => a.status === "ativo").length;
  const inativos = total - ativos;

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return alunos.filter((a) => {
      if (consultoriaId && a.consultoriaId !== consultoriaId) return false;
      if (status !== "todos" && a.status !== status) return false;
      if (q) {
        const alvo = `${a.nome} ${a.consultor} ${a.objetivo}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
  }, [alunos, busca, consultoriaId, status]);

  const statusFiltros: { key: StatusFiltro; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "ativo", label: "Ativos" },
    { key: "inativo", label: "Inativos" },
  ];

  function countConsultoria(id: string | null) {
    if (!id) return alunos.length;
    return alunos.filter((a) => a.consultoriaId === id).length;
  }

  return (
    <>
      <PageHeader
        title="Alunos da plataforma"
        subtitle={`${total} alunos em todas as consultorias`}
        actions={
          <Button icon="plus" onClick={() => setNovoOpen(true)}>
            Novo aluno
          </Button>
        }
      />

      <div className={styles.metrics}>
        <MetricCard label="Total de alunos" value={total} icon="users" />
        <MetricCard
          label="Ativos"
          value={ativos}
          sub={`${Math.round((ativos / total) * 100)}% da base`}
          icon="user-check"
        />
        <MetricCard label="Inativos" value={inativos} icon="user-off" />
        <MetricCard
          label="Consultorias com alunos"
          value={new Set(alunos.map((a) => a.consultoriaId)).size}
          icon="building-store"
        />
      </div>

      <Card padded className={styles.filtros}>
        <div className={styles.buscaRow}>
          <Input
            icon="search"
            placeholder="Buscar por nome, consultor ou objetivo…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar alunos"
          />
          <div className={styles.statusGroup}>
            {statusFiltros.map((s) => (
              <Chip
                key={s.key}
                selected={status === s.key}
                onClick={() => setStatus(s.key)}
              >
                {s.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className={styles.consultoriaRow}>
          <Chip
            selected={consultoriaId === null}
            onClick={() => setConsultoriaId(null)}
            count={countConsultoria(null)}
          >
            Todas
          </Chip>
          {consultorias.map((c) => (
            <Chip
              key={c.id}
              selected={consultoriaId === c.id}
              onClick={() => setConsultoriaId(c.id)}
              count={countConsultoria(c.id)}
            >
              {c.nomeNegocio}
            </Chip>
          ))}
        </div>
      </Card>

      <div className={styles.resultInfo}>
        {filtrados.length} {filtrados.length === 1 ? "aluno" : "alunos"}
      </div>

      <Card padded={false}>
        {filtrados.length === 0 ? (
          <EmptyState
            icon="user-search"
            title="Nenhum aluno encontrado"
            description="Ajuste a busca ou os filtros para ver outros alunos."
            action={
              <Button
                variant="outline"
                icon="filter-off"
                onClick={() => {
                  setBusca("");
                  setConsultoriaId(null);
                  setStatus("todos");
                }}
              >
                Limpar filtros
              </Button>
            }
          />
        ) : (
          filtrados.map((a) => (
            <AlunoRow key={a.id} aluno={a} router={router} />
          ))
        )}
      </Card>

      <Modal
        open={novoOpen}
        onClose={() => setNovoOpen(false)}
        title="Novo aluno"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNovoOpen(false)}>
              Cancelar
            </Button>
            <Button icon="check" onClick={() => setNovoOpen(false)}>
              Criar aluno
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <Input label="Nome do aluno" placeholder="Ex.: Ana Paula Souza" />
          <Input label="Objetivo" placeholder="Ex.: Hipertrofia" />
          <Input
            label="Consultoria"
            placeholder="Ex.: CoachFit"
            hint="Protótipo — o cadastro não é persistido."
          />
        </div>
      </Modal>
    </>
  );
}

function AlunoRow({
  aluno,
  router,
}: {
  aluno: AlunoPlataforma;
  router: ReturnType<typeof useRouter>;
}) {
  const ativo = aluno.status === "ativo";
  return (
    <ListRow
      onClick={() => router.push(`/admin/alunos/${aluno.id}`)}
      leading={<Avatar name={aluno.nome} />}
      title={aluno.nome}
      action={
        <div className={styles.rowActions}>
          <StatusBadge variant={ativo ? "ok" : "off"}>
            {ativo ? "Ativo" : "Inativo"}
          </StatusBadge>
          <KebabMenu
            items={[
              {
                label: "Ver perfil completo",
                icon: "user-circle",
                onClick: () => router.push(`/admin/alunos/${aluno.id}`),
              },
              {
                label: "Ver consultoria",
                icon: "building-store",
                onClick: () =>
                  router.push(`/admin/consultores/${aluno.consultoriaId}`),
              },
              { label: "Editar", icon: "pencil", onClick: () => {} },
              {
                label: "Remover",
                icon: "trash",
                danger: true,
                separatorBefore: true,
                onClick: () => {},
              },
            ]}
          />
        </div>
      }
      meta={`${aluno.consultor} · ${aluno.objetivo} · desde ${dataCurta(
        aluno.desde,
      )}`}
    />
  );
}

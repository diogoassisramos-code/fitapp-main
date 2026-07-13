"use client";

import { useEffect, useMemo, useState } from "react";
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
  adminFetchAlunos,
  adminFetchConsultorias,
  adminCreateAluno,
  adminUpdateAluno,
  adminDeleteAluno,
  type AdminAluno,
  type AdminConsultoria,
} from "@/lib/adminDb";
import { dataCurta } from "@/lib/format";
import styles from "./alunos.module.css";

type StatusFiltro = "todos" | "ativo" | "inativo";
type FormState = { nome: string; objetivo: string; email: string; telefone: string; consultoriaId: string };
const FORM_VAZIO: FormState = { nome: "", objetivo: "", email: "", telefone: "", consultoriaId: "" };

export default function AlunosPlataformaPage() {
  const router = useRouter();
  const [alunos, setAlunos] = useState<AdminAluno[] | null>(null);
  const [consultorias, setConsultorias] = useState<AdminConsultoria[]>([]);

  const [busca, setBusca] = useState("");
  const [consultoriaId, setConsultoriaId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFiltro>("todos");

  // Modal criar/editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const carregar = () => {
    adminFetchAlunos().then(setAlunos).catch(() => setAlunos([]));
    adminFetchConsultorias().then(setConsultorias).catch(() => {});
  };
  useEffect(() => {
    carregar();
  }, []);

  const todos = alunos ?? [];
  const total = todos.length;
  const ativos = todos.filter((a) => a.status === "ativo").length;
  const inativos = total - ativos;

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return todos.filter((a) => {
      if (consultoriaId && a.consultoriaId !== consultoriaId) return false;
      if (status !== "todos" && a.status !== status) return false;
      if (q && !`${a.nome} ${a.consultor} ${a.objetivo}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [todos, busca, consultoriaId, status]);

  const statusFiltros: { key: StatusFiltro; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "ativo", label: "Ativos" },
    { key: "inativo", label: "Inativos" },
  ];

  const countConsultoria = (cid: string | null) =>
    cid ? todos.filter((a) => a.consultoriaId === cid).length : todos.length;

  function abrirCriar() {
    setEditId(null);
    setErroForm(null);
    setForm({ ...FORM_VAZIO, consultoriaId: consultorias[0]?.id ?? "" });
    setModalOpen(true);
  }

  function abrirEditar(a: AdminAluno) {
    setEditId(a.id);
    setErroForm(null);
    setForm({ nome: a.nome, objetivo: a.objetivo, email: a.email, telefone: a.telefone, consultoriaId: a.consultoriaId });
    setModalOpen(true);
  }

  async function salvar() {
    setErroForm(null);
    if (!form.nome.trim()) {
      setErroForm("Informe o nome do aluno.");
      return;
    }
    if (!editId && !form.consultoriaId) {
      setErroForm("Selecione a consultoria.");
      return;
    }
    setSalvando(true);
    try {
      if (editId) {
        await adminUpdateAluno(editId, {
          nome: form.nome.trim(),
          objetivo: form.objetivo.trim(),
          email: form.email.trim(),
          telefone: form.telefone.trim(),
          consultoriaId: form.consultoriaId,
        });
      } else {
        await adminCreateAluno({
          consultoriaId: form.consultoriaId,
          nome: form.nome.trim(),
          objetivo: form.objetivo.trim(),
          email: form.email.trim(),
          telefone: form.telefone.trim(),
        });
      }
      setModalOpen(false);
      carregar();
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(a: AdminAluno) {
    if (!confirm(`Remover o aluno "${a.nome}"? Ação irreversível.`)) return;
    try {
      await adminDeleteAluno(a.id);
      carregar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Falha ao remover.");
    }
  }

  return (
    <>
      <PageHeader
        title="Alunos da plataforma"
        subtitle={`${total} alunos em todas as consultorias`}
        actions={
          <Button icon="plus" onClick={abrirCriar}>
            Novo aluno
          </Button>
        }
      />

      <div className={styles.metrics}>
        <MetricCard label="Total de alunos" value={total} icon="users" />
        <MetricCard label="Ativos" value={ativos} sub={total ? `${Math.round((ativos / total) * 100)}% da base` : "0%"} icon="user-check" />
        <MetricCard label="Inativos" value={inativos} icon="user-off" />
        <MetricCard label="Consultorias com alunos" value={new Set(todos.map((a) => a.consultoriaId)).size} icon="building-store" />
      </div>

      <Card padded className={styles.filtros}>
        <div className={styles.buscaRow}>
          <Input icon="search" placeholder="Buscar por nome, consultor ou objetivo…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar alunos" />
          <div className={styles.statusGroup}>
            {statusFiltros.map((s) => (
              <Chip key={s.key} selected={status === s.key} onClick={() => setStatus(s.key)}>
                {s.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className={styles.consultoriaRow}>
          <Chip selected={consultoriaId === null} onClick={() => setConsultoriaId(null)} count={countConsultoria(null)}>
            Todas
          </Chip>
          {consultorias.map((c) => (
            <Chip key={c.id} selected={consultoriaId === c.id} onClick={() => setConsultoriaId(c.id)} count={countConsultoria(c.id)}>
              {c.nomeNegocio}
            </Chip>
          ))}
        </div>
      </Card>

      <div className={styles.resultInfo}>
        {alunos === null ? "Carregando…" : `${filtrados.length} ${filtrados.length === 1 ? "aluno" : "alunos"}`}
      </div>

      <Card padded={false}>
        {alunos === null ? null : filtrados.length === 0 ? (
          <EmptyState
            icon="user-search"
            title="Nenhum aluno encontrado"
            description="Ajuste a busca ou os filtros para ver outros alunos."
            action={
              <Button variant="outline" icon="filter-off" onClick={() => { setBusca(""); setConsultoriaId(null); setStatus("todos"); }}>
                Limpar filtros
              </Button>
            }
          />
        ) : (
          filtrados.map((a) => (
            <ListRow
              key={a.id}
              onClick={() => router.push(`/admin/alunos/${a.id}`)}
              leading={<Avatar name={a.nome} />}
              title={a.nome}
              action={
                <div className={styles.rowActions}>
                  <StatusBadge variant={a.status === "ativo" ? "ok" : "off"}>
                    {a.status === "ativo" ? "Ativo" : "Inativo"}
                  </StatusBadge>
                  <KebabMenu
                    items={[
                      { label: "Ver perfil completo", icon: "user-circle", onClick: () => router.push(`/admin/alunos/${a.id}`) },
                      { label: "Ver consultoria", icon: "building-store", onClick: () => router.push(`/admin/consultores/${a.consultoriaId}`) },
                      { label: "Editar", icon: "pencil", onClick: () => abrirEditar(a) },
                      { label: "Remover", icon: "trash", danger: true, separatorBefore: true, onClick: () => remover(a) },
                    ]}
                  />
                </div>
              }
              meta={`${a.consultor || "—"} · ${a.objetivo || "sem objetivo"}${a.desde ? ` · desde ${dataCurta(a.desde)}` : ""}`}
            />
          ))
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => !salvando && setModalOpen(false)}
        title={editId ? "Editar aluno" : "Novo aluno"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button icon="check" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : editId ? "Salvar" : "Criar aluno"}
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <Input label="Nome do aluno" placeholder="Ex.: Ana Paula Souza" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
          <Input label="Objetivo" placeholder="Ex.: Hipertrofia" value={form.objetivo} onChange={(e) => setForm((f) => ({ ...f, objetivo: e.target.value }))} />
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Consultoria</label>
            <select
              className={styles.select}
              value={form.consultoriaId}
              onChange={(e) => setForm((f) => ({ ...f, consultoriaId: e.target.value }))}
              disabled={!!editId && false}
            >
              <option value="">Selecione…</option>
              {consultorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nomeNegocio} · {c.consultor}
                </option>
              ))}
            </select>
          </div>
          <Input label="E-mail (opcional)" type="email" placeholder="aluno@email.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Input label="Telefone (opcional)" placeholder="(11) 90000-0000" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
          {erroForm && <p style={{ color: "var(--color-text-danger)", fontSize: 13 }}>{erroForm}</p>}
        </div>
      </Modal>
    </>
  );
}

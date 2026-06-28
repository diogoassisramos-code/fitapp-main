"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  ListRow,
  StatusBadge,
} from "@/components/ui";
import {
  adminFindAluno,
  adminListConsultorias,
  adminSetAlunoConsultoria,
  type AdminAlunoResult,
  type AdminConsultoria,
} from "@/lib/db";
import { supabaseEnabled } from "@/lib/supabaseEnabled";

export default function VincularAlunoPage() {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<AdminAlunoResult[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [sel, setSel] = useState<AdminAlunoResult | null>(null);
  const [consultorias, setConsultorias] = useState<AdminConsultoria[]>([]);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (supabaseEnabled) {
      adminListConsultorias().then(setConsultorias).catch(() => {});
    }
  }, []);

  async function buscar() {
    setErro(null);
    setMsg(null);
    setSel(null);
    if (!q.trim()) return;
    setBuscando(true);
    try {
      const r = await adminFindAluno(q);
      setResultados(r);
      setBuscou(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha na busca.");
    } finally {
      setBuscando(false);
    }
  }

  function selecionar(a: AdminAlunoResult) {
    setSel(a);
    setTrainerId(a.consultoriaId);
    setMsg(null);
    setErro(null);
  }

  async function vincular() {
    if (!sel || !trainerId) return;
    setSalvando(true);
    setErro(null);
    setMsg(null);
    try {
      await adminSetAlunoConsultoria(sel.id, trainerId);
      const nome = consultorias.find((c) => c.id === trainerId)?.nome ?? "";
      setMsg(`${sel.nome} agora está com o treinador ${nome}.`);
      const atualizado = { ...sel, consultoriaId: trainerId, consultoriaNome: nome };
      setSel(atualizado);
      setResultados((rs) => rs.map((r) => (r.id === sel.id ? atualizado : r)));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao vincular.");
    } finally {
      setSalvando(false);
    }
  }

  if (!supabaseEnabled) {
    return (
      <>
        <PageHeader
          title="Vincular aluno a treinador"
          subtitle="Disponível quando o banco está configurado."
        />
        <Card padded>
          <EmptyState
            icon="database-off"
            title="Banco não configurado"
            description="Configure o Supabase (.env.local) e entre como admin para vincular alunos."
          />
        </Card>
      </>
    );
  }

  const mudou = !!sel && trainerId !== sel.consultoriaId;

  return (
    <>
      <PageHeader
        title="Vincular aluno a treinador"
        subtitle="Busque por CPF ou ID e defina ou troque o treinador do aluno."
      />

      {/* Busca */}
      <Card padded>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <Input
              icon="search"
              label="CPF ou ID do aluno"
              placeholder="000.000.000-00 ou UUID"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") buscar();
              }}
              aria-label="Buscar aluno por CPF ou ID"
            />
          </div>
          <Button icon="search" onClick={buscar} disabled={buscando || !q.trim()}>
            {buscando ? "Buscando…" : "Buscar"}
          </Button>
        </div>
        {erro && (
          <p style={{ color: "var(--color-text-danger)", fontSize: 13, margin: "8px 0 0" }}>
            {erro}
          </p>
        )}
      </Card>

      {/* Resultados */}
      {buscou && (
        <Card padded={false}>
          {resultados.length === 0 ? (
            <EmptyState
              icon="user-search"
              title="Nenhum aluno encontrado"
              description="Confira o CPF ou o ID e tente novamente."
              compact
            />
          ) : (
            resultados.map((a) => (
              <ListRow
                key={a.id}
                leading={<Avatar name={a.nome} />}
                title={a.nome}
                onClick={() => selecionar(a)}
                action={
                  <StatusBadge variant={sel?.id === a.id ? "ok" : "off"}>
                    {sel?.id === a.id ? "Selecionado" : "Selecionar"}
                  </StatusBadge>
                }
                meta={`${a.cpf ?? "sem CPF"} · Treinador: ${
                  a.consultoriaNome ?? "—"
                }`}
              />
            ))
          )}
        </Card>
      )}

      {/* Painel de vínculo */}
      {sel && (
        <Card>
          <CardHeader title={`Treinador de ${sel.nome}`} />
          <CardBody>
            <p
              style={{
                fontSize: 14,
                color: "var(--color-text-secondary)",
                margin: "0 0 12px",
              }}
            >
              Treinador atual:{" "}
              <strong>{sel.consultoriaNome ?? "Sem treinador"}</strong>
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {consultorias.map((c) => (
                <ListRow
                  key={c.id}
                  title={c.nome}
                  onClick={() => setTrainerId(c.id)}
                  action={
                    <StatusBadge variant={trainerId === c.id ? "ok" : "off"}>
                      {trainerId === c.id ? "Escolhido" : "Escolher"}
                    </StatusBadge>
                  }
                />
              ))}
            </div>
            {msg && (
              <p
                style={{
                  color: "var(--color-text-success)",
                  fontSize: 14,
                  margin: "12px 0 0",
                }}
              >
                {msg}
              </p>
            )}
            <div style={{ marginTop: 16 }}>
              <Button icon="link" onClick={vincular} disabled={!mudou || salvando}>
                {salvando
                  ? "Vinculando…"
                  : mudou
                    ? "Vincular treinador"
                    : "Treinador atual"}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </>
  );
}

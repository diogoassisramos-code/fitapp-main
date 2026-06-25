"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  Input,
  ListRow,
  Avatar,
  StatusBadge,
  EmptyState,
} from "@/components/ui";
import { listAlunos, planoNome } from "@/lib/data";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { fetchAlunos } from "@/lib/db";
import {
  STATUS_PAGAMENTO,
  dataCurta,
  estaAtrasada,
} from "@/lib/format";
import type { Aluno } from "@/lib/types";
import { getTestAlunos, type TestAluno } from "@/lib/testAlunos";
import styles from "./alunos.module.css";

type FiltroId = "todos" | "atrasados" | "checkin" | "protocolo" | "novos";

export default function AlunosPage() {
  const router = useRouter();

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroId>("todos");

  // Sem Supabase: mock. Com Supabase: alunos da consultoria (RLS).
  const [todos, setTodos] = useState<Aluno[]>(() =>
    supabaseEnabled ? [] : listAlunos()
  );

  const [mounted, setMounted] = useState(false);
  const [testAlunos, setTestAlunos] = useState<TestAluno[]>([]);
  useEffect(() => {
    setMounted(true);
    if (supabaseEnabled) {
      fetchAlunos().then(setTodos).catch(() => {});
    } else {
      setTestAlunos(getTestAlunos());
    }
  }, []);

  const ativos = useMemo(
    () => todos.filter((a) => a.statusPagamento !== "novo").length,
    [todos],
  );

  const contadores = useMemo(
    () => ({
      todos: todos.length,
      atrasados: todos.filter((a) => a.statusPagamento === "atrasado").length,
      checkin: todos.filter((a) => a.checkinPendente).length,
      protocolo: todos.filter((a) => a.aguardandoProtocolo).length,
      novos: todos.filter((a) => a.statusPagamento === "novo").length,
    }),
    [todos],
  );

  const filtros: { id: FiltroId; label: string; count: number }[] = [
    { id: "todos", label: "Todos", count: contadores.todos },
    { id: "atrasados", label: "Atrasados", count: contadores.atrasados },
    { id: "checkin", label: "Check-in pendente", count: contadores.checkin },
    { id: "protocolo", label: "Aguardando protocolo", count: contadores.protocolo },
    { id: "novos", label: "Novos", count: contadores.novos },
  ];

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return todos.filter((a) => {
      if (filtro === "atrasados" && a.statusPagamento !== "atrasado") return false;
      if (filtro === "checkin" && !a.checkinPendente) return false;
      if (filtro === "protocolo" && !a.aguardandoProtocolo) return false;
      if (filtro === "novos" && a.statusPagamento !== "novo") return false;

      if (termo) {
        const alvo = `${a.nome} ${a.email} ${a.objetivo}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [todos, filtro, busca]);

  return (
    <div className={styles.page}>
      <PageHeader
        title="Alunos"
        subtitle={`${ativos} ativos`}
        actions={
          <Button icon="plus" href="/alunos/novo">
            Novo aluno
          </Button>
        }
      />

      {mounted && !supabaseEnabled && (
        <div
          className={`${styles.expBanner} ${
            testAlunos.length >= 3 ? styles.expBannerWarn : ""
          }`}
        >
          <i className="ti ti-flask" aria-hidden />
          <span>
            Modelo experimental · {testAlunos.length}/3 alunos de teste
          </span>
        </div>
      )}

      {mounted && testAlunos.length > 0 && (
        <Card padded={false}>
          <CardHeader title="Convites pendentes" />
          <div className={styles.list}>
            {testAlunos.map((t) => (
              <TestAlunoRow key={t.id} aluno={t} router={router} />
            ))}
          </div>
        </Card>
      )}

      <div className={styles.controls}>
        <Input
          icon="search"
          placeholder="Buscar por nome, e-mail ou objetivo"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar alunos"
        />
        <div className={styles.chips}>
          {filtros.map((f) => (
            <Chip
              key={f.id}
              selected={filtro === f.id}
              count={f.count}
              onClick={() => setFiltro(f.id)}
            >
              {f.label}
            </Chip>
          ))}
        </div>
      </div>

      <Card padded={false}>
        {filtrados.length === 0 ? (
          <EmptyState
            icon="users"
            title="Nenhum aluno encontrado"
            description="Tente ajustar a busca ou trocar o filtro selecionado."
          />
        ) : (
          <div className={styles.list}>
            {filtrados.map((a) => (
              <AlunoRow key={a.id} aluno={a} router={router} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function AlunoRow({
  aluno,
  router,
}: {
  aluno: Aluno;
  router: ReturnType<typeof useRouter>;
}) {
  const pgto = STATUS_PAGAMENTO[aluno.statusPagamento];
  const atrasada = estaAtrasada(aluno.proximoVencimento);

  const temPendencia = aluno.checkinPendente || aluno.aguardandoProtocolo;

  const tags = (
    <span className={styles.tagGroup}>
      {aluno.checkinPendente && (
        <StatusBadge variant="new" icon="message-circle" noDot>
          Check-in pra responder
        </StatusBadge>
      )}
      {aluno.aguardandoProtocolo && (
        <Link
          href={`/alunos/${aluno.id}/treino`}
          className={styles.protocoloLink}
          onClick={(e) => e.stopPropagation()}
        >
          <StatusBadge variant="pending" icon="clipboard-list" noDot>
            Aguardando protocolo
          </StatusBadge>
        </Link>
      )}
      {!temPendencia && (
        <StatusBadge variant="ok" noDot>
          Tudo em dia
        </StatusBadge>
      )}
    </span>
  );

  const meta = (
    <span className={styles.meta}>
      {aluno.planoId ? `${planoNome(aluno.planoId)} · ` : ""}
      {aluno.objetivo} · vence{" "}
      <span className={atrasada ? styles.vencido : undefined}>
        {dataCurta(aluno.proximoVencimento)}
      </span>
    </span>
  );

  return (
    <ListRow
      leading={<Avatar name={aluno.nome} />}
      title={<span className={styles.nome}>{aluno.nome}</span>}
      action={<StatusBadge variant={pgto.variant}>{pgto.label}</StatusBadge>}
      meta={meta}
      tags={tags}
      onClick={() => router.push(`/alunos/${aluno.id}`)}
    />
  );
}

function TestAlunoRow({
  aluno,
  router,
}: {
  aluno: TestAluno;
  router: ReturnType<typeof useRouter>;
}) {
  const meta = (
    <span className={styles.meta}>
      {(aluno.idade ? `${aluno.idade} anos · ` : "") +
        (aluno.objetivo || "Aguardando cadastro")}
    </span>
  );

  const tags = (
    <span className={styles.tagGroup}>
      <StatusBadge variant="pending" icon="mail" noDot>
        Convite pendente
      </StatusBadge>
    </span>
  );

  return (
    <ListRow
      leading={<Avatar name={aluno.nome} />}
      title={<span className={styles.nome}>{aluno.nome}</span>}
      action={<StatusBadge variant="new">Novo</StatusBadge>}
      meta={meta}
      tags={tags}
      onClick={() => router.push(`/alunos/${aluno.id}`)}
    />
  );
}

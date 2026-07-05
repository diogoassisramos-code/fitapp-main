"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  MetricCard,
  StatusBadge,
  Chip,
  Input,
  ListRow,
  Avatar,
  EmptyState,
} from "@/components/ui";
import { listAlunos, stats, planoNome } from "@/lib/data";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { fetchAlunos, fetchConsultoriaResumo } from "@/lib/db";
import { useConsultor } from "@/lib/useConsultor";
import type { Aluno } from "@/lib/types";
import {
  brl,
  dataCurta,
  estaAtrasada,
  STATUS_PAGAMENTO,
} from "@/lib/format";
import styles from "./home.module.css";

type FiltroId =
  | "todos"
  | "atrasados"
  | "checkin"
  | "protocolo"
  | "novos";

const FILTROS: { id: FiltroId; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "atrasados", label: "Atrasados" },
  { id: "checkin", label: "Check-in pendente" },
  { id: "protocolo", label: "Aguardando protocolo" },
  { id: "novos", label: "Novos" },
];

export default function ResumoPage() {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroId>("todos");

  const consultor = useConsultor();
  const primeiroNome = consultor.nome.split(/\s+/)[0];

  // Sem Supabase: mock. Com Supabase: lê os alunos da consultoria (RLS filtra).
  const [alunos, setAlunos] = useState<Aluno[]>(() =>
    supabaseEnabled ? [] : listAlunos()
  );
  const [saldo, setSaldo] = useState<number>(supabaseEnabled ? 0 : stats.saldo);
  const [carregando, setCarregando] = useState(supabaseEnabled);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let active = true;
    setErro(false);
    setCarregando(true);
    // Falha (rede/RLS/sessão) mostra erro com retry — não "0 alunos / saldo R$ 0".
    Promise.all([fetchAlunos(), fetchConsultoriaResumo()])
      .then(([as, r]) => {
        if (!active) return;
        setAlunos(as);
        setSaldo(r.saldo);
      })
      .catch(() => active && setErro(true))
      .finally(() => active && setCarregando(false));
    return () => {
      active = false;
    };
  }, [tentativa]);

  // KPIs do topo + triagem: derivados dos dados REAIS (0 numa conta nova) quando
  // há Supabase; senão, os números do mock. Faturamento real depende da tabela
  // de transações/gateway (ainda não existe) — por isso 0 pra conta nova.
  const mesRef = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const resumo = supabaseEnabled
    ? {
        alunosAtivos: alunos.filter((a) => a.statusPagamento !== "novo").length,
        totalAlunos: alunos.length,
        novosNoMes: alunos.filter((a) => (a.inicio ?? "").startsWith(mesRef))
          .length,
        faturamento30d: 0,
        faturamento30dDelta: "",
        saldo,
        checkinsParaResponder: alunos.filter((a) => a.checkinPendente).length,
        pagamentosAtrasados: alunos.filter(
          (a) => a.statusPagamento === "atrasado"
        ).length,
        novosSemPlano: alunos.filter((a) => a.statusPagamento === "novo").length,
      }
    : stats;

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return alunos.filter((a) => {
      if (termo && !a.nome.toLowerCase().includes(termo)) return false;
      switch (filtro) {
        case "atrasados":
          return a.statusPagamento === "atrasado";
        case "checkin":
          return a.checkinPendente;
        case "protocolo":
          return a.aguardandoProtocolo;
        case "novos":
          return a.statusPagamento === "novo";
        default:
          return true;
      }
    });
  }, [alunos, busca, filtro]);

  const visiveis = filtrados.slice(0, 6);

  const triagem = [
    {
      key: "checkin",
      valor: resumo.checkinsParaResponder,
      icon: "message-circle",
      label: "Check-ins pra responder",
      tone: "info" as const,
    },
    {
      key: "atrasados",
      valor: resumo.pagamentosAtrasados,
      icon: "alert-triangle",
      label: "Pagamentos atrasados",
      tone: "danger" as const,
    },
    {
      key: "protocolo",
      valor: resumo.novosSemPlano,
      icon: "clipboard-list",
      label: "Novos sem plano",
      tone: "warning" as const,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Revo"
        title={primeiroNome ? `Olá, ${primeiroNome} 👋` : "Olá 👋"}
        subtitle={
          resumo.alunosAtivos +
          " alunos ativos · " +
          brl(resumo.faturamento30d) +
          " nos últimos 30 dias"
        }
        actions={
          <Button icon="plus" href="/alunos/novo">
            Novo aluno
          </Button>
        }
      />

      <section className={styles.metrics}>
        <MetricCard
          label="Alunos ativos"
          value={resumo.alunosAtivos}
          icon="users"
          sub={resumo.totalAlunos + " no total"}
        />
        <MetricCard
          label="Novos no mês"
          value={resumo.novosNoMes}
          icon="user-plus"
        />
        <MetricCard
          label="Faturamento 30d"
          value={brl(resumo.faturamento30d)}
          delta={
            resumo.faturamento30dDelta
              ? { value: resumo.faturamento30dDelta, dir: "up" }
              : undefined
          }
          icon="trending-up"
        />
        <MetricCard
          label="Saldo disponível"
          value={brl(resumo.saldo)}
          icon="wallet"
          action={
            <Button
              variant="outline"
              size="sm"
              icon="arrow-bar-up"
              href="/financeiro"
            >
              Sacar
            </Button>
          }
        />
      </section>

      <section className={styles.triagem}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Precisa de você hoje</h2>
          <span className={styles.sectionSub}>
            Pendências que pedem sua atenção agora.
          </span>
        </div>
        <div className={styles.triagemGrid}>
          {triagem.map((t) =>
            t.valor === 0 ? (
              <div
                key={t.key}
                className={styles.triagemCard}
                data-tone="clear"
              >
                <span className={styles.triagemIcon} data-tone="success">
                  <i className="ti ti-circle-check" aria-hidden />
                </span>
                <div className={styles.triagemBody}>
                  <span className={styles.triagemNumberClear}>Tudo em dia</span>
                  <span className={styles.triagemLabel}>{t.label}</span>
                </div>
              </div>
            ) : (
              <Link
                key={t.key}
                href="/alunos"
                className={styles.triagemCard}
                data-tone={t.tone}
              >
                <span className={styles.triagemIcon} data-tone={t.tone}>
                  <i className={`ti ti-${t.icon}`} aria-hidden />
                </span>
                <div className={styles.triagemBody}>
                  <span className={styles.triagemNumber}>{t.valor}</span>
                  <span className={styles.triagemLabel}>{t.label}</span>
                </div>
                <i
                  className={`ti ti-chevron-right ${styles.triagemChevron}`}
                  aria-hidden
                />
              </Link>
            )
          )}
        </div>
      </section>

      <Card>
        <CardHeader
          title="Alunos"
          action={
            <Button variant="ghost" size="sm" iconRight="arrow-right" href="/alunos">
              Ver todos
            </Button>
          }
        />
        <CardBody>
          <div className={styles.controls}>
            <div className={styles.search}>
              <Input
                icon="search"
                placeholder="Buscar aluno pelo nome"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                aria-label="Buscar aluno"
              />
            </div>
            <div className={styles.chips}>
              {FILTROS.map((f) => (
                <Chip
                  key={f.id}
                  selected={filtro === f.id}
                  onClick={() => setFiltro(f.id)}
                >
                  {f.label}
                </Chip>
              ))}
            </div>
          </div>

          {carregando ? (
            <EmptyState icon="loader" title="Carregando alunos…" compact />
          ) : erro ? (
            <EmptyState
              icon="alert-triangle"
              title="Não foi possível carregar seus alunos"
              description="Verifique a conexão e tente de novo."
              action={
                <Button
                  variant="outline"
                  icon="refresh"
                  onClick={() => setTentativa((t) => t + 1)}
                >
                  Tentar de novo
                </Button>
              }
            />
          ) : visiveis.length === 0 ? (
            <EmptyState
              icon="user-search"
              title="Nenhum aluno encontrado"
              description="Ajuste a busca ou troque o filtro para ver seus alunos."
            />
          ) : (
            <div className={styles.lista}>
              {visiveis.map((a) => {
                const status = STATUS_PAGAMENTO[a.statusPagamento];
                const atrasada = estaAtrasada(a.proximoVencimento);
                return (
                  <ListRow
                    key={a.id}
                    onClick={() => router.push("/alunos/" + a.id)}
                    leading={<Avatar name={a.nome} />}
                    title={a.nome}
                    action={
                      <StatusBadge variant={status.variant}>
                        {status.label}
                      </StatusBadge>
                    }
                    meta={
                      <>
                        {a.planoId ? `${planoNome(a.planoId)} · ` : ""}
                        {a.objetivo || "Sem objetivo definido"}
                        {a.proximoVencimento ? (
                          <>
                            {" "}
                            · vence{" "}
                            <span
                              className={
                                atrasada ? styles.venceAtrasada : undefined
                              }
                            >
                              {dataCurta(a.proximoVencimento)}
                            </span>
                          </>
                        ) : null}
                      </>
                    }
                    tags={
                      <>
                        {a.checkinPendente && (
                          <StatusBadge
                            variant="new"
                            icon="message-circle"
                            noDot
                          >
                            Check-in pra responder
                          </StatusBadge>
                        )}
                        {a.aguardandoProtocolo && (
                          <StatusBadge
                            variant="pending"
                            icon="clipboard-list"
                            noDot
                          >
                            Aguardando protocolo
                          </StatusBadge>
                        )}
                      </>
                    }
                  />
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}

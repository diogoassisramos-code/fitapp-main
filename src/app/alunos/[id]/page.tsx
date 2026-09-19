import {
  Card,
  CardBody,
  CardHeader,
  MetricCard,
  StatusBadge,
  Button,
  Avatar,
} from "@/components/ui";
import { TestAlunoFicha } from "@/components/screens/test-aluno/TestAlunoFicha";
import { FichaCheckins } from "./FichaCheckins";
import { FichaAnamnese } from "./FichaAnamnese";
import { GerenciarAssinatura } from "./GerenciarAssinatura";
import {
  getAluno,
  getTreino,
  getDieta,
  getProtocolo,
  getPlano,
  planoNome,
} from "@/lib/data";
import {
  brl,
  dataLonga,
  STATUS_PAGAMENTO,
  MODALIDADE_LABEL,
} from "@/lib/format";
import type { Aluno, Dieta, Protocolo } from "@/lib/types";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { asaasEnabled } from "@/lib/asaasEnabled";
import { getAssinatura } from "@/lib/asaas";
import { createClient as createServerSupabase } from "@/utils/supabase/server";
import styles from "./ficha.module.css";

/** Sufixo do valor por recorrência do plano (anual → /ano). */
const RECOR_SUFIXO: Record<string, string> = {
  semanal: "/semana",
  mensal: "/mês",
  trimestral: "/trimestre",
  anual: "/ano",
};

/** Dieta do aluno no Supabase (server-side; o card usa metaKcal + nº de refeições). */
async function fetchDietaFromDb(alunoId: string): Promise<Dieta | undefined> {
  const supabase = await createServerSupabase();
  const { data: d, error } = await supabase
    .from("dietas")
    .select("*")
    .eq("aluno_id", alunoId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !d) return undefined; // tabela ainda não criada → sem dieta
  const { data: refs } = await supabase
    .from("refeicoes")
    .select("id,ordem,nome,horario,observacoes")
    .eq("dieta_id", d.id)
    .order("ordem");
  return {
    id: d.id,
    alunoId: d.aluno_id,
    metaKcal: Number(d.meta_kcal ?? 0),
    rascunho: !!d.rascunho,
    /* eslint-disable @typescript-eslint/no-explicit-any */
    refeicoes: (refs ?? []).map((r: any) => ({
      id: r.id,
      ordem: r.ordem ?? 0,
      nome: r.nome,
      horario: r.horario ?? "",
      observacoes: r.observacoes ?? undefined,
      alimentos: [],
    })),
  };
}

/** Protocolo do aluno no Supabase (server-side; o card usa nº de itens). */
async function fetchProtocoloFromDb(
  alunoId: string
): Promise<Protocolo | undefined> {
  const supabase = await createServerSupabase();
  const { data: p, error } = await supabase
    .from("protocolos")
    .select("*")
    .eq("aluno_id", alunoId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !p) return undefined; // tabela ainda não criada → sem protocolo
  const { data: blocos } = await supabase
    .from("protocolo_blocos")
    .select("id,ordem,nome")
    .eq("protocolo_id", p.id)
    .order("ordem");
  const blocoIds = (blocos ?? []).map((b: any) => b.id);
  let itens: any[] = [];
  if (blocoIds.length) {
    const { data: it } = await supabase
      .from("protocolo_itens")
      .select("id,bloco_id")
      .in("bloco_id", blocoIds);
    itens = it ?? [];
  }
  return {
    id: p.id,
    alunoId: p.aluno_id,
    rascunho: !!p.rascunho,
    blocos: (blocos ?? []).map((b: any) => ({
      id: b.id,
      ordem: b.ordem ?? 0,
      nome: b.nome,
      itens: itens.filter((x) => x.bloco_id === b.id),
    })),
  };
}

/**
 * Resumo do SPLIT de treinos do aluno (Supabase, server-side): quantos treinos e
 * o total de exercícios. A ficha mostra "N treinos · X exercícios" (o construtor
 * abre o split completo).
 */
async function fetchTreinosResumo(
  alunoId: string
): Promise<{ qtd: number; exercicios: number; nome: string }> {
  const supabase = await createServerSupabase();
  const { data: treinos } = await supabase
    .from("treinos")
    .select("id, nome")
    .eq("aluno_id", alunoId)
    .order("created_at");
  if (!treinos || treinos.length === 0) return { qtd: 0, exercicios: 0, nome: "" };
  const { count } = await supabase
    .from("exercicios")
    .select("id", { count: "exact", head: true })
    .in(
      "treino_id",
      treinos.map((t) => t.id)
    );
  return { qtd: treinos.length, exercicios: count ?? 0, nome: treinos[0].nome };
}

/** Assinatura do aluno: se existe (habilita cancelar) + próximo vencimento real
 *  (nextDueDate do Asaas). */
async function fetchAssinaturaInfo(
  alunoId: string
): Promise<{ temAssinatura: boolean; proximoVencimento: string | null }> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("alunos")
    .select("asaas_subscription_id")
    .eq("id", alunoId)
    .maybeSingle();
  const subId = (data?.asaas_subscription_id as string) ?? null;
  if (!subId) return { temAssinatura: false, proximoVencimento: null };
  let proximoVencimento: string | null = null;
  if (asaasEnabled) {
    try {
      const a = await getAssinatura(subId);
      proximoVencimento = a.nextDueDate ?? null;
    } catch {
      /* sem o vencimento ao vivo → cai pro do banco */
    }
  }
  return { temAssinatura: true, proximoVencimento };
}

/** Plano REAL do aluno (tabela planos) — nome, preço e recorrência. O mock
 *  getPlano/planoNome não conhece planos do banco (mostrava "—"). */
async function fetchPlanoDb(
  planoId: string
): Promise<{ nome: string; preco: number; periodo: string | null } | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("planos")
    .select("nome, preco, periodo_recorrencia")
    .eq("id", planoId)
    .maybeSingle();
  if (!data) return null;
  return {
    nome: data.nome,
    preco: Number(data.preco ?? 0),
    periodo: (data.periodo_recorrencia as string) ?? null,
  };
}

/** Busca o aluno no Supabase (server-side, sessão via cookie). */
async function fetchAlunoFromDb(id: string): Promise<Aluno | undefined> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("alunos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) return undefined;
  return {
    id: data.id,
    planoId: data.plano_id ?? "",
    nome: data.nome,
    cpf: data.cpf ?? "",
    email: data.email ?? "",
    objetivo: data.objetivo ?? "",
    statusPagamento: data.status_pagamento,
    proximoVencimento: data.proximo_vencimento ?? "",
    inicio: data.inicio ?? "",
    pesoInicial: Number(data.peso_inicial ?? 0),
    pesoAtual: Number(data.peso_atual ?? 0),
    aderenciaTreino: data.aderencia_treino ?? 0,
    checkinPendente: !!data.checkin_pendente,
    aguardandoProtocolo: !!data.aguardando_protocolo,
    checkinSolicitado: !!data.checkin_solicitado,
    checkinSolicitacaoMsg: data.checkin_solicitacao_msg ?? undefined,
  };
}

/** Último check-in do aluno no Supabase (pra o hero refletir peso/aderência). */
async function fetchUltimoCheckinFromDb(
  alunoId: string
): Promise<{ peso: number; treinosFeitos: number; treinosTotais: number } | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("checkins")
    .select("peso,treinos_feitos,treinos_totais")
    .eq("aluno_id", alunoId)
    .order("semana", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    peso: Number(data.peso ?? 0),
    treinosFeitos: data.treinos_feitos ?? 0,
    treinosTotais: data.treinos_totais ?? 0,
  };
}

export default async function FichaAlunoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let aluno = getAluno(id);
  // Aluno do banco (criado pelo consultor) quando não é seeded.
  if (!aluno && supabaseEnabled) aluno = await fetchAlunoFromDb(id);
  if (!aluno) return <TestAlunoFicha id={id} />;

  // Peso atual e aderência refletem o último check-in enviado (se houver).
  if (supabaseEnabled) {
    const ult = await fetchUltimoCheckinFromDb(aluno.id);
    if (ult) {
      aluno = {
        ...aluno,
        pesoAtual: ult.peso || aluno.pesoAtual,
        aderenciaTreino:
          ult.treinosTotais > 0
            ? Math.round((ult.treinosFeitos / ult.treinosTotais) * 100)
            : aluno.aderenciaTreino,
      };
    }
  }

  const status = STATUS_PAGAMENTO[aluno.statusPagamento];
  const plano = getPlano(aluno.planoId);
  const modalidade = plano?.modalidade
    ? MODALIDADE_LABEL[plano.modalidade]
    : null;

  const deltaPeso = aluno.pesoAtual - aluno.pesoInicial;
  const deltaPesoStr = `${deltaPeso >= 0 ? "+" : ""}${deltaPeso.toFixed(1)} kg`;

  const treinoMock = getTreino(aluno.id);
  const treinoResumo = treinoMock
    ? { qtd: 1, exercicios: treinoMock.exercicios.length, nome: treinoMock.nome }
    : supabaseEnabled
      ? await fetchTreinosResumo(aluno.id)
      : { qtd: 0, exercicios: 0, nome: "" };
  let dieta = getDieta(aluno.id);
  if (!dieta && supabaseEnabled) dieta = await fetchDietaFromDb(aluno.id);
  let protocolo = getProtocolo(aluno.id);
  if (!protocolo && supabaseEnabled)
    protocolo = await fetchProtocoloFromDb(aluno.id);
  const protocoloItens =
    protocolo?.blocos.reduce((acc, b) => acc + b.itens.length, 0) ?? 0;
  // Assinatura + plano REAIS (não o mock) para o card de pagamento.
  const assinaturaInfo = supabaseEnabled
    ? await fetchAssinaturaInfo(aluno.id)
    : { temAssinatura: false, proximoVencimento: null };
  const planoDb =
    supabaseEnabled && aluno.planoId ? await fetchPlanoDb(aluno.planoId) : null;
  const nomePlano =
    planoDb?.nome ?? (aluno.planoId ? planoNome(aluno.planoId) : "Sem plano");
  const valorLabel = planoDb
    ? `${brl(planoDb.preco)}${planoDb.periodo ? " " + (RECOR_SUFIXO[planoDb.periodo] ?? "") : ""}`
    : plano
      ? brl(plano.preco)
      : "—";
  const proximoVencimento =
    assinaturaInfo.proximoVencimento || aluno.proximoVencimento || "";
  const temAssinatura = assinaturaInfo.temAssinatura;
  return (
    <div className={styles.page}>
      {/* 1) Header */}
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <Avatar name={aluno.nome} size={64} />
          <div className={styles.heroText}>
            <h1 className={styles.name}>{aluno.nome}</h1>
            <p className={styles.meta}>
              {modalidade && (
                <>
                  <span>{modalidade}</span>
                  <span className={styles.dot}>·</span>
                </>
              )}
              <span>{nomePlano}</span>
              {aluno.objetivo ? (
                <>
                  <span className={styles.dot}>·</span>
                  <span>{aluno.objetivo}</span>
                </>
              ) : null}
            </p>
            <div className={styles.heroBadge}>
              <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
            </div>
          </div>
        </div>
      </header>

      {/* 2) Métricas */}
      <div className={styles.metrics}>
        <MetricCard
          label="Peso atual"
          value={`${aluno.pesoAtual} kg`}
          delta={{
            value: deltaPesoStr,
            dir: aluno.pesoAtual < aluno.pesoInicial ? "down" : "up",
          }}
          sub={`Inicial ${aluno.pesoInicial} kg`}
          icon="scale"
        />
        <MetricCard
          label="Aderência ao treino"
          value={`${aluno.aderenciaTreino}%`}
          sub="Últimas semanas"
          icon="activity"
        />
        <MetricCard
          label="Próx. vencimento"
          value={proximoVencimento ? dataLonga(proximoVencimento) : "—"}
          sub={status.label}
          icon="calendar"
        />
      </div>

      {/* 3) Protocolo atual */}
      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle}>Protocolo atual</h2>
          <p className={styles.blockSub}>
            O que o aluno está seguindo agora.
          </p>
        </div>
        <div className={styles.protocols}>
          {/* Treino */}
          <Card padded className={styles.protocol}>
            <div className={styles.protoIcon} data-tone="info">
              <i className="ti ti-barbell" aria-hidden />
            </div>
            <span className="mono-label">Treino</span>
            <p className={styles.protoName}>
              {treinoResumo.qtd === 0
                ? "Ainda não montado"
                : treinoResumo.qtd === 1
                  ? treinoResumo.nome
                  : `${treinoResumo.qtd} treinos`}
            </p>
            <p className={styles.protoMeta}>
              {treinoResumo.qtd === 0
                ? "Monte o programa de treino"
                : `${treinoResumo.exercicios} exercício${treinoResumo.exercicios === 1 ? "" : "s"}`}
            </p>
            <div className={styles.protoAction}>
              <Button
                variant="ghost"
                size="sm"
                iconRight={treinoResumo.qtd > 0 ? "arrow-right" : "plus"}
                href={`/alunos/${aluno.id}/treino`}
              >
                {treinoResumo.qtd > 0 ? "Abrir" : "Montar"}
              </Button>
            </div>
          </Card>

          {/* Dieta */}
          <Card padded className={styles.protocol}>
            <div className={styles.protoIcon} data-tone="success">
              <i className="ti ti-salad" aria-hidden />
            </div>
            <span className="mono-label">Dieta</span>
            <p className={styles.protoName}>
              {dieta
                ? `${dieta.refeicoes.reduce(
                    (s, r) =>
                      s + r.alimentos.reduce((x, a) => x + a.macros.kcal, 0),
                    0
                  )} kcal`
                : "Ainda não montada"}
            </p>
            <p className={styles.protoMeta}>
              {dieta
                ? `${dieta.refeicoes.length} refeições`
                : "Monte o plano alimentar"}
            </p>
            <div className={styles.protoAction}>
              <Button
                variant="ghost"
                size="sm"
                iconRight={dieta ? "arrow-right" : "plus"}
                href={`/alunos/${aluno.id}/dieta`}
              >
                {dieta ? "Abrir" : "Montar"}
              </Button>
            </div>
          </Card>

          {/* Protocolos extras */}
          <Card padded className={styles.protocol}>
            <div className={styles.protoIcon} data-tone="warning">
              <i className="ti ti-pill" aria-hidden />
            </div>
            <span className="mono-label">Protocolos extras</span>
            <p className={styles.protoName}>
              {protocolo ? `${protocoloItens} itens` : "Ainda não montado"}
            </p>
            <p className={styles.protoMeta}>
              {protocolo
                ? protocolo.blocos.map((b) => b.nome).join(" · ")
                : "Suplementos, manipulados e mais"}
            </p>
            <div className={styles.protoAction}>
              <Button
                variant="ghost"
                size="sm"
                iconRight={protocolo ? "arrow-right" : "plus"}
                href={`/alunos/${aluno.id}/protocolo`}
              >
                {protocolo ? "Abrir" : "Montar"}
              </Button>
            </div>
          </Card>
        </div>
      </section>

      <FichaAnamnese alunoId={aluno.id} />

      <FichaCheckins
        alunoId={aluno.id}
        checkinSolicitado={aluno.checkinSolicitado}
        checkinSolicitacaoMsg={aluno.checkinSolicitacaoMsg}
      />

      {/* 5) + 6) Pagamento e Conversa lado a lado */}
      <div className={styles.bottomGrid}>
        {/* Pagamento */}
        <Card>
          <CardHeader
            title="Pagamento"
            action={
              <Button variant="ghost" size="sm" iconRight="arrow-right" href="/financeiro">
                Ver no financeiro
              </Button>
            }
          />
          <CardBody className={styles.payBody}>
            <div className={styles.payRow}>
              <span className={styles.payLabel}>Plano</span>
              <span className={styles.payValue}>{nomePlano}</span>
            </div>
            <div className={styles.payRow}>
              <span className={styles.payLabel}>Valor</span>
              <span className={styles.payValue}>{valorLabel}</span>
            </div>
            <div className={styles.payRow}>
              <span className={styles.payLabel}>Status</span>
              <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
            </div>
            <div className={styles.payRow}>
              <span className={styles.payLabel}>Próx. vencimento</span>
              <span className={styles.payValue}>
                {proximoVencimento ? dataLonga(proximoVencimento) : "—"}
              </span>
            </div>
            <GerenciarAssinatura alunoId={aluno.id} temAssinatura={temAssinatura} />
          </CardBody>
        </Card>

      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, EmptyState, StatusBadge } from "@/components/ui";
import { useAlunoSessao } from "@/lib/useAlunoSessao";
import { resolveCheckins } from "@/lib/checkinsClient";
import { dataLonga } from "@/lib/format";
import type { CheckIn } from "@/lib/types";
import styles from "./aluno.module.css";

export default function AlunoHomePage() {
  const sessao = useAlunoSessao();
  const [checkins, setCheckins] = useState<CheckIn[] | null>(null);
  const [anamnesePendente, setAnamnesePendente] = useState<boolean | null>(null);

  useEffect(() => {
    if (!sessao.alunoId) return;
    let active = true;
    resolveCheckins(sessao.alunoId, sessao.modo)
      .then((cs) => active && setCheckins(cs))
      .catch(() => active && setCheckins([]));
    return () => {
      active = false;
    };
  }, [sessao.alunoId, sessao.modo]);

  // 1º acesso: se a consultoria tem anamnese e o aluno ainda não respondeu,
  // ela aparece no lugar do check-in até ser respondida.
  useEffect(() => {
    if (sessao.modo !== "real") return;
    let active = true;
    fetch("/api/anamnese/aluno")
      .then((r) => (r.ok ? r.json() : { pendente: false }))
      .then((d) => active && setAnamnesePendente(!!d.pendente))
      // Falha de rede/sessão não pode travar o home em "Carregando…" — cai pra
      // "não pendente" e libera o check-in.
      .catch(() => active && setAnamnesePendente(false));
    return () => {
      active = false;
    };
  }, [sessao.modo]);

  // Em modo real esperamos também o status da anamnese resolver, pra não
  // piscar o card de check-in antes de trocar pela anamnese pendente.
  const anamneseResolvida = sessao.modo !== "real" || anamnesePendente !== null;
  const carregando = sessao.loading || checkins === null || !anamneseResolvida;
  const lista = checkins ?? [];
  const ultimo = lista.length ? lista[lista.length - 1] : undefined;
  const semanaAtual = ultimo ? ultimo.semana + 1 : 1;

  // Pendente = já enviou e ainda não respondido → não oferece novo check-in.
  const aguardando = ultimo?.status === "pendente" ? ultimo : undefined;
  const ultimaResposta = [...lista]
    .reverse()
    .find((c) => c.status === "respondido" && c.respostaCoach);

  const primeiroNome = sessao.nome.split(" ")[0] || "Aluno";

  return (
    <>
      <section className={styles.hello}>
        <span className={styles.eyebrow}>Sua semana</span>
        <h1 className={styles.h1}>Olá, {primeiroNome} 👋</h1>
        <p className={styles.sub}>
          Acompanhe sua evolução e mande o check-in pro seu treinador.
        </p>
      </section>

      {/* Card principal: anamnese (1º acesso) ou check-in da semana */}
      <div className={styles.heroCard}>
        {carregando ? (
          <p className={styles.loading}>Carregando…</p>
        ) : anamnesePendente ? (
          <>
            <span className={styles.heroEyebrow}>
              <i className="ti ti-clipboard-list" aria-hidden />
              Antes de começar
            </span>
            <h2 className={styles.heroTitle}>Responda sua anamnese</h2>
            <p className={styles.heroText}>
              Seu treinador precisa te conhecer pra montar o plano. Leva 2 minutos —
              depois disso você libera o check-in.
            </p>
            <Button href="/aluno/anamnese" icon="clipboard-list" fullWidth>
              Responder anamnese
            </Button>
          </>
        ) : aguardando ? (
          <>
            <span className={styles.heroEyebrow}>
              <i className="ti ti-clock-hour-4" aria-hidden />
              Check-in da semana {aguardando.semana}
            </span>
            <h2 className={styles.heroTitle}>Enviado! 🎉</h2>
            <p className={styles.heroText}>
              Recebemos seu check-in em {dataLonga(aguardando.enviadoEm)}. Seu
              treinador vai revisar e te responder em breve.
            </p>
            <StatusBadge variant="pending" icon="hourglass" noDot>
              Aguardando resposta do treinador
            </StatusBadge>
          </>
        ) : (
          <>
            <span className={styles.heroEyebrow}>
              <i className="ti ti-calendar-event" aria-hidden />
              Semana {semanaAtual}
            </span>
            <h2 className={styles.heroTitle}>Hora do seu check-in</h2>
            <p className={styles.heroText}>
              Leva 2 minutos: peso, fotos, como foi a semana e seus treinos.
            </p>
            <Button
              href={`/aluno/checkin${
                sessao.modo === "proto" && sessao.alunoId
                  ? `?aluno=${sessao.alunoId}`
                  : ""
              }`}
              icon="clipboard-check"
              fullWidth
            >
              Fazer check-in da semana {semanaAtual}
            </Button>
          </>
        )}
      </div>

      {/* Última resposta do treinador */}
      {ultimaResposta && (
        <div className={styles.respostaCard}>
          <span className={styles.cardLabel}>
            <i className="ti ti-message-2" aria-hidden />
            Resposta do treinador · Semana {ultimaResposta.semana}
          </span>
          <p className={styles.respostaTexto}>{ultimaResposta.respostaCoach}</p>
        </div>
      )}

      {/* Histórico curto */}
      <div className={styles.histBlock}>
        <span className={styles.cardLabel}>
          <i className="ti ti-history" aria-hidden />
          Seus check-ins
        </span>
        {carregando ? (
          <p className={styles.loading}>Carregando…</p>
        ) : lista.length === 0 ? (
          <EmptyState
            compact
            icon="clipboard-off"
            title="Nenhum check-in ainda"
            description="Seu primeiro check-in aparece aqui depois de enviado."
          />
        ) : (
          <ul className={styles.hist}>
            {[...lista].reverse().map((c) => (
              <li key={c.id} className={styles.histRow}>
                <span className={styles.histSemana}>S{c.semana}</span>
                <span className={styles.histMeta}>
                  <strong>{c.peso ? `${c.peso} kg` : "—"}</strong>
                  <span className={styles.histData}>
                    {dataLonga(c.enviadoEm)}
                  </span>
                </span>
                <StatusBadge
                  variant={c.status === "respondido" ? "ok" : "pending"}
                  noDot
                >
                  {c.status === "respondido" ? "Respondido" : "Pendente"}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </div>

      {sessao.modo === "proto" && (
        <p className={styles.protoNote}>
          <i className="ti ti-flask" aria-hidden /> Modo demonstração — os
          envios ficam salvos neste navegador.{" "}
          <Link href="/" className={styles.protoLink}>
            Voltar ao painel
          </Link>
        </p>
      )}
    </>
  );
}

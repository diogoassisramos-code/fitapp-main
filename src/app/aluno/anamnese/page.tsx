"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@/components/ui";
import { useAlunoSessao } from "@/lib/useAlunoSessao";
import { comprimirImagem } from "@/lib/imagem";
import type { PerguntaAnamnese } from "@/lib/types";
import styles from "../checkin/checkin.module.css";

export default function AnamneseAlunoPage() {
  const sessao = useAlunoSessao();
  const router = useRouter();

  const [perguntas, setPerguntas] = useState<PerguntaAnamnese[] | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  // Carrega as perguntas da consultoria. Se não houver anamnese pendente,
  // volta pro início (o aluno não deveria estar aqui).
  useEffect(() => {
    if (sessao.loading) return;
    if (sessao.modo !== "real") {
      setPerguntas([]);
      return;
    }
    let active = true;
    fetch("/api/anamnese/aluno")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (!d.pendente) {
          router.replace("/aluno");
          return;
        }
        setPerguntas(Array.isArray(d.perguntas) ? d.perguntas : []);
      })
      .catch(() => active && setPerguntas([]));
    return () => {
      active = false;
    };
  }, [sessao.loading, sessao.modo, router]);

  function setResposta(id: string, valor: string) {
    setRespostas((prev) => ({ ...prev, [id]: valor }));
  }

  async function enviar() {
    setErro("");
    const lista = perguntas ?? [];
    const faltando = lista.find(
      (p) => p.obrigatoria && !(respostas[p.id] ?? "").trim()
    );
    if (faltando) {
      setErro(`Responda: "${faltando.texto || "pergunta obrigatória"}".`);
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/anamnese/aluno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respostas }),
      });
      if (!res.ok) throw new Error("falha ao salvar");
      setEnviado(true);
    } catch {
      setErro("Não foi possível enviar agora. Tente novamente em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className={styles.sucesso}>
        <span className={styles.sucessoIcon}>
          <i className="ti ti-circle-check" aria-hidden />
        </span>
        <h1 className={styles.sucessoTitle}>Anamnese enviada!</h1>
        <p className={styles.sucessoText}>
          Prontinho — seu treinador já tem o que precisa. Agora é só mandar seu
          primeiro check-in.
        </p>
        <Button href="/aluno" icon="home" fullWidth>
          Ir pro início
        </Button>
      </div>
    );
  }

  const carregando = sessao.loading || perguntas === null;
  const lista = perguntas ?? [];

  return (
    <>
      <header className={styles.head}>
        <button
          type="button"
          className={styles.back}
          onClick={() => router.push("/aluno")}
          aria-label="Voltar"
        >
          <i className="ti ti-arrow-left" aria-hidden />
        </button>
        <div>
          <span className={styles.eyebrow}>Primeiro acesso</span>
          <h1 className={styles.title}>Sua anamnese</h1>
        </div>
      </header>

      {carregando ? (
        <p className={styles.sectionHint}>Carregando…</p>
      ) : lista.length === 0 ? (
        <div className={styles.sucesso}>
          <span className={styles.sucessoIcon}>
            <i className="ti ti-clipboard-check" aria-hidden />
          </span>
          <h1 className={styles.sucessoTitle}>Nada por aqui</h1>
          <p className={styles.sucessoText}>
            Sua consultoria não pediu anamnese. Você já pode fazer seu check-in.
          </p>
          <Button href="/aluno" icon="home" fullWidth>
            Ir pro início
          </Button>
        </div>
      ) : (
        <>
          {lista.map((p, i) => (
            <section key={p.id} className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span>
                  {i + 1}. {p.texto || "Pergunta"}
                  {p.obrigatoria && (
                    <span aria-hidden style={{ color: "var(--color-danger)" }}>
                      {" "}
                      *
                    </span>
                  )}
                </span>
              </h2>
              <CampoResposta
                pergunta={p}
                valor={respostas[p.id] ?? ""}
                onChange={(v) => setResposta(p.id, v)}
              />
            </section>
          ))}

          {erro && <p className={styles.erro}>{erro}</p>}

          <div className={styles.submitBar}>
            <Button icon="send" fullWidth onClick={enviar} disabled={enviando}>
              {enviando ? "Enviando…" : "Enviar anamnese"}
            </Button>
          </div>
        </>
      )}
    </>
  );
}

/** Renderiza o campo de resposta conforme o tipo da pergunta. */
function CampoResposta({
  pergunta,
  valor,
  onChange,
}: {
  pergunta: PerguntaAnamnese;
  valor: string;
  onChange: (v: string) => void;
}) {
  if (pergunta.tipo === "numero") {
    return (
      <Input
        type="text"
        inputMode="decimal"
        placeholder="Ex.: 72"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (pergunta.tipo === "escolha") {
    const opcoes = (pergunta.opcoes ?? []).map((o) => o.trim()).filter(Boolean);
    if (opcoes.length === 0) {
      return (
        <Input
          type="text"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {opcoes.map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => onChange(op)}
            aria-pressed={valor === op}
            style={{
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--border-radius-md)",
              border: `1px solid ${
                valor === op ? "var(--color-primary)" : "var(--color-border)"
              }`,
              background:
                valor === op
                  ? "var(--color-primary-soft, var(--color-surface-2))"
                  : "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            {op}
          </button>
        ))}
      </div>
    );
  }
  if (pergunta.tipo === "foto") {
    return <FotoResposta valor={valor} onChange={onChange} />;
  }
  // texto (e fallback p/ tipos não previstos)
  return (
    <Textarea
      placeholder="Sua resposta"
      maxLength={500}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Upload de foto → data URL comprimida (mesmo padrão do check-in). */
function FotoResposta({
  valor,
  onChange,
}: {
  valor: string;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [carregando, setCarregando] = useState(false);
  const temFoto = valor.startsWith("data:image");

  async function escolher(file: File | undefined) {
    if (!file) return;
    setCarregando(true);
    try {
      onChange(await comprimirImagem(file));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {temFoto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={valor}
          alt="Foto enviada"
          style={{
            maxWidth: 220,
            borderRadius: "var(--border-radius-md)",
            border: "1px solid var(--color-border)",
          }}
        />
      )}
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <Button
          type="button"
          variant="outline"
          icon={temFoto ? "photo-edit" : "camera"}
          onClick={() => inputRef.current?.click()}
          disabled={carregando}
        >
          {carregando ? "Processando…" : temFoto ? "Trocar foto" : "Enviar foto"}
        </Button>
        {temFoto && (
          <Button type="button" variant="ghost" icon="x" onClick={() => onChange("")}>
            Remover
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => escolher(e.target.files?.[0])}
      />
    </div>
  );
}

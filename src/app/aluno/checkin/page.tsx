"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@/components/ui";
import { useAlunoSessao } from "@/lib/useAlunoSessao";
import { resolveCheckins, enviarCheckin } from "@/lib/checkinsClient";
import type { FotoCheckin } from "@/lib/types";
import styles from "./checkin.module.css";

const ANGULOS = ["Frente", "Lado", "Costas"] as const;

const AVALIACOES: { campo: "energia" | "sono" | "dieta"; label: string; icon: string }[] = [
  { campo: "energia", label: "Energia", icon: "bolt" },
  { campo: "sono", label: "Sono", icon: "moon" },
  { campo: "dieta", label: "Dieta", icon: "salad" },
];

/** Seletor de nota 1–5 (bolinhas). */
function NotaPicker({
  valor,
  onChange,
}: {
  valor: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className={styles.notas} role="group">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={n <= valor ? styles.notaOn : styles.notaOff}
          onClick={() => onChange(n)}
          aria-label={`Nota ${n}`}
          aria-pressed={n === valor}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

/** Stepper numérico (treinos). */
function Stepper({
  valor,
  onChange,
  min = 0,
  max = 14,
}: {
  valor: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className={styles.stepper}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, valor - 1))}
        disabled={valor <= min}
        aria-label="Diminuir"
      >
        <i className="ti ti-minus" aria-hidden />
      </button>
      <span className={styles.stepperValor}>{valor}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, valor + 1))}
        disabled={valor >= max}
        aria-label="Aumentar"
      >
        <i className="ti ti-plus" aria-hidden />
      </button>
    </div>
  );
}

export default function CheckinFormPage() {
  const sessao = useAlunoSessao();
  const router = useRouter();

  const [semanaAtual, setSemanaAtual] = useState<number | null>(null);
  const [peso, setPeso] = useState("");
  const [fotos, setFotos] = useState<FotoCheckin[]>([]);
  const [energia, setEnergia] = useState(3);
  const [sono, setSono] = useState(3);
  const [dieta, setDieta] = useState(3);
  const [treinosFeitos, setTreinosFeitos] = useState(0);
  const [treinosTotais, setTreinosTotais] = useState(5);
  const [comentario, setComentario] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  const avalSetters = { energia: setEnergia, sono: setSono, dieta: setDieta };
  const avalValores = { energia, sono, dieta };

  // Carrega a semana atual a partir do histórico.
  useEffect(() => {
    if (!sessao.alunoId) return;
    let active = true;
    resolveCheckins(sessao.alunoId, sessao.modo)
      .then((cs) => {
        if (!active) return;
        const ultima = cs.length ? Math.max(...cs.map((c) => c.semana)) : 0;
        setSemanaAtual(ultima + 1);
        // pré-preenche peso/treinos com base no último check-in.
        const ultimo = cs.find((c) => c.semana === ultima);
        if (ultimo?.treinosTotais) setTreinosTotais(ultimo.treinosTotais);
      })
      .catch(() => active && setSemanaAtual(1));
    return () => {
      active = false;
    };
  }, [sessao.alunoId, sessao.modo]);

  async function lerFoto(angulo: string, file: File | undefined) {
    if (!file) return;
    const url = await comprimirImagem(file);
    setFotos((prev) => [
      ...prev.filter((f) => f.angulo !== angulo),
      { id: `${angulo}-${Date.now()}`, angulo, url },
    ]);
  }

  function removerFoto(angulo: string) {
    setFotos((prev) => prev.filter((f) => f.angulo !== angulo));
  }

  async function enviar() {
    setErro("");
    if (!sessao.alunoId || semanaAtual === null) return;

    // Peso é opcional, mas se informado tem que ser um número plausível (kg).
    let pesoNum: number | undefined;
    if (peso.trim()) {
      pesoNum = Number(peso.replace(",", "."));
      if (!Number.isFinite(pesoNum) || pesoNum < 20 || pesoNum > 400) {
        setErro("Informe um peso válido em kg (ex.: 72,5).");
        return;
      }
    }

    setEnviando(true);
    try {
      await enviarCheckin(sessao.alunoId, sessao.modo, semanaAtual, {
        peso: pesoNum,
        fotos,
        energia,
        sono,
        dieta,
        treinosFeitos,
        treinosTotais,
        comentario: comentario.trim() || undefined,
      });
      setEnviado(true);
    } catch (e) {
      setErro(
        e instanceof Error && e.message
          ? e.message
          : "Não foi possível enviar agora. Tente novamente em instantes."
      );
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setEnviando(false);
    }
  }

  const voltarHref =
    sessao.modo === "proto" && sessao.alunoId
      ? `/aluno?aluno=${sessao.alunoId}`
      : "/aluno";

  if (enviado) {
    return (
      <div className={styles.sucesso}>
        <span className={styles.sucessoIcon}>
          <i className="ti ti-circle-check" aria-hidden />
        </span>
        <h1 className={styles.sucessoTitle}>Check-in enviado!</h1>
        <p className={styles.sucessoText}>
          Seu treinador já vai receber tudo: peso, fotos e como foi sua semana.
          Você recebe a resposta por aqui.
        </p>
        <Button href={voltarHref} icon="home" fullWidth>
          Voltar ao início
        </Button>
      </div>
    );
  }

  return (
    <>
      <header className={styles.head}>
        <button
          type="button"
          className={styles.back}
          onClick={() => router.push(voltarHref)}
          aria-label="Voltar"
        >
          <i className="ti ti-arrow-left" aria-hidden />
        </button>
        <div>
          <span className={styles.eyebrow}>
            Check-in {semanaAtual !== null ? `· Semana ${semanaAtual}` : ""}
          </span>
          <h1 className={styles.title}>Como foi sua semana?</h1>
        </div>
      </header>

      {/* Peso */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <i className="ti ti-weight" aria-hidden /> Peso atual
        </h2>
        <Input
          type="text"
          inputMode="decimal"
          placeholder="Ex.: 72,5"
          prefix="kg"
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
        />
      </section>

      {/* Fotos */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <i className="ti ti-camera" aria-hidden /> Fotos de progresso
        </h2>
        <p className={styles.sectionHint}>Opcional — ajuda o treinador a ver sua evolução.</p>
        <div className={styles.fotos}>
          {ANGULOS.map((angulo) => {
            const foto = fotos.find((f) => f.angulo === angulo);
            return (
              <FotoSlot
                key={angulo}
                angulo={angulo}
                url={foto?.url}
                onPick={(file) => lerFoto(angulo, file)}
                onRemove={() => removerFoto(angulo)}
              />
            );
          })}
        </div>
      </section>

      {/* Avaliações 1-5 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <i className="ti ti-mood-smile" aria-hidden /> Como você se sentiu?
        </h2>
        <div className={styles.avaliacoes}>
          {AVALIACOES.map((a) => (
            <div key={a.campo} className={styles.avalRow}>
              <span className={styles.avalLabel}>
                <i className={`ti ti-${a.icon}`} aria-hidden />
                {a.label}
              </span>
              <NotaPicker
                valor={avalValores[a.campo]}
                onChange={(n) => avalSetters[a.campo](n)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Treinos */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <i className="ti ti-barbell" aria-hidden /> Treinos da semana
        </h2>
        <div className={styles.treinos}>
          <div className={styles.treinoCol}>
            <span className={styles.treinoLabel}>Feitos</span>
            <Stepper valor={treinosFeitos} onChange={setTreinosFeitos} max={treinosTotais || 14} />
          </div>
          <div className={styles.treinoCol}>
            <span className={styles.treinoLabel}>Planejados</span>
            <Stepper
              valor={treinosTotais}
              onChange={(n) => {
                setTreinosTotais(n);
                // Reduzir os planejados nunca deixa "feitos" acima do total.
                setTreinosFeitos((f) => Math.min(f, n));
              }}
              min={1}
            />
          </div>
        </div>
      </section>

      {/* Comentário */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <i className="ti ti-message-dots" aria-hidden /> Quer comentar algo?
        </h2>
        <Textarea
          placeholder="Como foi a semana, dificuldades, vitórias…"
          maxLength={500}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
        />
      </section>

      {erro && <p className={styles.erro}>{erro}</p>}

      <div className={styles.submitBar}>
        <Button
          icon="send"
          fullWidth
          onClick={enviar}
          disabled={enviando || semanaAtual === null}
        >
          {enviando ? "Enviando…" : "Enviar check-in"}
        </Button>
      </div>
    </>
  );
}

/**
 * Redimensiona a foto no cliente (máx. ~1280px, JPEG) antes de virar data URL.
 * Uma foto de celular tem 3–8 MB; sem isso, 3 fotos estouram a quota do
 * localStorage (protótipo) e incham o payload no banco (data URL na coluna
 * jsonb). Se algo falhar, cai no data URL original.
 */
async function comprimirImagem(
  file: File,
  maxLado = 1280,
  qualidade = 0.8
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("imagem inválida"));
      im.src = dataUrl;
    });
    const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * escala));
    const h = Math.max(1, Math.round(img.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", qualidade);
  } catch {
    return dataUrl;
  }
}

/** Slot de foto com upload + preview + remoção. */
function FotoSlot({
  angulo,
  url,
  onPick,
  onRemove,
}: {
  angulo: string;
  url?: string;
  onPick: (file: File | undefined) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={styles.fotoSlot}>
      {url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={angulo} className={styles.fotoImg} />
          <button
            type="button"
            className={styles.fotoRemove}
            onClick={onRemove}
            aria-label={`Remover foto ${angulo}`}
          >
            <i className="ti ti-x" aria-hidden />
          </button>
        </>
      ) : (
        <button
          type="button"
          className={styles.fotoAdd}
          onClick={() => inputRef.current?.click()}
        >
          <i className="ti ti-plus" aria-hidden />
        </button>
      )}
      <span className={styles.fotoAngulo}>{angulo}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => onPick(e.target.files?.[0])}
      />
    </div>
  );
}

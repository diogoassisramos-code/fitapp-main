"use client";

// ============================================================================
// Anamnese do aluno na visão do CONSULTOR. Casa cada pergunta do template da
// consultoria com a resposta em alunos.anamnese_respostas. Respostas que são
// data URL de imagem viram <img> com zoom; o resto é texto. Só aparece quando
// a consultoria tem anamnese ativa.
// ============================================================================
import { useEffect, useState } from "react";
import { Card, CardHeader, CardBody, StatusBadge, Modal, EmptyState } from "@/components/ui";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createClient } from "@/utils/supabase/client";
import type { PerguntaAnamnese } from "@/lib/types";

type Estado = {
  perguntas: PerguntaAnamnese[];
  respostas: Record<string, unknown>;
  respondida: boolean;
  ativa: boolean;
};

export function FichaAnamnese({ alunoId }: { alunoId: string }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let ativo = true;
    (async () => {
      const supabase = createClient();
      const { data: al } = await supabase
        .from("alunos")
        .select("anamnese_respondida, anamnese_respostas, consultoria_id")
        .eq("id", alunoId)
        .maybeSingle();
      if (!ativo || !al?.consultoria_id) return;
      const { data: cons } = await supabase
        .from("consultorias")
        .select("anamnese_ativa, anamnese_perguntas")
        .eq("id", al.consultoria_id)
        .maybeSingle();
      if (!ativo) return;
      setEstado({
        perguntas: Array.isArray(cons?.anamnese_perguntas)
          ? (cons.anamnese_perguntas as PerguntaAnamnese[])
          : [],
        respostas: (al.anamnese_respostas ?? {}) as Record<string, unknown>,
        respondida: !!al.anamnese_respondida,
        ativa: cons?.anamnese_ativa === true,
      });
    })();
    return () => {
      ativo = false;
    };
  }, [alunoId]);

  // Só mostra quando a consultoria realmente tem anamnese configurada.
  if (!estado || !estado.ativa || estado.perguntas.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Anamnese"
        action={
          estado.respondida ? (
            <StatusBadge variant="ok" icon="check" noDot>
              Respondida
            </StatusBadge>
          ) : (
            <StatusBadge variant="pending" icon="hourglass" noDot>
              Pendente
            </StatusBadge>
          )
        }
      />
      <CardBody>
        {!estado.respondida ? (
          <EmptyState
            compact
            icon="clipboard-off"
            title="Ainda não respondida"
            description="O aluno responde a anamnese no primeiro acesso ao app."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {estado.perguntas.map((p, i) => {
              const raw = estado.respostas[p.id];
              const valor =
                typeof raw === "string" ? raw : raw == null ? "" : String(raw);
              const isFoto = valor.startsWith("data:image");
              return (
                <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    {i + 1}. {p.texto || "Pergunta"}
                  </span>
                  {isFoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={valor}
                      alt={p.texto || "Foto da anamnese"}
                      onClick={() => setZoom(valor)}
                      style={{
                        maxWidth: 160,
                        borderRadius: "var(--border-radius-md)",
                        border: "1px solid var(--color-border)",
                        cursor: "zoom-in",
                      }}
                    />
                  ) : valor.trim() ? (
                    <span style={{ fontSize: 15, color: "var(--color-text-primary)" }}>{valor}</span>
                  ) : (
                    <span style={{ fontSize: 14, color: "var(--color-text-muted)" }}>—</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardBody>

      <Modal open={zoom !== null} onClose={() => setZoom(null)} title="Foto da anamnese" size="md">
        {zoom && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={zoom}
            alt="Foto da anamnese"
            style={{ width: "100%", borderRadius: "var(--border-radius-md)" }}
          />
        )}
      </Modal>
    </Card>
  );
}

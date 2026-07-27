"use client";

// ============================================================================
// Cancelar a assinatura (mensalidade) de um aluno — visão do consultor, na ficha.
// Suspende no Asaas no fim do ciclo e MANTÉM a conta do aluno (decisão travada).
// Só aparece quando o aluno tem assinatura no Asaas (temAssinatura).
// ============================================================================
import { useState } from "react";
import { Button } from "@/components/ui";

export function GerenciarAssinatura({
  alunoId,
  temAssinatura,
}: {
  alunoId: string;
  temAssinatura: boolean;
}) {
  const [cancelando, setCancelando] = useState(false);
  const [cancelada, setCancelada] = useState(false);
  const [msg, setMsg] = useState("");

  if (!temAssinatura) return null;

  async function cancelar() {
    if (
      !confirm(
        "Cancelar a assinatura deste aluno? A cobrança recorrente é encerrada no fim do ciclo e o acesso é mantido até lá."
      )
    )
      return;
    setMsg("");
    setCancelando(true);
    try {
      const res = await fetch(`/api/asaas/aluno/${alunoId}/cancelar`, {
        method: "POST",
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setCancelada(true);
        setMsg("Assinatura cancelada — sem novas cobranças. O acesso segue até o fim do ciclo.");
      } else {
        setMsg(d.erro || "Falha ao cancelar.");
      }
    } catch {
      setMsg("Falha de conexão.");
    } finally {
      setCancelando(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        marginTop: "var(--space-3)",
        paddingTop: "var(--space-3)",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      <Button
        variant="outline"
        size="sm"
        icon="ban"
        onClick={cancelar}
        disabled={cancelando || cancelada}
      >
        {cancelando
          ? "Cancelando…"
          : cancelada
            ? "Assinatura cancelada"
            : "Cancelar assinatura"}
      </Button>
      {msg && (
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{msg}</span>
      )}
    </div>
  );
}

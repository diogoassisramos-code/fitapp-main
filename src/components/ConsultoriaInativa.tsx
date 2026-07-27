"use client";

// ============================================================================
// Tela mostrada quando o consultor tenta uma AÇÃO com o plano inativo. A conta
// segue ativa (pode sacar), mas atender/gerenciar exige reativar a consultoria.
// ============================================================================
import { useState } from "react";
import { Button, Card, CardBody } from "@/components/ui";

export function ConsultoriaInativa() {
  const [reativando, setReativando] = useState(false);
  const [msg, setMsg] = useState("");

  async function reativar() {
    setMsg("");
    setReativando(true);
    try {
      const res = await fetch("/api/asaas/assinatura-consultor/reativar", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        window.location.reload();
      } else {
        setMsg(
          d.precisaAssinar
            ? "Você não tem uma assinatura para reativar — assine um plano novamente."
            : d.erro || "Falha ao reativar."
        );
      }
    } catch {
      setMsg("Falha de conexão.");
    } finally {
      setReativando(false);
    }
  }

  return (
    <Card padded>
      <CardBody>
        <div
          style={{
            textAlign: "center",
            maxWidth: 460,
            margin: "0 auto",
            padding: "var(--space-6) 0",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 42, color: "var(--color-text-warning)", lineHeight: 1 }}>
            <i className="ti ti-lock" aria-hidden />
          </span>
          <h2 style={{ margin: 0, fontSize: 22 }}>Sua consultoria está inativa</h2>
          <p style={{ margin: 0, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            Sua conta continua ativa e você pode <strong>sacar o saldo</strong> que ainda
            está na conta. Mas para atender alunos, gerar links e gerenciar planos, você
            precisa reativar sua consultoria.
          </p>
          <Button icon="rocket" onClick={reativar} disabled={reativando}>
            {reativando ? "Reativando…" : "Reativar consultoria"}
          </Button>
          <Button variant="outline" icon="wallet" href="/financeiro">
            Ir para o Financeiro (sacar)
          </Button>
          {msg && <span style={{ fontSize: 13, color: "var(--color-text-danger)" }}>{msg}</span>}
        </div>
      </CardBody>
    </Card>
  );
}

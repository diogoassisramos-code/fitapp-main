"use client";

// ============================================================================
// Aviso no topo do dashboard quando o pagamento do PLANO SaaS do consultor não
// foi aprovado (plano_status = 'inadimplente'). CTA leva pra Configurações →
// Conta → Minha assinatura, onde ele troca o cartão.
// ============================================================================
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { supabaseEnabled } from "@/lib/supabaseEnabled";

export function AvisoPlanoConsultor() {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) return;
    fetch("/api/asaas/assinatura-consultor")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) setStatus(d.planoStatus ?? null);
      })
      .catch(() => {});
  }, []);

  const inativo = status === "inadimplente" || status === "cancelado";
  if (!inativo) return null;
  const cancelado = status === "cancelado";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-3)",
        background: "var(--color-background-danger)",
        border: "1px solid var(--color-text-danger)",
        borderRadius: "var(--border-radius-lg)",
        padding: "var(--space-4)",
      }}
    >
      <i
        className="ti ti-alert-triangle"
        aria-hidden
        style={{ color: "var(--color-text-danger)", fontSize: 22, lineHeight: 1 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ color: "var(--color-text-danger)", fontSize: 15 }}>
          {cancelado ? "Sua consultoria está inativa" : "Pagamento do seu plano não foi aprovado"}
        </strong>
        <p
          style={{
            margin: "2px 0 0",
            color: "var(--color-text-secondary)",
            fontSize: 14,
            lineHeight: 1.4,
          }}
        >
          {cancelado
            ? "Você ainda pode sacar seu saldo, mas para atender alunos, gerar links e gerenciar planos precisa reativar sua consultoria."
            : "Não conseguimos cobrar seu cartão. Atualize sua forma de pagamento para manter o acesso à plataforma e não interromper seus alunos."}
        </p>
      </div>
      <Button href="/configuracoes" variant="outline" size="sm" icon="rocket">
        {cancelado ? "Reativar" : "Atualizar cartão"}
      </Button>
    </div>
  );
}

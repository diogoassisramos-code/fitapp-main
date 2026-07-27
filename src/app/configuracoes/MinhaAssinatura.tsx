"use client";

// ============================================================================
// "Minha assinatura (Revo)" — o consultor vê o próprio plano SaaS e pode:
//   • trocar o cartão da cobrança recorrente (checkout transparente → Asaas);
//   • cancelar o plano (suspende no fim do ciclo, mantém a conta).
// Só faz sentido em modo Supabase; no protótipo o card não aparece.
// ============================================================================
import { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Modal,
  StatusBadge,
} from "@/components/ui";
import type { BadgeVariant } from "@/components/ui";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { brl } from "@/lib/format";

type Estado = {
  plano: string;
  valor: number;
  planoStatus: string;
  temAssinatura: boolean;
};

const PLANO_LABEL: Record<string, string> = {
  free: "Gratuito",
  pro: "Revo Pro",
  avancado: "Revo Pro Max",
};

const STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  ativo: { label: "Ativo", variant: "ok" },
  trial: { label: "Trial", variant: "pending" },
  inadimplente: { label: "Inadimplente", variant: "late" },
  cancelado: { label: "Cancelado", variant: "off" },
};

export function MinhaAssinatura() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [reativando, setReativando] = useState(false);
  const [msg, setMsg] = useState("");

  // Modal de troca de cartão.
  const [cartaoOpen, setCartaoOpen] = useState(false);
  const [numero, setNumero] = useState("");
  const [nome, setNome] = useState("");
  const [validade, setValidade] = useState("");
  const [cvv, setCvv] = useState("");
  const [cpf, setCpf] = useState("");
  const [cep, setCep] = useState("");
  const [numeroEnd, setNumeroEnd] = useState("");
  const [salvandoCartao, setSalvandoCartao] = useState(false);
  const [cartaoMsg, setCartaoMsg] = useState("");

  async function carregar() {
    try {
      const res = await fetch("/api/asaas/assinatura-consultor");
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setEstado({
          plano: d.plano,
          valor: Number(d.valor ?? 0),
          planoStatus: d.planoStatus ?? "ativo",
          temAssinatura: !!d.temAssinatura,
        });
      }
    } catch {
      /* silencioso — o card só some */
    }
  }

  useEffect(() => {
    if (supabaseEnabled) carregar();
  }, []);

  if (!supabaseEnabled || !estado) return null;

  const st = STATUS[estado.planoStatus] ?? STATUS.ativo;
  const pago = estado.valor > 0;
  const cancelado = estado.planoStatus === "cancelado";

  async function cancelar() {
    if (
      !confirm(
        "Cancelar seu plano Revo? A cobrança é encerrada no fim do ciclo e sua conta é mantida."
      )
    )
      return;
    setMsg("");
    setCancelando(true);
    try {
      const res = await fetch("/api/asaas/assinatura-consultor/cancelar", {
        method: "POST",
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setMsg("Plano cancelado — sem novas cobranças.");
        carregar();
      } else {
        setMsg(d.erro || "Falha ao cancelar.");
      }
    } catch {
      setMsg("Falha de conexão.");
    } finally {
      setCancelando(false);
    }
  }

  async function reativar() {
    setMsg("");
    setReativando(true);
    try {
      const res = await fetch("/api/asaas/assinatura-consultor/reativar", {
        method: "POST",
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setMsg("Plano reativado ✓");
        carregar();
      } else {
        setMsg(d.erro || "Falha ao reativar.");
      }
    } catch {
      setMsg("Falha de conexão.");
    } finally {
      setReativando(false);
    }
  }

  async function trocarCartao() {
    setCartaoMsg("");
    const digits = numero.replace(/\D/g, "");
    const [mm, aa] = validade.split("/").map((s) => s.trim());
    if (digits.length < 13) {
      setCartaoMsg("Número do cartão inválido.");
      return;
    }
    if (!nome.trim() || !mm || !aa || cvv.length < 3) {
      setCartaoMsg("Preencha nome, validade (MM/AA) e CVV.");
      return;
    }
    if (cep.replace(/\D/g, "").length < 8 || !numeroEnd.trim()) {
      setCartaoMsg("Informe CEP e número do endereço (antifraude).");
      return;
    }
    setSalvandoCartao(true);
    try {
      const res = await fetch("/api/asaas/assinatura-consultor/cartao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cartao: {
            number: digits,
            holderName: nome.trim(),
            expiryMonth: mm.padStart(2, "0"),
            expiryYear: aa,
            ccv: cvv,
            holderCpf: cpf || undefined,
            postalCode: cep,
            addressNumber: numeroEnd.trim(),
          },
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setCartaoOpen(false);
        setNumero("");
        setNome("");
        setValidade("");
        setCvv("");
        setCpf("");
        setCep("");
        setNumeroEnd("");
        setMsg("Cartão atualizado ✓");
      } else {
        setCartaoMsg(d.erro || "Falha ao trocar o cartão.");
      }
    } catch {
      setCartaoMsg("Falha de conexão.");
    } finally {
      setSalvandoCartao(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Minha assinatura (Revo)"
          action={<StatusBadge variant={st.variant}>{st.label}</StatusBadge>}
        />
        <CardBody>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>
              {PLANO_LABEL[estado.plano] ?? estado.plano}
            </span>
            <span style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>
              {pago ? `${brl(estado.valor)} / mês` : "Plano gratuito — sem cobrança"}
            </span>
          </div>

          {pago && !cancelado && (
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              {estado.temAssinatura && (
                <Button variant="outline" icon="credit-card" onClick={() => setCartaoOpen(true)}>
                  Trocar cartão
                </Button>
              )}
              <Button variant="ghost" icon="ban" onClick={cancelar} disabled={cancelando}>
                {cancelando ? "Cancelando…" : "Cancelar plano"}
              </Button>
            </div>
          )}

          {cancelado && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
                background: "var(--color-background-warning)",
                border: "1px solid var(--color-text-warning)",
                borderRadius: "var(--border-radius-lg)",
                padding: "var(--space-4)",
              }}
            >
              <div>
                <strong style={{ fontSize: 15 }}>Seu plano está cancelado</strong>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>
                  Sua conta segue ativa até o fim do ciclo pago. Reative agora para
                  não perder o acesso e continuar cobrando seus alunos.
                </p>
              </div>
              <Button icon="rocket" onClick={reativar} disabled={reativando}>
                {reativando ? "Reativando…" : "Reativar plano"}
              </Button>
            </div>
          )}

          {msg && (
            <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{msg}</span>
          )}
          </div>
        </CardBody>
      </Card>

      <Modal
        open={cartaoOpen}
        onClose={() => !salvandoCartao && setCartaoOpen(false)}
        title="Trocar cartão"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCartaoOpen(false)} disabled={salvandoCartao}>
              Cancelar
            </Button>
            <Button icon="check" onClick={trocarCartao} disabled={salvandoCartao}>
              {salvandoCartao ? "Salvando…" : "Salvar cartão"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Input label="Número do cartão" inputMode="numeric" placeholder="0000 0000 0000 0000" value={numero} onChange={(e) => setNumero(e.target.value)} />
          <Input label="Nome no cartão" value={nome} onChange={(e) => setNome(e.target.value)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <Input label="Validade (MM/AA)" placeholder="12/28" value={validade} onChange={(e) => setValidade(e.target.value)} />
            <Input label="CVV" inputMode="numeric" placeholder="123" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, ""))} />
          </div>
          <Input label="CPF do titular (opcional)" inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <Input label="CEP" inputMode="numeric" placeholder="00000-000" value={cep} onChange={(e) => setCep(e.target.value)} />
            <Input label="Número" value={numeroEnd} onChange={(e) => setNumeroEnd(e.target.value)} />
          </div>
          {cartaoMsg && (
            <span style={{ fontSize: 13, color: "var(--color-text-danger)" }}>{cartaoMsg}</span>
          )}
        </div>
      </Modal>
    </>
  );
}

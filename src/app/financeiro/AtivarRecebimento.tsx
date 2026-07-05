"use client";

// ============================================================================
// FLUXO 2 · Parte 1 — Ativar recebimento: o coach vira uma SUBCONTA Asaas
// (recebedor com walletId). Chama /api/asaas/subconta. Mostra o estado do KYC
// (em análise → aprovado, atualizado pelo webhook ACCOUNT_STATUS).
// ============================================================================
import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader, CardBody, Button, Input, StatusBadge, Segmented } from "@/components/ui";
import type { SegmentedOption } from "@/components/ui";
import { createClient } from "@/utils/supabase/client";
import { supabaseEnabled } from "@/lib/supabaseEnabled";

type Status =
  | "carregando"
  | "off"
  | "nao_iniciado"
  | "em_analise"
  | "aprovado"
  | "reprovado";

type TipoEmpresa = "MEI" | "LIMITED" | "INDIVIDUAL";
const TIPOS: { value: TipoEmpresa; label: string }[] = [
  { value: "INDIVIDUAL", label: "Autônomo" },
  { value: "MEI", label: "MEI" },
  { value: "LIMITED", label: "LTDA" },
];

export function AtivarRecebimento() {
  const [status, setStatus] = useState<Status>(supabaseEnabled ? "carregando" : "off");
  const [walletId, setWalletId] = useState<string | null>(null);

  const [faturamento, setFaturamento] = useState("5000");
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [tipo, setTipo] = useState<TipoEmpresa>("INDIVIDUAL");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!supabaseEnabled) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return setStatus("nao_iniciado");
    const { data: prof } = await supabase
      .from("profiles")
      .select("consultoria_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!prof?.consultoria_id) return setStatus("nao_iniciado");
    const { data: cons } = await supabase
      .from("consultorias")
      .select("asaas_onboarding_status, asaas_wallet_id")
      .eq("id", prof.consultoria_id)
      .maybeSingle();
    setWalletId(cons?.asaas_wallet_id ?? null);
    setStatus((cons?.asaas_onboarding_status as Status) ?? "nao_iniciado");
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function ativar() {
    setErro("");
    if (cep.replace(/\D/g, "").length < 8 || !numero.trim() || !bairro.trim() || !rua.trim()) {
      setErro("Preencha o endereço completo (CEP, rua, número e bairro).");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/asaas/subconta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          incomeValue: Number(faturamento) || 5000,
          postalCode: cep.replace(/\D/g, ""),
          address: rua.trim(),
          addressNumber: numero.trim(),
          province: bairro.trim(),
          companyType: tipo,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErro(data.erro || "Não foi possível ativar o recebimento.");
        return;
      }
      setWalletId(data.walletId ?? null);
      setStatus(data.onboardingStatus === "aprovado" ? "aprovado" : "em_analise");
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (status === "off" || status === "carregando") return null;

  return (
    <Card>
      <CardHeader
        title="Recebimentos"
        action={
          status === "aprovado" ? (
            <StatusBadge variant="ok" icon="check" noDot>
              Ativo
            </StatusBadge>
          ) : status === "em_analise" ? (
            <StatusBadge variant="pending" icon="clock-hour-4" noDot>
              Em análise
            </StatusBadge>
          ) : undefined
        }
      />
      <CardBody>
        {status === "aprovado" ? (
          <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>
            Recebimentos ativos. Os pagamentos dos seus alunos caem na sua conta
            (a plataforma retém a taxa combinada).
            {walletId && (
              <>
                {" "}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                  wallet {walletId.slice(0, 8)}…
                </span>
              </>
            )}
          </p>
        ) : status === "em_analise" ? (
          <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>
            Sua conta de recebimento foi criada e está <strong>em análise</strong>.
            Assim que o Asaas aprovar (envio de documentos/KYC), os recebimentos são
            liberados automaticamente.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: 14 }}>
              Ative para receber dos seus alunos direto pela plataforma (a Revo
              retém a taxa combinada; o resto cai na sua conta).
            </p>
            <span className="mono-label">Tipo de cadastro</span>
            <Segmented<TipoEmpresa>
              ariaLabel="Tipo de cadastro"
              value={tipo}
              onChange={setTipo}
              options={TIPOS.map((t): SegmentedOption<TipoEmpresa> => ({ value: t.value, label: t.label }))}
            />
            <Input
              label="Faturamento mensal estimado (R$)"
              inputMode="numeric"
              value={faturamento}
              onChange={(e) => setFaturamento(e.target.value.replace(/\D/g, ""))}
            />
            <Input
              label="CEP"
              inputMode="numeric"
              placeholder="00000-000"
              value={cep}
              onChange={(e) => setCep(e.target.value)}
            />
            <Input
              label="Rua / Logradouro"
              value={rua}
              onChange={(e) => setRua(e.target.value)}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <Input label="Número" value={numero} onChange={(e) => setNumero(e.target.value)} />
              <Input label="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
            </div>
            {erro && <p style={{ color: "var(--color-text-danger)", fontSize: 13, margin: 0 }}>{erro}</p>}
            <Button icon="cash" onClick={ativar} disabled={enviando}>
              {enviando ? "Ativando…" : "Ativar recebimentos"}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

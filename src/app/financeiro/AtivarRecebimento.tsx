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
import { cpfValido, mascararCpf, cnpjValido, mascararCnpj } from "@/lib/cpf";

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

  const [email, setEmail] = useState("");
  const [documento, setDocumento] = useState("");
  const [celular, setCelular] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [faturamento, setFaturamento] = useState("5000");
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [tipo, setTipo] = useState<TipoEmpresa>("INDIVIDUAL");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const pessoaFisica = tipo === "INDIVIDUAL";

  // KYC da subconta: link (jornada Asaas) + QR pra abrir no celular.
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [checandoKyc, setChecandoKyc] = useState(false);
  const [kycEsgotado, setKycEsgotado] = useState(false);
  const [kycMsg, setKycMsg] = useState("");

  // Mensalidade (produto do coach) + gerar link de convite.
  const [mensalidade, setMensalidade] = useState("");
  const [mensalidadeMsg, setMensalidadeMsg] = useState("");
  const [salvandoMensalidade, setSalvandoMensalidade] = useState(false);
  const [alunoNome, setAlunoNome] = useState("");
  const [gerando, setGerando] = useState(false);
  const [link, setLink] = useState("");
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    if (!supabaseEnabled) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return setStatus("nao_iniciado");
    setEmail((e) => e || user.email || "");
    const { data: prof } = await supabase
      .from("profiles")
      .select("consultoria_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!prof?.consultoria_id) return setStatus("nao_iniciado");
    const { data: cons } = await supabase
      .from("consultorias")
      .select("asaas_onboarding_status, asaas_wallet_id, mensalidade_valor")
      .eq("id", prof.consultoria_id)
      .maybeSingle();
    setWalletId(cons?.asaas_wallet_id ?? null);
    setStatus((cons?.asaas_onboarding_status as Status) ?? "nao_iniciado");
    if (cons?.mensalidade_valor != null) setMensalidade(String(cons.mensalidade_valor));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Enquanto a conta está em análise, busca o link de verificação (documento +
  // selfie). Os documentos só aparecem ~15s após criar a subconta, então tenta
  // algumas vezes até o link surgir (ou a conta ser aprovada).
  useEffect(() => {
    if (!supabaseEnabled) return;
    if (status !== "em_analise" && status !== "reprovado") return;
    let cancel = false;
    let timer: ReturnType<typeof setTimeout>;
    setKycEsgotado(false);
    async function tick(n: number) {
      if (cancel) return;
      setChecandoKyc(true);
      let temUrl = false;
      let aprovado = false;
      try {
        const res = await fetch("/api/asaas/subconta/kyc");
        const data = await res.json().catch(() => ({}));
        if (!cancel && res.ok) {
          aprovado = data.status === "aprovado";
          if (aprovado) setStatus("aprovado");
          if (data.status === "reprovado") setStatus("reprovado");
          if (data.onboardingUrl) {
            setOnboardingUrl(data.onboardingUrl);
            setQrDataUrl(data.qrCodeDataUrl ?? null);
            temUrl = true;
          }
        }
      } catch {
        /* rede — tenta de novo no próximo tick */
      }
      if (!cancel) setChecandoKyc(false);
      if (!cancel && !aprovado && !temUrl) {
        if (n < 4) timer = setTimeout(() => tick(n + 1), 5000);
        else setKycEsgotado(true);
      }
    }
    tick(0);
    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [status]);

  async function atualizarKyc() {
    setChecandoKyc(true);
    setKycMsg("");
    try {
      const res = await fetch("/api/asaas/subconta/kyc");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setKycMsg(data.erro || "Falha ao atualizar.");
        return;
      }
      if (data.status === "aprovado") {
        setStatus("aprovado");
        return;
      }
      if (data.status === "reprovado") setStatus("reprovado");
      if (data.onboardingUrl) {
        setOnboardingUrl(data.onboardingUrl);
        setQrDataUrl(data.qrCodeDataUrl ?? null);
      }
      setKycMsg(
        data.status === "reprovado"
          ? "Verificação reprovada — refaça pelo link."
          : "Ainda em análise. Conclua a verificação e aguarde a aprovação."
      );
    } catch {
      setKycMsg("Falha de conexão.");
    } finally {
      setChecandoKyc(false);
    }
  }

  async function ativar() {
    setErro("");
    const docValido = pessoaFisica ? cpfValido(documento) : cnpjValido(documento);
    if (!docValido) {
      setErro(pessoaFisica ? "CPF inválido." : "CNPJ inválido.");
      return;
    }
    if (celular.replace(/\D/g, "").length < 10) {
      setErro("Informe um celular válido com DDD.");
      return;
    }
    if (pessoaFisica && !nascimento) {
      setErro("Informe sua data de nascimento.");
      return;
    }
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
          email: email.trim(),
          cpfCnpj: documento.replace(/\D/g, ""),
          mobilePhone: celular.replace(/\D/g, ""),
          birthDate: pessoaFisica ? nascimento : undefined,
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

  async function salvarMensalidade() {
    setMensalidadeMsg("");
    const valor = Number(String(mensalidade).replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      setMensalidadeMsg("Informe um valor válido.");
      return;
    }
    setSalvandoMensalidade(true);
    try {
      const res = await fetch("/api/mensalidade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ valor }),
      });
      const data = await res.json();
      setMensalidadeMsg(res.ok && data.ok ? "Salvo ✓" : data.erro || "Falha ao salvar.");
    } catch {
      setMensalidadeMsg("Falha de conexão.");
    } finally {
      setSalvandoMensalidade(false);
    }
  }

  async function gerarConvite() {
    setLink("");
    setCopiado(false);
    setMensalidadeMsg("");
    const valor = Number(String(mensalidade).replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      setMensalidadeMsg("Defina a mensalidade antes de convidar.");
      return;
    }
    setGerando(true);
    try {
      const res = await fetch("/api/convites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alunoNome: alunoNome.trim() || undefined, valor }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMensalidadeMsg(data.erro || "Não foi possível gerar o link.");
        return;
      }
      setLink(`${window.location.origin}/onboarding/${data.token}`);
    } catch {
      setMensalidadeMsg("Falha de conexão.");
    } finally {
      setGerando(false);
    }
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
    } catch {
      /* ignore */
    }
  }

  if (status === "off" || status === "carregando") return null;

  return (
    <>
    <Card>
      <CardHeader
        title="Recebimentos"
        action={
          status === "aprovado" ? (
            <StatusBadge variant="ok" icon="check" noDot>
              Ativo
            </StatusBadge>
          ) : status === "reprovado" ? (
            <StatusBadge variant="late" icon="alert-triangle" noDot>
              Reprovado
            </StatusBadge>
          ) : status === "em_analise" ? (
            <StatusBadge variant="pending" icon="scan-eye" noDot>
              Verificação pendente
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
        ) : status === "em_analise" || status === "reprovado" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {status === "reprovado" && (
              <p style={{ margin: 0, color: "var(--color-text-danger)", fontSize: 14 }}>
                <i className="ti ti-alert-triangle" aria-hidden /> Sua verificação foi
                reprovada. Refaça pelo link abaixo com o documento legível e boa iluminação.
              </p>
            )}
            <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>
              Sua conta de recebimento foi criada. Falta{" "}
              <strong>validar sua identidade</strong>: o Asaas pede uma foto do seu
              documento (RG ou CNH) e uma selfie com prova de vida. Leva ~2 min.
            </p>

            {onboardingUrl ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "var(--space-4)",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  <Button
                    href={onboardingUrl}
                    target="_blank"
                    rel="noreferrer"
                    icon="external-link"
                  >
                    Abrir verificação
                  </Button>
                  <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                    <i className="ti ti-device-mobile" aria-hidden /> Melhor pelo celular —
                    a selfie precisa da câmera. Aponte a câmera pro QR.
                  </span>
                </div>
                {qrDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt="QR code para abrir a verificação no celular"
                    width={132}
                    height={132}
                    style={{
                      borderRadius: "var(--border-radius-md)",
                      border: "1px solid var(--color-border)",
                      background: "#fff",
                      padding: 6,
                    }}
                  />
                )}
              </div>
            ) : (
              <p style={{ fontSize: 13, margin: 0, color: "var(--color-text-muted)" }}>
                {checandoKyc
                  ? "Preparando sua verificação…"
                  : kycEsgotado
                    ? "Estamos preparando seu link de verificação — isso pode levar alguns minutos. Toque em atualizar para checar."
                    : "Gerando o link de verificação…"}
              </p>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <Button variant="outline" icon="refresh" onClick={atualizarKyc} disabled={checandoKyc}>
                {checandoKyc ? "Verificando…" : "Já verifiquei — atualizar"}
              </Button>
              {kycMsg && (
                <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{kycMsg}</span>
              )}
            </div>
          </div>
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
              onChange={(t) => {
                setTipo(t);
                setDocumento("");
                setErro("");
              }}
              options={TIPOS.map((t): SegmentedOption<TipoEmpresa> => ({ value: t.value, label: t.label }))}
            />
            <Input
              label="E-mail de recebimento"
              icon="mail"
              type="email"
              hint="Precisa ser diferente do e-mail da conta Asaas da plataforma."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label={pessoaFisica ? "CPF" : "CNPJ"}
              icon="id"
              inputMode="numeric"
              placeholder={pessoaFisica ? "000.000.000-00" : "00.000.000/0000-00"}
              value={documento}
              onChange={(e) =>
                setDocumento(pessoaFisica ? mascararCpf(e.target.value) : mascararCnpj(e.target.value))
              }
            />
            <Input
              label="Celular (com DDD)"
              icon="phone"
              inputMode="tel"
              placeholder="(11) 99999-9999"
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
            />
            {pessoaFisica && (
              <Input
                label="Data de nascimento"
                type="date"
                value={nascimento}
                onChange={(e) => setNascimento(e.target.value)}
              />
            )}
            <Input
              label="Faturamento mensal estimado (R$)"
              inputMode="numeric"
              prefix="R$"
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

    <Card>
      <CardHeader title="Convidar aluno" />
      <CardBody>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: 14 }}>
            Defina a mensalidade e gere um link. O aluno abre, paga no cartão/PIX
            dele e a plataforma repassa pra você (retendo a taxa).
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "var(--space-3)", alignItems: "end" }}>
            <Input
              label="Mensalidade (R$)"
              inputMode="decimal"
              prefix="R$"
              value={mensalidade}
              onChange={(e) => setMensalidade(e.target.value)}
            />
            <Button variant="outline" icon="check" onClick={salvarMensalidade} disabled={salvandoMensalidade}>
              {salvandoMensalidade ? "…" : "Salvar"}
            </Button>
          </div>
          <Input
            label="Nome do aluno (opcional)"
            icon="user"
            value={alunoNome}
            onChange={(e) => setAlunoNome(e.target.value)}
          />
          {mensalidadeMsg && <p style={{ fontSize: 13, margin: 0, color: "var(--color-text-secondary)" }}>{mensalidadeMsg}</p>}
          {status !== "aprovado" && (
            <p style={{ fontSize: 13, margin: 0, color: "var(--color-text-warning)" }}>
              <i className="ti ti-alert-triangle" aria-hidden /> O aluno só consegue
              pagar depois que seu recebimento for aprovado.
            </p>
          )}
          <Button icon="link" onClick={gerarConvite} disabled={gerando}>
            {gerando ? "Gerando…" : "Gerar link de convite"}
          </Button>
          {link && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, wordBreak: "break-all", background: "var(--color-background-secondary)", padding: "var(--space-2)", borderRadius: "var(--border-radius-md)" }}>
                {link}
              </code>
              <Button variant="outline" icon={copiado ? "check" : "copy"} onClick={copiarLink}>
                {copiado ? "Copiado!" : "Copiar link"}
              </Button>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
    </>
  );
}

"use client";

// ============================================================================
// Card de gestão do WEBHOOK do Asaas (conta master) — admin. Mostra se já está
// registrado, permite (re)registrar apontando pra URL pública, e avisa quando a
// URL é local (o Asaas não alcança localhost).
// ============================================================================
import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader, CardBody, Button, Input, StatusBadge } from "@/components/ui";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import {
  fetchWebhooks,
  registrarWebhookAsaas,
  AdminAsaasError,
  type WebhookInfo,
} from "@/lib/adminAsaas";

const PATH = "/api/webhooks/asaas";

export function WebhookAsaas() {
  const [webhooks, setWebhooks] = useState<WebhookInfo[] | null>(null);
  const [tokenOk, setTokenOk] = useState(true);
  const [off, setOff] = useState(false); // Asaas não configurado / sem permissão
  const [url, setUrl] = useState("");
  const [registrando, setRegistrando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const carregar = useCallback(() => {
    if (!supabaseEnabled) return;
    fetchWebhooks()
      .then((d) => {
        setWebhooks(d.webhooks);
        setTokenOk(d.tokenConfigurado);
        setOff(false);
      })
      .catch((e) => {
        if (e instanceof AdminAsaasError && (e.status === 503 || e.status === 403)) {
          setOff(true);
        }
      });
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!supabaseEnabled || off) return null;

  const registrado = (webhooks ?? []).find((w) => w.url.endsWith(PATH));

  async function registrar() {
    setMsg(null);
    setRegistrando(true);
    try {
      const r = await registrarWebhookAsaas(url.trim() || undefined);
      setMsg({
        tipo: "ok",
        texto: r.aviso
          ? r.aviso
          : r.jaExistia
            ? "Webhook já estava registrado."
            : "Webhook registrado com sucesso.",
      });
      carregar();
    } catch (e) {
      setMsg({
        tipo: "erro",
        texto: e instanceof Error ? e.message : "Falha ao registrar o webhook.",
      });
    } finally {
      setRegistrando(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Webhook do Asaas"
        action={
          registrado ? (
            <StatusBadge variant="ok" icon="check" noDot>
              Registrado
            </StatusBadge>
          ) : (
            <StatusBadge variant="pending" icon="alert-triangle" noDot>
              Não registrado
            </StatusBadge>
          )
        }
      />
      <CardBody>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: 14 }}>
            O webhook é como o Asaas confirma pagamentos (PIX/boleto compensam
            depois; cartão pode ter chargeback). Sem ele, a liberação depende do
            botão “Sincronizar”. Registre apontando para o domínio público da
            plataforma.
          </p>

          {!tokenOk && (
            <p style={{ margin: 0, color: "var(--color-text-danger)", fontSize: 13 }}>
              <i className="ti ti-alert-triangle" aria-hidden /> Defina{" "}
              <code>ASAAS_WEBHOOK_TOKEN</code> no <code>.env</code> antes de registrar.
            </p>
          )}

          {registrado && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-secondary)" }}>
              Endpoint atual:{" "}
              <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                {registrado.url}
              </code>
            </p>
          )}

          <Input
            label="URL pública (opcional)"
            placeholder="https://seu-dominio.com"
            hint="Deixe em branco para usar o host atual. localhost não funciona (o Asaas não alcança)."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <Button icon="webhook" onClick={registrar} disabled={registrando || !tokenOk}>
              {registrando ? "Registrando…" : registrado ? "Registrar de novo" : "Registrar webhook"}
            </Button>
            {msg && (
              <span
                style={{
                  fontSize: 13,
                  color:
                    msg.tipo === "ok"
                      ? "var(--color-text-secondary)"
                      : "var(--color-text-danger)",
                }}
              >
                {msg.texto}
              </span>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

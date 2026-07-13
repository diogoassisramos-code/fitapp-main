"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, Input } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import styles from "@/components/admin/screens/consultor-form.module.css";

/**
 * "Nova consultoria" = convite. O admin não cria login: gera o link de cadastro
 * para o consultor criar a conta com os próprios dados e comprar o plano. A
 * consultoria passa a existir de verdade quando o consultor conclui o cadastro.
 */
export default function NovaConsultoriaPage() {
  const [origin, setOrigin] = useState("");
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const link = origin ? `${origin}/cadastro` : "/cadastro";

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard indisponível — o campo já mostra o link para cópia manual */
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Consultorias"
        title="Nova consultoria"
        subtitle="Convide um consultor a criar a própria conta e assinar um plano."
        actions={
          <Button variant="ghost" icon="arrow-left" href="/admin/consultores">
            Voltar
          </Button>
        }
      />

      <Card>
        <CardHeader title="Link de cadastro do consultor" />
        <CardBody>
          <p className={styles.muted} style={{ marginBottom: "var(--space-4)" }}>
            Envie este link para o consultor. Ele cria a conta com os próprios dados
            (nome, e-mail, senha) e escolhe/paga o plano da plataforma. A consultoria
            aparece aqui automaticamente após o cadastro.
          </p>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <Input label="Link de convite" icon="link" value={link} readOnly />
            </div>
            <Button type="button" icon={copiado ? "check" : "copy"} onClick={copiar}>
              {copiado ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <div style={{ marginTop: "var(--space-4)" }}>
            <Button variant="outline" icon="external-link" href="/cadastro" target="_blank">
              Abrir cadastro
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

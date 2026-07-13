"use client";

import { use, useEffect, useState } from "react";
import { Button, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { ConsultorForm } from "@/components/admin/screens/ConsultorForm";
import { adminFetchConsultoria, type AdminConsultoria } from "@/lib/adminDb";

export default function EditarConsultoriaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [consultoria, setConsultoria] = useState<AdminConsultoria | null | undefined>(undefined);

  useEffect(() => {
    adminFetchConsultoria(id)
      .then((c) => setConsultoria(c))
      .catch(() => setConsultoria(null));
  }, [id]);

  if (consultoria === undefined) {
    return (
      <PageHeader eyebrow="Consultorias" title="Editar consultoria" subtitle="Carregando…" />
    );
  }

  if (consultoria === null) {
    return (
      <>
        <PageHeader
          eyebrow="Consultorias"
          title="Consultoria não encontrada"
          subtitle="O registro que você tentou editar não existe ou foi removido."
          actions={
            <Button variant="ghost" icon="arrow-left" href="/admin/consultores">
              Voltar
            </Button>
          }
        />
        <EmptyState
          icon="building-store"
          title="Nada por aqui"
          description={`Nenhuma consultoria com o identificador "${id}".`}
          action={
            <Button icon="list" href="/admin/consultores">
              Ver consultorias
            </Button>
          }
        />
      </>
    );
  }

  return <ConsultorForm consultoria={consultoria} />;
}

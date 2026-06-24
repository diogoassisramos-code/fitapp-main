import { Button, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { getConsultoria } from "@/lib/admin";
import { ConsultorForm } from "@/components/admin/screens/ConsultorForm";

export default async function EditarConsultoriaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const consultoria = getConsultoria(id);

  if (!consultoria) {
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

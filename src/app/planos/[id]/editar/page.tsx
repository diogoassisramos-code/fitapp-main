import { notFound } from "next/navigation";
import { getPlano } from "@/lib/data";
import { PlanoEditor } from "@/components/screens/plano-editor/PlanoEditor";

export default async function EditarPlanoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const plano = getPlano(id);
  if (!plano) notFound();

  return <PlanoEditor plano={plano} />;
}

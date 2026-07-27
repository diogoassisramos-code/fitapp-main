"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PlanoEditor } from "@/components/screens/plano-editor/PlanoEditor";
import { GateConsultoria } from "@/components/GateConsultoria";
import { useSetupGate } from "@/lib/useSetupGate";

export default function NovoPlanoPage() {
  const router = useRouter();
  const { loading, setupOk } = useSetupGate();

  // Guarda: quem chega direto na URL sem recebimento/anamnese decididos volta
  // pro /planos (que mostra o checklist). Espera resolver pra não redirecionar à toa.
  useEffect(() => {
    if (!loading && !setupOk) router.replace("/planos");
  }, [loading, setupOk, router]);

  if (loading || !setupOk) return null;
  return (
    <GateConsultoria>
      <PlanoEditor />
    </GateConsultoria>
  );
}

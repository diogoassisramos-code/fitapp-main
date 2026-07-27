"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { PlanoEditor } from "@/components/screens/plano-editor/PlanoEditor";
import { GateConsultoria } from "@/components/GateConsultoria";
import { getPlano } from "@/lib/data";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { fetchPlanoById } from "@/lib/db";
import type { Plano } from "@/lib/types";

export default function EditarPlanoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  // undefined = carregando; null = não encontrado.
  const [plano, setPlano] = useState<Plano | null | undefined>(
    supabaseEnabled ? undefined : getPlano(id) ?? null
  );

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancel = false;
    fetchPlanoById(id)
      .then((p) => !cancel && setPlano(p))
      .catch(() => !cancel && setPlano(null));
    return () => {
      cancel = true;
    };
  }, [id]);

  if (plano === undefined) {
    return (
      <div style={{ padding: "var(--space-6)", color: "var(--color-text-secondary)" }}>
        Carregando plano…
      </div>
    );
  }
  if (plano === null) {
    return (
      <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>Plano não encontrado.</p>
        <Link href="/planos">← Voltar para planos</Link>
      </div>
    );
  }
  return (
    <GateConsultoria>
      <PlanoEditor plano={plano} />
    </GateConsultoria>
  );
}

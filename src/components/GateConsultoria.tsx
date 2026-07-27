"use client";

// ============================================================================
// GateConsultoria — envolve o conteúdo de uma AÇÃO de consultor. Se o plano
// estiver inativo, mostra a tela de reativação no lugar; senão, renderiza normal.
// Fail-open: enquanto carrega (ou sem Supabase), deixa passar.
// ============================================================================
import { usePlanoAtivo } from "@/lib/usePlanoAtivo";
import { ConsultoriaInativa } from "./ConsultoriaInativa";

export function GateConsultoria({ children }: { children: React.ReactNode }) {
  const { loading, ativo } = usePlanoAtivo();
  if (!loading && !ativo) return <ConsultoriaInativa />;
  return <>{children}</>;
}

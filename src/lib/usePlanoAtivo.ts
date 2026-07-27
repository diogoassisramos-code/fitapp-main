"use client";

// ============================================================================
// usePlanoAtivo — o consultor NUNCA perde a conta, mas com o plano lapsado
// (plano_status 'cancelado' | 'inadimplente') não pode executar ações de
// consultor (CRUD de aluno/produto, gerar link). Este hook diz se o plano está
// ativo. Fail-OPEN: em dúvida/carregando/erro de rede, considera ativo (nunca
// tranca por engano). Só bloqueia quando SABE que está inativo.
// ============================================================================
import { useEffect, useState } from "react";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createClient } from "@/utils/supabase/client";

export type PlanoAtivo = { loading: boolean; ativo: boolean; planoStatus: string | null };

export function usePlanoAtivo(): PlanoAtivo {
  const [estado, setEstado] = useState<{ ativo: boolean; planoStatus: string | null } | null>(
    null
  );

  useEffect(() => {
    if (!supabaseEnabled) {
      setEstado({ ativo: true, planoStatus: "ativo" });
      return;
    }
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return active && setEstado({ ativo: true, planoStatus: null });
        const { data: prof } = await supabase
          .from("profiles")
          .select("consultoria_id")
          .eq("id", user.id)
          .maybeSingle();
        if (!prof?.consultoria_id) return active && setEstado({ ativo: true, planoStatus: null });
        const { data: cons } = await supabase
          .from("consultorias")
          .select("plano_status, plano_ate")
          .eq("id", prof.consultoria_id)
          .maybeSingle();
        const status = (cons?.plano_status as string) ?? "ativo";
        // Grace: cancelado ainda vale até o fim do ciclo pago (plano_ate).
        const ate = cons?.plano_ate ? new Date(cons.plano_ate as string).getTime() : null;
        const ativo =
          status === "ativo" ||
          status === "trial" ||
          (status === "cancelado" && ate != null && ate > Date.now());
        if (active) setEstado({ ativo, planoStatus: status });
      } catch {
        // Fail-open: blip de rede não deve trancar o consultor.
        if (active) setEstado({ ativo: true, planoStatus: null });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return {
    loading: estado === null,
    ativo: estado?.ativo ?? true,
    planoStatus: estado?.planoStatus ?? null,
  };
}

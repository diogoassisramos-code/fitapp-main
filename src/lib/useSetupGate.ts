"use client";

// ============================================================================
// useSetupGate — o consultor só pode criar planos depois de (1) ativar o
// recebimento (subconta Asaas aprovada) E (2) decidir a anamnese (criar ou
// opt-out). Usado no /planos (botão + checklist) e no /planos/novo (guarda de
// navegação direta). Fonte única da regra pra não divergir entre os dois.
// ============================================================================
import { useEffect, useState } from "react";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createClient } from "@/utils/supabase/client";

export type SetupGate = {
  /** true enquanto resolve — os consumidores não devem bloquear/redirecionar ainda. */
  loading: boolean;
  recebimentoOk: boolean;
  anamneseOk: boolean;
  /** Enquanto carrega retorna true (não pisca UI); só "morde" quando resolveu. */
  setupOk: boolean;
};

export function useSetupGate(): SetupGate {
  const [estado, setEstado] = useState<{
    recebimentoOk: boolean;
    anamneseOk: boolean;
  } | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) {
      setEstado({ recebimentoOk: true, anamneseOk: true });
      return;
    }
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        let recebimentoOk = false;
        if (user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("consultoria_id")
            .eq("id", user.id)
            .maybeSingle();
          if (prof?.consultoria_id) {
            const { data: cons } = await supabase
              .from("consultorias")
              .select("asaas_onboarding_status")
              .eq("id", prof.consultoria_id)
              .maybeSingle();
            // "Recebimento ativo" = subconta APROVADA. em_analise/reprovado ainda
            // não coletam, então não liberam a criação de planos/links.
            recebimentoOk = cons?.asaas_onboarding_status === "aprovado";
          }
        }
        const anam = await fetch("/api/anamnese")
          .then((r) => r.json())
          .catch(() => ({}));
        // Decidida = criou perguntas (true) OU optou por não ter (false). null = não decidiu.
        const anamneseOk = anam?.ativa === true || anam?.ativa === false;
        if (active) setEstado({ recebimentoOk, anamneseOk });
      } catch {
        // Falha transitória bloqueia (fail-closed) em vez de liberar o gate.
        if (active) setEstado({ recebimentoOk: false, anamneseOk: false });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return {
    loading: estado === null,
    recebimentoOk: estado?.recebimentoOk ?? false,
    anamneseOk: estado?.anamneseOk ?? false,
    setupOk: estado === null ? true : estado.recebimentoOk && estado.anamneseOk,
  };
}

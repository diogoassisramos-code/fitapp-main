"use client";

import { useEffect, useState } from "react";
import { COACH } from "@/lib/nav";
import { supabaseEnabled } from "@/lib/supabaseEnabled";
import { createClient } from "@/utils/supabase/client";

export type Consultor = { nome: string; iniciais: string; conselho: string };

function iniciaisDe(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

/**
 * Identidade do consultor logado para o chrome (sidebar/saudação).
 * Com Supabase: lê profiles.nome (+ conselho da consultoria). Sem: COACH mock.
 */
export function useConsultor(): Consultor {
  const [c, setC] = useState<Consultor>(() =>
    supabaseEnabled
      ? { nome: "", iniciais: "", conselho: "" }
      : { nome: COACH.nome, iniciais: COACH.iniciais, conselho: COACH.conselho }
  );

  useEffect(() => {
    if (!supabaseEnabled) return;
    let active = true;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("nome, consultoria_id")
        .eq("id", user.id)
        .maybeSingle();
      const nome = prof?.nome || user.email || "Consultor";
      let conselho = "";
      if (prof?.consultoria_id) {
        const { data: cons } = await supabase
          .from("consultorias")
          .select("conselho_tipo, conselho_numero")
          .eq("id", prof.consultoria_id)
          .maybeSingle();
        if (cons?.conselho_tipo && cons?.conselho_numero) {
          conselho = `${cons.conselho_tipo} ${cons.conselho_numero}`;
        }
      }
      if (active) setC({ nome, iniciais: iniciaisDe(nome), conselho });
    })();
    return () => {
      active = false;
    };
  }, []);

  return c;
}

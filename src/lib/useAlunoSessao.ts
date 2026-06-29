"use client";

import { useEffect, useState } from "react";
import { getAluno } from "@/lib/data";
import { getMyAlunoId, fetchAluno } from "@/lib/db";
import { supabaseEnabled } from "@/lib/supabaseEnabled";

export type AlunoSessao = {
  alunoId: string | null;
  nome: string;
  /** "real" = sessão de aluno via Supabase; "proto" = protótipo (sem login). */
  modo: "real" | "proto";
  loading: boolean;
};

/** id do aluno passado por query (?aluno=<id>) — usado no modo protótipo. */
function alunoDaQuery(): string | null {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search).get("aluno");
  return p && p.trim() ? p.trim() : null;
}

/**
 * Resolve o aluno "logado" na área do aluno. Com sessão real de aluno
 * (profiles.aluno_id), usa o banco. Senão, cai no modo protótipo: lê ?aluno=<id>
 * ou usa o primeiro aluno de exemplo (Ana) para demonstrar o fluxo.
 */
export function useAlunoSessao(): AlunoSessao {
  const [s, setS] = useState<AlunoSessao>({
    alunoId: null,
    nome: "",
    modo: "proto",
    loading: true,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      // 1) Sessão real de aluno (Supabase).
      if (supabaseEnabled) {
        try {
          const id = await getMyAlunoId();
          if (id) {
            const aluno = await fetchAluno(id);
            if (active) {
              setS({
                alunoId: id,
                nome: aluno?.nome ?? "Aluno",
                modo: "real",
                loading: false,
              });
            }
            return;
          }
        } catch {
          /* cai no protótipo */
        }
      }
      // 2) Protótipo: ?aluno=<id> → mock; senão Ana ("1").
      const id = alunoDaQuery() ?? "1";
      const mock = getAluno(id);
      if (active) {
        setS({
          alunoId: id,
          nome: mock?.nome ?? "Aluno",
          modo: "proto",
          loading: false,
        });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return s;
}

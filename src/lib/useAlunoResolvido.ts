"use client";

import { useEffect, useState } from "react";
import { getAluno } from "./data";
import { getTestAluno, type TestAluno } from "./testAlunos";
import type { Aluno } from "./types";

export type AlunoResolvido = {
  /** true depois do mount no client (quando o localStorage já pôde ser lido). */
  mounted: boolean;
  /** Nome do aluno (seeded imediato; aluno de teste preenche após o mount). */
  nome: string;
  seeded?: Aluno;
  teste?: TestAluno;
  /** Indica se é um aluno do modelo experimental (localStorage). */
  isTeste: boolean;
  /** true se existe (seeded sempre; teste só após o mount). */
  existe: boolean;
};

/**
 * Resolve um aluno por id a partir dos dados seeded OU do store de teste
 * (localStorage). Seguro para SSR: antes do mount não acusa "não encontrado"
 * (o store só existe no client), evitando 404 indevido em alunos de teste.
 */
export function useAlunoResolvido(id: string): AlunoResolvido {
  const seeded = getAluno(id);
  const [teste, setTeste] = useState<TestAluno | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!seeded) setTeste(getTestAluno(id));
  }, [id, seeded]);

  return {
    mounted,
    nome: seeded?.nome ?? teste?.nome ?? "",
    seeded,
    teste,
    isTeste: !seeded && !!teste,
    existe: !!seeded || (mounted && !!teste),
  };
}

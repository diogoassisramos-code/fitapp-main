// ============================================================
// Revo — Alunos de TESTE do modelo experimental.
// Persistidos no localStorage (sem backend). Limite sistêmico de 3.
// As funções de escrita rodam só em event handlers (client).
// Componentes devem LER via useEffect para evitar mismatch de hidratação.
// ============================================================

export type StatusConvite = "convite_pendente" | "cadastro_completo";

export type TestAluno = {
  id: string;
  nome: string;
  idade: string;
  altura: string;
  email: string;
  telefone: string;
  objetivo: string;
  observacoes: string;
  criadoEm: string; // ISO
  conviteToken: string;
  status: StatusConvite;
};

/** Limite sistêmico de alunos de teste no modelo experimental. */
export const LIMITE_ALUNOS_TESTE = 3;

const STORAGE_KEY = "revo:test-alunos";

function read(): TestAluno[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TestAluno[]) : [];
  } catch {
    return [];
  }
}

function write(list: TestAluno[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getTestAlunos(): TestAluno[] {
  return read();
}

export function getTestAluno(id: string): TestAluno | undefined {
  return read().find((a) => a.id === id);
}

/** Campos opcionais que o aluno ainda precisa completar pelo convite. */
const CAMPOS_OPCIONAIS: { campo: keyof TestAluno; label: string }[] = [
  { campo: "idade", label: "Idade" },
  { campo: "altura", label: "Altura" },
  { campo: "email", label: "E-mail" },
  { campo: "telefone", label: "Telefone" },
  { campo: "objetivo", label: "Objetivo" },
  { campo: "observacoes", label: "Observações" },
];

/** Retorna os rótulos dos campos que faltam preencher (vazios). */
export function camposPendentes(a: TestAluno): string[] {
  return CAMPOS_OPCIONAIS.filter(({ campo }) => !String(a[campo] ?? "").trim()).map(
    (c) => c.label
  );
}

export function countTestAlunos(): number {
  return read().length;
}

export function vagasRestantes(): number {
  return Math.max(0, LIMITE_ALUNOS_TESTE - read().length);
}

export function podeAdicionarAlunoTeste(): boolean {
  return read().length < LIMITE_ALUNOS_TESTE;
}

function slug(nome: string): string {
  return (
    nome
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // remove acentos (ã -> a, é -> e)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "aluno"
  );
}

export type NovoAlunoInput = {
  nome: string;
  idade?: string;
  altura?: string;
  email?: string;
  telefone?: string;
  objetivo?: string;
  observacoes?: string;
};

export type AddResult =
  | { ok: true; aluno: TestAluno }
  | { ok: false; erro: string };

/** Cria um aluno de teste respeitando o limite. Chamar só em event handlers. */
export function addTestAluno(input: NovoAlunoInput): AddResult {
  const list = read();
  if (list.length >= LIMITE_ALUNOS_TESTE) {
    return {
      ok: false,
      erro: `Você atingiu o limite de ${LIMITE_ALUNOS_TESTE} alunos no modelo experimental.`,
    };
  }
  if (!input.nome.trim()) {
    return { ok: false, erro: "Informe o nome do aluno." };
  }
  const token = `${slug(input.nome)}-${list.length + 1}`;
  const aluno: TestAluno = {
    id: `teste-${token}`,
    nome: input.nome.trim(),
    idade: (input.idade ?? "").trim(),
    altura: (input.altura ?? "").trim(),
    email: (input.email ?? "").trim(),
    telefone: (input.telefone ?? "").trim(),
    objetivo: (input.objetivo ?? "").trim(),
    observacoes: (input.observacoes ?? "").trim(),
    criadoEm: new Date().toISOString(),
    conviteToken: token,
    status: "convite_pendente",
  };
  write([...list, aluno]);
  return { ok: true, aluno };
}

export function removeTestAluno(id: string): void {
  write(read().filter((a) => a.id !== id));
}

/** Resolve um aluno de teste pelo token de convite/onboarding. */
export function getTestAlunoByToken(token: string): TestAluno | undefined {
  return read().find((a) => a.conviteToken === token);
}

/**
 * Conclui o onboarding de um aluno de teste: mescla os dados informados e marca
 * status = cadastro_completo. Chamar só em event handlers (client).
 */
export function completarTestAluno(
  id: string,
  patch: Partial<Pick<TestAluno, "email" | "telefone" | "idade" | "objetivo">>
): void {
  const list = read();
  const idx = list.findIndex((a) => a.id === id);
  if (idx < 0) return;
  list[idx] = {
    ...list[idx],
    ...Object.fromEntries(
      Object.entries(patch).filter(([, v]) => String(v ?? "").trim())
    ),
    status: "cadastro_completo",
  };
  write(list);
}

/**
 * Link de compra/onboarding que o coach envia para o aluno. Aponta para a rota
 * pública `/onboarding/[token]` (origin atual no cliente; caminho relativo no
 * SSR). É por aqui que o aluno entra: dados → pagamento → senha → app.
 */
export function conviteUrl(token: string): string {
  const base =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/onboarding/${token}`;
}

// ============================================================
// CoachFit — PAINEL ADMIN da plataforma (persona super-admin).
// Visão da plataforma sobre TODAS as consultorias (≠ dashboard do consultor).
// Dados mock. Datas absolutas relativas a 2026-06-21.
// ============================================================

export type StatusConsultoria =
  | "ativo"
  | "trial"
  | "inadimplente"
  | "suspenso"
  | "cancelado";

export type StatusAssinatura = "ativa" | "trial" | "inadimplente" | "cancelada";

// ---------------- Plano da plataforma (SaaS) ----------------
export type PlanoPlataforma = {
  id: string;
  nome: string; // "Starter" | "Pro" | "Enterprise"
  descricao: string;
  preco: number; // mensal — o que o consultor paga à plataforma
  limiteAlunos: number; // 0 = ilimitado
  recursos: string[];
  assinantes: number; // derivado (nº de consultorias no plano)
  destaque?: boolean;
  status: "ativo" | "arquivado";
};

// ---------------- Consultoria (conta de consultor na plataforma) ----------------
export type Consultoria = {
  id: string;
  consultor: string;
  nomeNegocio: string;
  email: string;
  telefone: string;
  conselho: string;
  cidade: string;
  planoPlataformaId: string;
  status: StatusConsultoria;
  alunosAtivos: number;
  mrr: number; // assinatura paga à plataforma
  faturamentoMensal: number; // GMV gerado pelo consultor (volume processado)
  criadoEm: string;
};

// ---------------- Assinatura da plataforma ----------------
export type AssinaturaPlataforma = {
  id: string;
  consultoriaId: string;
  planoId: string;
  status: StatusAssinatura;
  inicio: string;
  proximaCobranca: string;
  valor: number;
  metodo: string;
};

// ---------------- Aluno (visão da plataforma) ----------------
export type AlunoPlataforma = {
  id: string;
  nome: string;
  consultoriaId: string;
  consultor: string; // denormalizado
  objetivo: string;
  status: "ativo" | "inativo";
  desde: string;
  /** Liga ao aluno "rico" do app do consultor (data.ts) — treino/dieta/protocolo/ficha. */
  coachAlunoId?: string;
};

// ---------------- Transação da plataforma ----------------
export type TransacaoPlataforma = {
  id: string;
  descricao: string;
  consultoria?: string;
  valor: number; // + entrada (assinatura) / - saída
  tipo: "assinatura" | "taxa" | "saida";
  data: string;
  status: "aprovado" | "processando" | "falhou";
};

// ============================================================
// Dados mock
// ============================================================
export const planosPlataforma: PlanoPlataforma[] = [
  {
    id: "pp1",
    nome: "Starter",
    descricao: "Para quem está começando a consultoria.",
    preco: 49,
    limiteAlunos: 30,
    recursos: ["Até 30 alunos", "Treino e dieta", "Check-in semanal", "Suporte por e-mail"],
    assinantes: 3,
    status: "ativo",
  },
  {
    id: "pp2",
    nome: "Pro",
    descricao: "Para consultorias em crescimento.",
    preco: 99,
    limiteAlunos: 150,
    recursos: ["Até 150 alunos", "Protocolos extras", "Link de pagamento", "Vitrine de planos", "Suporte prioritário"],
    assinantes: 3,
    destaque: true,
    status: "ativo",
  },
  {
    id: "pp3",
    nome: "Enterprise",
    descricao: "Operações grandes, sem limites.",
    preco: 249,
    limiteAlunos: 0,
    recursos: ["Alunos ilimitados", "Checkout personalizado", "Relatórios avançados", "Gerente de conta"],
    assinantes: 1,
    status: "ativo",
  },
];

export const consultorias: Consultoria[] = [
  { id: "c1", consultor: "Rafael Mendes", nomeNegocio: "CoachFit", email: "rafael@coachfit.app", telefone: "(11) 98888-1234", conselho: "CREF 123456-G/SP", cidade: "São Paulo, SP", planoPlataformaId: "pp2", status: "ativo", alunosAtivos: 38, mrr: 99, faturamentoMensal: 12480, criadoEm: "2026-01-08" },
  { id: "c2", consultor: "Ana Beatriz Lima", nomeNegocio: "FitAna", email: "ana@fitana.com.br", telefone: "(21) 97777-2233", conselho: "CREF 234567-G/RJ", cidade: "Rio de Janeiro, RJ", planoPlataformaId: "pp2", status: "ativo", alunosAtivos: 52, mrr: 99, faturamentoMensal: 16800, criadoEm: "2025-11-20" },
  { id: "c3", consultor: "Carlos Eduardo Souza", nomeNegocio: "CE Performance", email: "carlos@ceperformance.com", telefone: "(31) 96666-4455", conselho: "CREF 345678-G/MG", cidade: "Belo Horizonte, MG", planoPlataformaId: "pp3", status: "ativo", alunosAtivos: 120, mrr: 249, faturamentoMensal: 42000, criadoEm: "2025-08-15" },
  { id: "c4", consultor: "Juliana Reis", nomeNegocio: "JR Nutri & Treino", email: "ju@jrnutri.com", telefone: "(41) 95555-6677", conselho: "CRN 45678/PR", cidade: "Curitiba, PR", planoPlataformaId: "pp1", status: "trial", alunosAtivos: 12, mrr: 49, faturamentoMensal: 3600, criadoEm: "2026-06-10" },
  { id: "c5", consultor: "Marcos Vinícius", nomeNegocio: "MV Treinamento", email: "marcos@mvtreino.com", telefone: "(51) 94444-7788", conselho: "CREF 567890-G/RS", cidade: "Porto Alegre, RS", planoPlataformaId: "pp1", status: "ativo", alunosAtivos: 24, mrr: 49, faturamentoMensal: 7200, criadoEm: "2026-03-02" },
  { id: "c6", consultor: "Patrícia Gomes", nomeNegocio: "PG Saúde", email: "patricia@pgsaude.com", telefone: "(85) 93333-8899", conselho: "CREF 678901-G/CE", cidade: "Fortaleza, CE", planoPlataformaId: "pp2", status: "inadimplente", alunosAtivos: 41, mrr: 99, faturamentoMensal: 13000, criadoEm: "2025-10-12" },
  { id: "c7", consultor: "Diego Santos", nomeNegocio: "DS Coach", email: "diego@dscoach.com", telefone: "(71) 92222-9900", conselho: "CREF 789012-G/BA", cidade: "Salvador, BA", planoPlataformaId: "pp1", status: "ativo", alunosAtivos: 18, mrr: 49, faturamentoMensal: 5400, criadoEm: "2026-04-19" },
];

export const assinaturas: AssinaturaPlataforma[] = consultorias.map((c, i) => ({
  id: `as${i + 1}`,
  consultoriaId: c.id,
  planoId: c.planoPlataformaId,
  status:
    c.status === "ativo"
      ? "ativa"
      : c.status === "trial"
        ? "trial"
        : c.status === "inadimplente"
          ? "inadimplente"
          : "cancelada",
  inicio: c.criadoEm,
  proximaCobranca:
    c.status === "trial" ? "2026-06-24" : ["2026-06-28", "2026-07-02", "2026-07-05", "2026-06-25"][i % 4],
  valor: c.mrr,
  metodo: i % 3 === 0 ? "Pix" : "Cartão",
}));

export const alunosPlataforma: AlunoPlataforma[] = [
  // Consultoria 1 — Rafael (CoachFit) — espelha o app do consultor
  { id: "ap1", nome: "Ana Paula Souza", consultoriaId: "c1", consultor: "Rafael Mendes", objetivo: "Hipertrofia", status: "ativo", desde: "2026-05-03", coachAlunoId: "1" },
  { id: "ap2", nome: "Bruno Lima", consultoriaId: "c1", consultor: "Rafael Mendes", objetivo: "Emagrecimento", status: "ativo", desde: "2026-04-12", coachAlunoId: "2" },
  { id: "ap3", nome: "Eduarda Nunes", consultoriaId: "c1", consultor: "Rafael Mendes", objetivo: "Emagrecimento", status: "ativo", desde: "2026-02-10", coachAlunoId: "5" },
  { id: "ap4", nome: "Felipe Costa", consultoriaId: "c1", consultor: "Rafael Mendes", objetivo: "Condicionamento", status: "ativo", desde: "2026-01-15", coachAlunoId: "6" },
  // Consultoria 2 — Ana Beatriz (FitAna)
  { id: "ap5", nome: "Larissa Martins", consultoriaId: "c2", consultor: "Ana Beatriz Lima", objetivo: "Hipertrofia", status: "ativo", desde: "2026-03-21" },
  { id: "ap6", nome: "Rodrigo Alves", consultoriaId: "c2", consultor: "Ana Beatriz Lima", objetivo: "Emagrecimento", status: "ativo", desde: "2026-02-28" },
  { id: "ap7", nome: "Camila Ferreira", consultoriaId: "c2", consultor: "Ana Beatriz Lima", objetivo: "Saúde", status: "ativo", desde: "2026-05-19" },
  // Consultoria 3 — Carlos (CE Performance)
  { id: "ap8", nome: "Thiago Barbosa", consultoriaId: "c3", consultor: "Carlos Eduardo Souza", objetivo: "Performance", status: "ativo", desde: "2025-09-10" },
  { id: "ap9", nome: "Mariana Dias", consultoriaId: "c3", consultor: "Carlos Eduardo Souza", objetivo: "Hipertrofia", status: "ativo", desde: "2026-01-05" },
  { id: "ap10", nome: "Gustavo Rocha", consultoriaId: "c3", consultor: "Carlos Eduardo Souza", objetivo: "Emagrecimento", status: "inativo", desde: "2025-11-30" },
  // Consultoria 4 — Juliana (JR Nutri)
  { id: "ap11", nome: "Beatriz Castro", consultoriaId: "c4", consultor: "Juliana Reis", objetivo: "Reeducação alimentar", status: "ativo", desde: "2026-06-12" },
  { id: "ap12", nome: "Lucas Pinto", consultoriaId: "c4", consultor: "Juliana Reis", objetivo: "Emagrecimento", status: "ativo", desde: "2026-06-15" },
  // Consultoria 5 — Marcos (MV)
  { id: "ap13", nome: "Renata Cunha", consultoriaId: "c5", consultor: "Marcos Vinícius", objetivo: "Condicionamento", status: "ativo", desde: "2026-03-08" },
  { id: "ap14", nome: "Paulo Henrique", consultoriaId: "c5", consultor: "Marcos Vinícius", objetivo: "Hipertrofia", status: "ativo", desde: "2026-04-01" },
  // Consultoria 6 — Patrícia (PG)
  { id: "ap15", nome: "Sofia Almeida", consultoriaId: "c6", consultor: "Patrícia Gomes", objetivo: "Saúde", status: "ativo", desde: "2025-12-02" },
  { id: "ap16", nome: "André Moreira", consultoriaId: "c6", consultor: "Patrícia Gomes", objetivo: "Emagrecimento", status: "ativo", desde: "2026-02-18" },
  // Consultoria 7 — Diego (DS)
  { id: "ap17", nome: "Vinícius Teixeira", consultoriaId: "c7", consultor: "Diego Santos", objetivo: "Hipertrofia", status: "ativo", desde: "2026-04-22" },
  { id: "ap18", nome: "Isabela Ramos", consultoriaId: "c7", consultor: "Diego Santos", objetivo: "Condicionamento", status: "ativo", desde: "2026-05-10" },
];

export const transacoesPlataforma: TransacaoPlataforma[] = [
  { id: "tp1", descricao: "Assinatura Pro — CoachFit", consultoria: "CoachFit", valor: 99, tipo: "assinatura", data: "2026-06-28", status: "aprovado" },
  { id: "tp2", descricao: "Assinatura Pro — FitAna", consultoria: "FitAna", valor: 99, tipo: "assinatura", data: "2026-06-20", status: "aprovado" },
  { id: "tp3", descricao: "Assinatura Enterprise — CE Performance", consultoria: "CE Performance", valor: 249, tipo: "assinatura", data: "2026-06-15", status: "aprovado" },
  { id: "tp4", descricao: "Assinatura Starter — MV Treinamento", consultoria: "MV Treinamento", valor: 49, tipo: "assinatura", data: "2026-06-18", status: "aprovado" },
  { id: "tp5", descricao: "Assinatura Pro — PG Saúde", consultoria: "PG Saúde", valor: 99, tipo: "assinatura", data: "2026-06-12", status: "falhou" },
  { id: "tp6", descricao: "Taxa de processamento (gateway)", valor: -86.4, tipo: "taxa", data: "2026-06-19", status: "aprovado" },
  { id: "tp7", descricao: "Assinatura Starter — DS Coach", consultoria: "DS Coach", valor: 49, tipo: "assinatura", data: "2026-06-19", status: "aprovado" },
  { id: "tp8", descricao: "Repasse/infra (servidores)", valor: -1200, tipo: "saida", data: "2026-06-05", status: "aprovado" },
];

// ---------------- Financeiro da plataforma ----------------
export const adminFinanceiro = {
  mrrPlataforma: consultorias.reduce((s, c) => s + (c.status === "ativo" || c.status === "trial" ? c.mrr : 0), 0),
  faturamentoMes: 644,
  volumeProcessadoMes: consultorias.reduce((s, c) => s + c.faturamentoMensal, 0), // GMV
  receitaAcumulada: 3820,
  inadimplencia: { valor: 99, consultorias: 1 },
  // Receita da plataforma (assinaturas) por mês
  faturamento6m: [
    { mes: "Jan", valor: 290 },
    { mes: "Fev", valor: 340 },
    { mes: "Mar", valor: 440 },
    { mes: "Abr", valor: 540 },
    { mes: "Mai", valor: 595 },
    { mes: "Jun", valor: 644 },
  ],
  // Volume financeiro processado (GMV) por mês
  volume6m: [
    { mes: "Jan", valor: 61000 },
    { mes: "Fev", valor: 68000 },
    { mes: "Mar", valor: 79000 },
    { mes: "Abr", valor: 88000 },
    { mes: "Mai", valor: 95000 },
    { mes: "Jun", valor: 100480 },
  ],
};

// ---------------- Estatísticas (visão geral) ----------------
export const adminStats = {
  totalConsultorias: consultorias.length,
  consultoriasAtivas: consultorias.filter((c) => c.status === "ativo" || c.status === "trial").length,
  totalAlunos: consultorias.reduce((s, c) => s + c.alunosAtivos, 0),
  mrrPlataforma: consultorias.reduce((s, c) => s + (c.status === "ativo" || c.status === "trial" ? c.mrr : 0), 0),
  volumeProcessadoMes: consultorias.reduce((s, c) => s + c.faturamentoMensal, 0),
  novasConsultoriasMes: consultorias.filter((c) => c.criadoEm >= "2026-06-01").length,
  inadimplentes: consultorias.filter((c) => c.status === "inadimplente").length,
  churnMes: "1,4%",
};

// ============================================================
// Acessores
// ============================================================
export function listConsultorias(): Consultoria[] {
  return consultorias;
}
export function getConsultoria(id: string): Consultoria | undefined {
  return consultorias.find((c) => c.id === id);
}
export function listPlanosPlataforma(): PlanoPlataforma[] {
  return planosPlataforma;
}
export function getPlanoPlataforma(id: string): PlanoPlataforma | undefined {
  return planosPlataforma.find((p) => p.id === id);
}
export function planoPlataformaNome(id: string): string {
  return getPlanoPlataforma(id)?.nome ?? "—";
}
export function listAssinaturas(): AssinaturaPlataforma[] {
  return assinaturas;
}
export function getAssinaturaPorConsultoria(
  consultoriaId: string
): AssinaturaPlataforma | undefined {
  return assinaturas.find((a) => a.consultoriaId === consultoriaId);
}
export function listAlunosPlataforma(): AlunoPlataforma[] {
  return alunosPlataforma;
}
export function listAlunosPorConsultoria(consultoriaId: string): AlunoPlataforma[] {
  return alunosPlataforma.filter((a) => a.consultoriaId === consultoriaId);
}
export function getAlunoPlataforma(id: string): AlunoPlataforma | undefined {
  return alunosPlataforma.find((a) => a.id === id);
}
export function listTransacoesPlataforma(): TransacaoPlataforma[] {
  return transacoesPlataforma;
}

export const STATUS_CONSULTORIA: Record<
  StatusConsultoria,
  { label: string; variant: "ok" | "late" | "pending" | "new" | "off" }
> = {
  ativo: { label: "Ativo", variant: "ok" },
  trial: { label: "Trial", variant: "new" },
  inadimplente: { label: "Inadimplente", variant: "late" },
  suspenso: { label: "Suspenso", variant: "off" },
  cancelado: { label: "Cancelado", variant: "off" },
};

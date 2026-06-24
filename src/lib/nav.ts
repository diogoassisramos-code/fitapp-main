export type NavItem = {
  href: string;
  label: string;
  icon: string; // Tabler icon name, sem o prefixo "ti ti-"
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Resumo", icon: "layout-dashboard" },
  { href: "/alunos", label: "Alunos", icon: "users" },
  { href: "/planos", label: "Planos & pagamentos", icon: "credit-card" },
  { href: "/financeiro", label: "Financeiro", icon: "cash" },
  { href: "/configuracoes", label: "Configurações", icon: "settings" },
];

/** Usuário de exemplo do spec. */
export const COACH = {
  nome: "Rafael Mendes",
  conselho: "CREF 123456-G/SP",
  iniciais: "RM",
  saldo: 4820.5,
};

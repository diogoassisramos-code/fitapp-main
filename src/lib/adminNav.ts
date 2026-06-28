export type AdminNavItem = {
  href: string;
  label: string;
  icon: string; // Tabler, sem prefixo
};

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Visão geral", icon: "layout-dashboard" },
  { href: "/admin/consultores", label: "Consultorias", icon: "briefcase" },
  { href: "/admin/alunos", label: "Alunos", icon: "users" },
  { href: "/admin/vincular", label: "Vincular aluno", icon: "user-plus" },
  { href: "/admin/planos", label: "Planos da plataforma", icon: "stack-2" },
  { href: "/admin/assinaturas", label: "Assinaturas", icon: "receipt" },
  { href: "/admin/financeiro", label: "Financeiro", icon: "chart-line" },
  { href: "/admin/configuracoes", label: "Configurações", icon: "settings" },
];

export const ADMIN_USER = {
  nome: "Admin CoachFit",
  email: "admin@coachfit.app",
  iniciais: "AD",
};

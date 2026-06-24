import type {
  StatusPagamento,
  TipoCobranca,
  Modalidade,
  PeriodoRecorrencia,
  FormaPagamento,
  FrequenciaCheckin,
} from "./types";
import type { BadgeVariant } from "@/components/ui/StatusBadge";

/** Formata valor em Reais: 4820.5 -> "R$ 4.820,50" */
export function brl(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/** Formata valor sem o símbolo: 4820.5 -> "4.820,50" */
export function brlNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** "2026-06-28" -> "28/06" */
export function dataCurta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** "2026-06-28" -> "28 jun 2026" */
export function dataLonga(iso: string): string {
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [y, m, d] = iso.split("-");
  return `${d} ${meses[Number(m) - 1]} ${y}`;
}

const HOJE = "2026-06-21";

/** true se a data já passou (relativo a 2026-06-21). */
export function estaAtrasada(iso: string): boolean {
  return iso < HOJE;
}

/** Mapeia status de pagamento para variante de badge + rótulo. */
export const STATUS_PAGAMENTO: Record<
  StatusPagamento,
  { label: string; variant: BadgeVariant }
> = {
  em_dia: { label: "Em dia", variant: "ok" },
  pendente: { label: "Pendente", variant: "pending" },
  atrasado: { label: "Atrasado", variant: "late" },
  novo: { label: "Novo", variant: "new" },
};

export const TIPO_COBRANCA_LABEL: Record<TipoCobranca, string> = {
  recorrente: "Assinatura recorrente",
  pacote: "Pacote fechado",
  avulso: "Cobrança avulsa",
};

export const MODALIDADE_LABEL: Record<Modalidade, string> = {
  online: "Online",
  personal: "Personal",
  consulta: "Consulta",
};

export const RECORRENCIA_LABEL: Record<PeriodoRecorrencia, string> = {
  semanal: "/semana",
  mensal: "/mês",
  trimestral: "/trimestre",
  anual: "/ano",
};

export const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  cartao: "Cartão",
  pix: "Pix",
  boleto: "Boleto",
};

export const FREQUENCIA_CHECKIN_LABEL: Record<FrequenciaCheckin, string> = {
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
};

/** Rótulos curtos dos dias da semana. Índice 0=Dom … 6=Sáb. */
export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const DIAS_SEMANA_LONGO = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

/** [1,3] -> "Seg, Qua". */
export function diasSemanaResumo(dias: number[]): string {
  if (!dias.length) return "—";
  return dias
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DIAS_SEMANA[d])
    .join(", ");
}

/** Lista de incluídos -> resumo textual. Ex.: "Treino · Dieta · Check-in" */
export function inclusoResumo(incluso: {
  treino: boolean;
  dieta: boolean;
  protocolos: boolean;
  checkin: boolean;
  chat: boolean;
}): string {
  const partes: string[] = [];
  if (incluso.treino) partes.push("Treino");
  if (incluso.dieta) partes.push("Dieta");
  if (incluso.protocolos) partes.push("Protocolos");
  if (incluso.checkin) partes.push("Check-in");
  if (incluso.chat) partes.push("Chat");
  return partes.join(" · ") || "—";
}

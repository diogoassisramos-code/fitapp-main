// ============================================================
// CoachFit — Modelo de dados (§4 do spec)
// ============================================================

export type StatusPagamento = "em_dia" | "pendente" | "atrasado" | "novo";
export type TipoCobranca = "recorrente" | "pacote" | "avulso";
export type Modalidade = "online" | "personal" | "consulta";
export type StatusPlano = "ativo" | "pausado";
export type PeriodoRecorrencia = "semanal" | "mensal" | "trimestral" | "anual";
export type FormaPagamento = "cartao" | "pix" | "boleto";
export type UnidadePrazo = "horas" | "dias_uteis";
export type FrequenciaCheckin = "semanal" | "quinzenal" | "mensal";

/** Configuração de check-in agendado por plano (§3.7 — personalizar dias de check-in). */
export type CheckinConfig = {
  frequencia: FrequenciaCheckin;
  /** Dias da semana do check-in: 0=Dom … 6=Sáb. Pode ter mais de um. */
  diasSemana: number[];
  /** Horário do lembrete (HH:mm). */
  horario?: string;
};

// ---------------- Prestador ----------------
export type Conselho = { tipo: "CREF" | "CRN" | "CRM"; numero: string };

export type Prestador = {
  id: string;
  nome: string;
  conselho: Conselho;
  saldo: number;
  aLiberar: number;
  contaSaque: { pix?: string; banco?: string; agencia?: string; conta?: string };
  dadosFiscais: { documento: string }; // CPF/CNPJ
  perfil: { nomeNegocio: string; logo?: string; bio: string; especialidade: string };
  checkoutGlobal: { logo?: string; cor: string };
  notificacoes: {
    novoPagamento: boolean;
    checkinRecebido: boolean;
    pagamentoAtrasado: boolean;
    novoAluno: boolean;
  };
};

// ---------------- Plano ----------------
export type PlanoIncluso = {
  treino: boolean;
  dieta: boolean;
  protocolos: boolean;
  checkin: boolean;
  chat: boolean;
};

export type Plano = {
  id: string;
  nome: string;
  descricao: string;
  imagemCapa?: string;
  tipoCobranca: TipoCobranca;
  modalidade?: Modalidade;
  prazoEntrega: { valor: number; unidade: UnidadePrazo };
  incluso: PlanoIncluso;
  preco: number;
  periodoRecorrencia?: PeriodoRecorrencia;
  formasPagamento: FormaPagamento[];
  parcelamentoMax?: number;
  solicitarDocumentos: boolean;
  agendarCheckins: boolean;
  checkinConfig?: CheckinConfig; // usado quando agendarCheckins = true
  upsell?: { ativo: boolean; planoId?: string };
  visibilidade: { venda: boolean; vitrine: boolean; renovacao: boolean };
  checkoutCustom?: { logo?: string; cor?: string };
  slug: string;
  linkPagamento: string;
  status: StatusPlano;
  assinantesAtivos: number; // derivado
};

// ---------------- Aluno (assinatura) ----------------
export type Aluno = {
  id: string;
  planoId: string;
  nome: string;
  cpf: string;
  email: string;
  objetivo: string;
  statusPagamento: StatusPagamento;
  proximoVencimento: string; // ISO date
  inicio: string; // ISO date
  pesoInicial: number;
  pesoAtual: number;
  aderenciaTreino: number; // 0-100 (%)
  // flags derivadas
  checkinPendente: boolean;
  aguardandoProtocolo: boolean;
};

// ---------------- Treino ----------------
export type VideoOrigem = "biblioteca" | "proprio" | "vazio";
export type ExercicioVideo = { origem: VideoOrigem; url?: string };

/** Detalhe de uma série específica (aquecimento, válida, top-set, drop…). */
export type SerieSpec = {
  rotulo: string; // "Aquecimento", "Válida", "Top set", "Back-off"…
  reps: string;
  descansoSeg: number;
  obs?: string; // orientação daquela série
};

export type Exercicio = {
  id: string;
  ordem: number;
  nome: string;
  grupo: string;
  series: number;
  reps: string; // "8-12"
  descansoSeg: number;
  video: ExercicioVideo;
  /** Orientações do coach: como executar o exercício. */
  observacoes?: string;
  /**
   * Detalhamento série-a-série (opcional). Quando presente, o coach define
   * cada série com reps/descanso/orientação próprios; o app do aluno usa isso
   * no player guiado (descanso por série).
   */
  seriesDetalhe?: SerieSpec[];
};

export type Treino = {
  id: string;
  alunoId: string;
  nome: string;
  atualizadoEm: string;
  rascunho: boolean;
  exercicios: Exercicio[];
};

// ---------------- Dieta ----------------
export type Macros = { kcal: number; p: number; c: number; g: number };

export type Alimento = {
  id: string;
  nome: string;
  quantidade: { valor: number; unidade: string };
  macros: Macros;
  substituicoes: string[];
  /** Alimento criado pelo coach (fora da tabela TACO). */
  custom?: boolean;
  /** true quando o coach criou o alimento sem informar os macros (opcionais). */
  semMacros?: boolean;
  /** Orientações do coach: como consumir este alimento. */
  observacoes?: string;
};

export type Refeicao = {
  id: string;
  ordem: number;
  nome: string;
  horario: string;
  alimentos: Alimento[];
  /** Orientações do coach para a refeição inteira (como consumir). */
  observacoes?: string;
};

export type Dieta = {
  id: string;
  alunoId: string;
  metaKcal: number;
  rascunho: boolean;
  refeicoes: Refeicao[];
};

// ---------------- Protocolo (extras: suplementos, manipulados, etc.) ----------------
export type ProtocoloItem = {
  id: string;
  ordem: number;
  nome: string;
  dose: string; // ex.: "5 g", "2 cápsulas"
  horario?: string; // ex.: "Ao acordar", "Pós-treino"
  observacoes?: string; // como/quando tomar (avisos curtos)
  /** Detalhamento de uso que o aluno vê no app: como usar o item. */
  comoUsar?: string; // instrução completa de uso
  comOQue?: string; // "250 ml de água", "refeição com gordura"…
  beneficio?: string; // pra que serve
  duracao?: string; // "Contínuo", "Só em dias de treino", "8 semanas"…
};

export type ProtocoloBloco = {
  id: string;
  ordem: number;
  nome: string; // ex.: "Suplementos", "Manipulados"
  itens: ProtocoloItem[];
};

export type Protocolo = {
  id: string;
  alunoId: string;
  rascunho: boolean;
  blocos: ProtocoloBloco[];
};

// ---------------- Check-in ----------------
/** Foto de progresso enviada pelo aluno no check-in. */
export type FotoCheckin = {
  id: string;
  angulo: string; // "Frente" | "Lado" | "Costas" | ...
  url: string;
};

export type CheckIn = {
  id: string;
  alunoId: string;
  semana: number;
  enviadoEm: string;
  peso: number;
  fotos: FotoCheckin[];
  avaliacoes: { energia: number; sono: number; dieta: number }; // 1-5
  treinosFeitos: number;
  treinosTotais: number;
  comentario: string;
  respostaCoach?: string;
  status: "pendente" | "respondido";
};

// ---------------- Transação / Saque ----------------
export type Transacao = {
  id: string;
  alunoId?: string;
  planoId?: string;
  descricao: string;
  valor: number; // positivo entrada, negativo saída
  metodo: string;
  data: string;
  status: "aprovado" | "processando" | "falhou";
  tipo: "entrada" | "saida";
};

export type ProximoRecebimento = {
  id: string;
  alunoNome: string;
  planoNome: string;
  valor: number;
  data: string;
  metodo: string;
};

// ---------------- Biblioteca ----------------
export type ExercicioModelo = {
  id: string;
  nome: string;
  grupo: string;
  videoUrl: string; // vídeo padrão da biblioteca
};

export type AlimentoModelo = {
  id: string;
  nome: string;
  porcao: string;
  macros: Macros; // por porção de referência
};

export type SuplementoModelo = {
  id: string;
  nome: string;
  categoria: string;
  doseSugerida: string;
};

// ---------------- Anamnese ----------------
export type TipoPergunta = "texto" | "numero" | "escolha" | "foto";

export type PerguntaAnamnese = {
  id: string;
  ordem: number;
  texto: string;
  tipo: TipoPergunta;
  obrigatoria: boolean;
  opcoes?: string[]; // quando tipo = escolha
};

export type AnamneseTemplate = {
  perguntas: PerguntaAnamnese[];
};

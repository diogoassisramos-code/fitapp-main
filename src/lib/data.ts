// ============================================================
// CoachFit — Dados mock + acessores.
// Toda tela lê daqui. Datas absolutas relativas a 2026-06-21.
// ============================================================
import type {
  Prestador,
  Plano,
  Aluno,
  Treino,
  Dieta,
  Protocolo,
  CheckIn,
  FotoCheckin,
  Transacao,
  ProximoRecebimento,
  ExercicioModelo,
  AlimentoModelo,
  SuplementoModelo,
  AnamneseTemplate,
} from "./types";

// ---------------- Prestador ----------------
export const coach: Prestador = {
  id: "coach-1",
  nome: "Rafael Mendes",
  conselho: { tipo: "CREF", numero: "123456-G/SP" },
  saldo: 4820.5,
  aLiberar: 2310.0,
  contaSaque: { pix: "rafael@coachfit.app", banco: "Nubank", agencia: "0001", conta: "12345678-9" },
  dadosFiscais: { documento: "123.456.789-00" },
  perfil: {
    nomeNegocio: "CoachFit",
    bio: "Consultoria fitness online com foco em hipertrofia e emagrecimento.",
    especialidade: "Hipertrofia & Emagrecimento",
  },
  checkoutGlobal: { cor: "#2347E6" },
  notificacoes: {
    novoPagamento: true,
    checkinRecebido: true,
    pagamentoAtrasado: true,
    novoAluno: true,
  },
};

// ---------------- Planos ----------------
export const planos: Plano[] = [
  {
    id: "p1",
    nome: "Consultoria Online Mensal",
    descricao:
      "Acompanhamento completo: treino e dieta personalizados, check-in semanal e suporte por chat.",
    tipoCobranca: "recorrente",
    modalidade: "online",
    prazoEntrega: { valor: 2, unidade: "dias_uteis" },
    incluso: { treino: true, dieta: true, protocolos: true, checkin: true, chat: true },
    preco: 199,
    periodoRecorrencia: "mensal",
    formasPagamento: ["cartao", "pix"],
    solicitarDocumentos: true,
    agendarCheckins: true,
    checkinConfig: { frequencia: "semanal", diasSemana: [1], horario: "09:00" },
    visibilidade: { venda: true, vitrine: true, renovacao: true },
    slug: "consultoria-online-mensal",
    linkPagamento: "https://coachfit.app/p/consultoria-online-mensal",
    status: "ativo",
    assinantesAtivos: 24,
  },
  {
    id: "p2",
    nome: "Acompanhamento Personal",
    descricao: "Treino presencial 3x/semana com avaliação física e dieta inclusa.",
    tipoCobranca: "recorrente",
    modalidade: "personal",
    prazoEntrega: { valor: 1, unidade: "dias_uteis" },
    incluso: { treino: true, dieta: true, protocolos: true, checkin: true, chat: true },
    preco: 450,
    periodoRecorrencia: "mensal",
    formasPagamento: ["cartao", "pix", "boleto"],
    solicitarDocumentos: true,
    agendarCheckins: true,
    checkinConfig: { frequencia: "semanal", diasSemana: [5], horario: "18:00" },
    visibilidade: { venda: true, vitrine: true, renovacao: true },
    slug: "acompanhamento-personal",
    linkPagamento: "https://coachfit.app/p/acompanhamento-personal",
    status: "ativo",
    assinantesAtivos: 8,
  },
  {
    id: "p3",
    nome: "Pacote 12 Semanas",
    descricao: "Projeto fechado de transformação em 12 semanas. Pagamento único, parcelável.",
    tipoCobranca: "pacote",
    modalidade: "online",
    prazoEntrega: { valor: 3, unidade: "dias_uteis" },
    incluso: { treino: true, dieta: true, protocolos: false, checkin: true, chat: false },
    preco: 1290,
    formasPagamento: ["cartao", "pix"],
    parcelamentoMax: 12,
    solicitarDocumentos: true,
    agendarCheckins: true,
    checkinConfig: { frequencia: "quinzenal", diasSemana: [1], horario: "09:00" },
    upsell: { ativo: true },
    visibilidade: { venda: true, vitrine: true, renovacao: false },
    slug: "pacote-12-semanas",
    linkPagamento: "https://coachfit.app/p/pacote-12-semanas",
    status: "ativo",
    assinantesAtivos: 5,
  },
  {
    id: "p4",
    nome: "Consulta Avulsa",
    descricao: "Consulta única de avaliação e orientação. Sem recorrência.",
    tipoCobranca: "avulso",
    modalidade: "consulta",
    prazoEntrega: { valor: 24, unidade: "horas" },
    incluso: { treino: false, dieta: true, protocolos: false, checkin: false, chat: false },
    preco: 180,
    formasPagamento: ["cartao", "pix"],
    parcelamentoMax: 3,
    solicitarDocumentos: false,
    agendarCheckins: false,
    visibilidade: { venda: false, vitrine: false, renovacao: false },
    slug: "consulta-avulsa",
    linkPagamento: "https://coachfit.app/p/consulta-avulsa",
    status: "pausado",
    assinantesAtivos: 1,
  },
];

// ---------------- Alunos ----------------
export const alunos: Aluno[] = [
  {
    id: "1",
    planoId: "p1",
    nome: "Ana Paula Souza",
    cpf: "111.222.333-44",
    email: "ana.souza@email.com",
    objetivo: "Hipertrofia",
    statusPagamento: "em_dia",
    proximoVencimento: "2026-06-28",
    inicio: "2026-05-03",
    pesoInicial: 62.0,
    pesoAtual: 60.4,
    aderenciaTreino: 92,
    checkinPendente: true,
    aguardandoProtocolo: false,
  },
  {
    id: "2",
    planoId: "p2",
    nome: "Bruno Lima",
    cpf: "222.333.444-55",
    email: "bruno.lima@email.com",
    objetivo: "Emagrecimento",
    statusPagamento: "pendente",
    proximoVencimento: "2026-06-22",
    inicio: "2026-04-12",
    pesoInicial: 88.0,
    pesoAtual: 83.1,
    aderenciaTreino: 74,
    checkinPendente: true,
    aguardandoProtocolo: false,
  },
  {
    id: "3",
    planoId: "p4",
    nome: "Carla Reis",
    cpf: "333.444.555-66",
    email: "carla.reis@email.com",
    objetivo: "Avaliação",
    statusPagamento: "atrasado",
    proximoVencimento: "2026-06-14",
    inicio: "2026-03-20",
    pesoInicial: 70.0,
    pesoAtual: 69.2,
    aderenciaTreino: 48,
    checkinPendente: false,
    aguardandoProtocolo: false,
  },
  {
    id: "4",
    planoId: "p1",
    nome: "Diego Martins",
    cpf: "444.555.666-77",
    email: "diego.martins@email.com",
    objetivo: "Hipertrofia",
    statusPagamento: "novo",
    proximoVencimento: "2026-07-19",
    inicio: "2026-06-19",
    pesoInicial: 75.0,
    pesoAtual: 75.0,
    aderenciaTreino: 0,
    checkinPendente: false,
    aguardandoProtocolo: true,
  },
  {
    id: "5",
    planoId: "p1",
    nome: "Eduarda Nunes",
    cpf: "555.666.777-88",
    email: "eduarda.nunes@email.com",
    objetivo: "Emagrecimento",
    statusPagamento: "em_dia",
    proximoVencimento: "2026-07-02",
    inicio: "2026-02-10",
    pesoInicial: 80.0,
    pesoAtual: 72.5,
    aderenciaTreino: 88,
    checkinPendente: false,
    aguardandoProtocolo: false,
  },
  {
    id: "6",
    planoId: "p2",
    nome: "Felipe Costa",
    cpf: "666.777.888-99",
    email: "felipe.costa@email.com",
    objetivo: "Condicionamento",
    statusPagamento: "em_dia",
    proximoVencimento: "2026-07-05",
    inicio: "2026-01-15",
    pesoInicial: 78.0,
    pesoAtual: 79.5,
    aderenciaTreino: 95,
    checkinPendente: false,
    aguardandoProtocolo: false,
  },
  {
    id: "7",
    planoId: "p1",
    nome: "Gabriela Alves",
    cpf: "777.888.999-00",
    email: "gabriela.alves@email.com",
    objetivo: "Hipertrofia",
    statusPagamento: "pendente",
    proximoVencimento: "2026-06-24",
    inicio: "2026-05-28",
    pesoInicial: 58.0,
    pesoAtual: 58.6,
    aderenciaTreino: 81,
    checkinPendente: true,
    aguardandoProtocolo: false,
  },
];

// ---------------- Treinos ----------------
const treinos: Treino[] = [
  {
    id: "t1",
    alunoId: "1",
    nome: "Treino A — Superiores",
    atualizadoEm: "2026-06-15",
    rascunho: false,
    exercicios: [
      { id: "e1", ordem: 1, nome: "Supino reto com barra", grupo: "Peito", series: 4, reps: "8-10", descansoSeg: 90, video: { origem: "biblioteca", url: "https://youtube.com/lib/supino" }, observacoes: "Desça a barra controlado (2s na excêntrica) até tocar levemente o peito. Cotovelos a ~45° do tronco." },
      { id: "e2", ordem: 2, nome: "Crucifixo com halteres", grupo: "Peito", series: 3, reps: "10-12", descansoSeg: 60, video: { origem: "proprio", url: "https://youtube.com/coach/crucifixo" } },
      { id: "e3", ordem: 3, nome: "Puxada frontal", grupo: "Costas", series: 4, reps: "10-12", descansoSeg: 75, video: { origem: "biblioteca", url: "https://youtube.com/lib/puxada" } },
      { id: "e4", ordem: 4, nome: "Remada curvada", grupo: "Costas", series: 3, reps: "8-10", descansoSeg: 90, video: { origem: "vazio" } },
      { id: "e5", ordem: 5, nome: "Desenvolvimento militar", grupo: "Ombros", series: 3, reps: "10-12", descansoSeg: 60, video: { origem: "biblioteca", url: "https://youtube.com/lib/desenvolvimento" } },
    ],
  },
];

// ---------------- Dietas ----------------
const dietas: Dieta[] = [
  {
    id: "d1",
    alunoId: "1",
    metaKcal: 2200,
    rascunho: false,
    refeicoes: [
      {
        id: "r1",
        ordem: 1,
        nome: "Café da manhã",
        horario: "07:30",
        observacoes: "Faça em até 1h após acordar. Mastigue devagar e beba 1 copo de água antes.",
        alimentos: [
          { id: "a1", nome: "Ovos mexidos", quantidade: { valor: 3, unidade: "unid" }, macros: { kcal: 234, p: 18, c: 2, g: 16 }, substituicoes: ["Omelete", "Ovos cozidos"], observacoes: "Prepare em frigideira antiaderente, sem óleo. Tempere só com sal e pimenta." },
          { id: "a2", nome: "Pão integral", quantidade: { valor: 2, unidade: "fatias" }, macros: { kcal: 160, p: 8, c: 28, g: 2 }, substituicoes: ["Tapioca", "Aveia"] },
          { id: "a3", nome: "Banana", quantidade: { valor: 1, unidade: "unid" }, macros: { kcal: 105, p: 1, c: 27, g: 0 }, substituicoes: ["Maçã", "Mamão"] },
        ],
      },
      {
        id: "r2",
        ordem: 2,
        nome: "Almoço",
        horario: "12:30",
        alimentos: [
          { id: "a4", nome: "Peito de frango grelhado", quantidade: { valor: 150, unidade: "g" }, macros: { kcal: 248, p: 46, c: 0, g: 5 }, substituicoes: ["Patinho moído", "Tilápia"] },
          { id: "a5", nome: "Arroz branco", quantidade: { valor: 120, unidade: "g" }, macros: { kcal: 156, p: 3, c: 34, g: 0 }, substituicoes: ["Arroz integral", "Batata doce"] },
          { id: "a6", nome: "Feijão preto", quantidade: { valor: 80, unidade: "g" }, macros: { kcal: 62, p: 5, c: 11, g: 0 }, substituicoes: ["Lentilha", "Grão de bico"] },
        ],
      },
      {
        id: "r3",
        ordem: 3,
        nome: "Pós-treino",
        horario: "18:00",
        alimentos: [
          { id: "a7", nome: "Whey protein", quantidade: { valor: 30, unidade: "g" }, macros: { kcal: 120, p: 24, c: 3, g: 1 }, substituicoes: ["Albumina"] },
        ],
      },
    ],
  },
];

// ---------------- Protocolos (extras) ----------------
const protocolos: Protocolo[] = [
  {
    id: "pr1",
    alunoId: "1",
    rascunho: false,
    blocos: [
      {
        id: "pb1",
        ordem: 1,
        nome: "Suplementos",
        itens: [
          { id: "pi1", ordem: 1, nome: "Creatina monohidratada", dose: "5 g", horario: "Diário (qualquer horário)", observacoes: "Pode dissolver no shake ou na água. Tomar todos os dias, inclusive nos dias sem treino." },
          { id: "pi2", ordem: 2, nome: "Whey protein", dose: "30 g", horario: "Pós-treino", observacoes: "Bater com 250ml de água. Só nos dias de treino." },
          { id: "pi3", ordem: 3, nome: "Cafeína", dose: "200 mg", horario: "30 min antes do treino", observacoes: "Evitar após as 17h para não atrapalhar o sono." },
        ],
      },
      {
        id: "pb2",
        ordem: 2,
        nome: "Vitaminas",
        itens: [
          { id: "pi4", ordem: 1, nome: "Vitamina D3", dose: "2.000 UI", horario: "Café da manhã", observacoes: "Tomar junto de uma refeição com gordura para melhor absorção." },
          { id: "pi5", ordem: 2, nome: "Ômega 3", dose: "2 cápsulas", horario: "Almoço", observacoes: "" },
        ],
      },
    ],
  },
];

// ---------------- Check-ins ----------------
/** Helper: gera as 3 fotos de progresso (Frente/Lado/Costas) de um check-in. */
function fotosProgresso(seed: string): FotoCheckin[] {
  return [
    { id: seed + "-frente", angulo: "Frente", url: `https://picsum.photos/seed/${seed}-frente/360/480` },
    { id: seed + "-lado", angulo: "Lado", url: `https://picsum.photos/seed/${seed}-lado/360/480` },
    { id: seed + "-costas", angulo: "Costas", url: `https://picsum.photos/seed/${seed}-costas/360/480` },
  ];
}

const checkins: CheckIn[] = [
  // Aluno 1 — Ana Paula (histórico completo)
  { id: "c1-1", alunoId: "1", semana: 1, enviadoEm: "2026-05-10", peso: 62.0, fotos: fotosProgresso("ana-s1"), avaliacoes: { energia: 3, sono: 3, dieta: 4 }, treinosFeitos: 4, treinosTotais: 5, comentario: "Primeira semana, adaptando.", respostaCoach: "Bom começo! Vamos ajustar o volume.", status: "respondido" },
  { id: "c1-2", alunoId: "1", semana: 2, enviadoEm: "2026-05-17", peso: 61.6, fotos: [], avaliacoes: { energia: 3, sono: 4, dieta: 4 }, treinosFeitos: 5, treinosTotais: 5, comentario: "Semana ótima.", respostaCoach: "Mandou bem, segue assim.", status: "respondido" },
  { id: "c1-3", alunoId: "1", semana: 3, enviadoEm: "2026-05-24", peso: 61.3, fotos: fotosProgresso("ana-s3"), avaliacoes: { energia: 4, sono: 4, dieta: 3 }, treinosFeitos: 4, treinosTotais: 5, comentario: "Dieta escorregou no fim de semana.", respostaCoach: "Sem problema, foco na semana.", status: "respondido" },
  { id: "c1-4", alunoId: "1", semana: 4, enviadoEm: "2026-05-31", peso: 61.0, fotos: [], avaliacoes: { energia: 4, sono: 4, dieta: 4 }, treinosFeitos: 5, treinosTotais: 5, comentario: "Tudo certo.", respostaCoach: "Excelente evolução.", status: "respondido" },
  { id: "c1-5", alunoId: "1", semana: 5, enviadoEm: "2026-06-07", peso: 60.7, fotos: fotosProgresso("ana-s5"), avaliacoes: { energia: 4, sono: 3, dieta: 4 }, treinosFeitos: 4, treinosTotais: 5, comentario: "Dormindo um pouco menos.", respostaCoach: "Atenção ao sono. Mantém a dieta.", status: "respondido" },
  { id: "c1-6", alunoId: "1", semana: 6, enviadoEm: "2026-06-20", peso: 60.4, fotos: fotosProgresso("ana-s6"), avaliacoes: { energia: 5, sono: 4, dieta: 5 }, treinosFeitos: 5, treinosTotais: 5, comentario: "Melhor semana até agora! Me senti muito forte nos treinos de perna. A dieta fluiu bem.", status: "pendente" },

  // Aluno 2 — Bruno (check-in pendente na semana 3)
  { id: "c2-1", alunoId: "2", semana: 1, enviadoEm: "2026-06-01", peso: 87.0, fotos: fotosProgresso("bruno-s1"), avaliacoes: { energia: 3, sono: 3, dieta: 3 }, treinosFeitos: 3, treinosTotais: 4, comentario: "Começando, animado.", respostaCoach: "Vamos com calma e constância.", status: "respondido" },
  { id: "c2-2", alunoId: "2", semana: 2, enviadoEm: "2026-06-08", peso: 85.2, fotos: [], avaliacoes: { energia: 4, sono: 3, dieta: 4 }, treinosFeitos: 4, treinosTotais: 4, comentario: "Semana boa, sem furos.", respostaCoach: "Excelente, peso caindo bem.", status: "respondido" },
  { id: "c2-3", alunoId: "2", semana: 3, enviadoEm: "2026-06-19", peso: 83.1, fotos: fotosProgresso("bruno-s3"), avaliacoes: { energia: 3, sono: 2, dieta: 3 }, treinosFeitos: 3, treinosTotais: 4, comentario: "Sono ruim essa semana, treino pesado.", status: "pendente" },

  // Aluno 7 — Gabriela (check-in pendente na semana 2)
  { id: "c7-1", alunoId: "7", semana: 1, enviadoEm: "2026-06-13", peso: 58.0, fotos: fotosProgresso("gabi-s1"), avaliacoes: { energia: 4, sono: 4, dieta: 4 }, treinosFeitos: 4, treinosTotais: 4, comentario: "Primeira semana ótima!", respostaCoach: "Bem-vinda! Bora pra cima.", status: "respondido" },
  { id: "c7-2", alunoId: "7", semana: 2, enviadoEm: "2026-06-20", peso: 58.6, fotos: fotosProgresso("gabi-s2"), avaliacoes: { energia: 5, sono: 4, dieta: 5 }, treinosFeitos: 4, treinosTotais: 4, comentario: "Ganhando força, peso subindo um pouco.", status: "pendente" },
];

// ---------------- Transações ----------------
export const transacoes: Transacao[] = [
  { id: "tx1", alunoId: "1", planoId: "p1", descricao: "Ana Paula Souza · Consultoria Online Mensal", valor: 199, metodo: "Cartão", data: "2026-06-20", status: "aprovado", tipo: "entrada" },
  { id: "tx2", alunoId: "5", planoId: "p1", descricao: "Eduarda Nunes · Consultoria Online Mensal", valor: 199, metodo: "Pix", data: "2026-06-19", status: "aprovado", tipo: "entrada" },
  { id: "tx3", descricao: "Saque para conta Nubank", valor: -2000, metodo: "Pix", data: "2026-06-18", status: "aprovado", tipo: "saida" },
  { id: "tx4", alunoId: "6", planoId: "p2", descricao: "Felipe Costa · Acompanhamento Personal", valor: 450, metodo: "Cartão", data: "2026-06-17", status: "aprovado", tipo: "entrada" },
  { id: "tx5", alunoId: "7", planoId: "p1", descricao: "Gabriela Alves · Consultoria Online Mensal", valor: 199, metodo: "Boleto", data: "2026-06-16", status: "processando", tipo: "entrada" },
  { id: "tx6", descricao: "Taxa da plataforma (5%)", valor: -32.4, metodo: "—", data: "2026-06-16", status: "aprovado", tipo: "saida" },
  { id: "tx7", alunoId: "2", planoId: "p2", descricao: "Bruno Lima · Acompanhamento Personal", valor: 450, metodo: "Cartão", data: "2026-06-15", status: "falhou", tipo: "entrada" },
  { id: "tx8", alunoId: "4", planoId: "p1", descricao: "Diego Martins · Consultoria Online Mensal", valor: 199, metodo: "Pix", data: "2026-06-19", status: "aprovado", tipo: "entrada" },
];

export const proximosRecebimentos: ProximoRecebimento[] = [
  { id: "pr1", alunoNome: "Bruno Lima", planoNome: "Acompanhamento Personal", valor: 450, data: "2026-06-22", metodo: "Cartão" },
  { id: "pr2", alunoNome: "Gabriela Alves", planoNome: "Consultoria Online Mensal", valor: 199, data: "2026-06-24", metodo: "Cartão" },
  { id: "pr3", alunoNome: "Ana Paula Souza", planoNome: "Consultoria Online Mensal", valor: 199, data: "2026-06-28", metodo: "Cartão" },
  { id: "pr4", alunoNome: "Eduarda Nunes", planoNome: "Consultoria Online Mensal", valor: 199, data: "2026-07-02", metodo: "Pix" },
  { id: "pr5", alunoNome: "Felipe Costa", planoNome: "Acompanhamento Personal", valor: 450, data: "2026-07-05", metodo: "Cartão" },
];

// ---------------- Financeiro (resumo) ----------------
export const financeiro = {
  saldoDisponivel: coach.saldo,
  aLiberar: coach.aLiberar,
  recebidoMes: 11240,
  mrr: 8376,
  inadimplencia: { valor: 649, alunos: 2 },
  // Faturamento dos últimos 6 meses (barras)
  faturamento6m: [
    { mes: "Jan", valor: 7200 },
    { mes: "Fev", valor: 8100 },
    { mes: "Mar", valor: 8900 },
    { mes: "Abr", valor: 9400 },
    { mes: "Mai", valor: 10600 },
    { mes: "Jun", valor: 11240 },
  ],
};

// ---------------- Biblioteca ----------------
export const exercicioLibrary: ExercicioModelo[] = [
  { id: "lib-1", nome: "Supino reto com barra", grupo: "Peito", videoUrl: "https://youtube.com/lib/supino" },
  { id: "lib-2", nome: "Agachamento livre", grupo: "Pernas", videoUrl: "https://youtube.com/lib/agachamento" },
  { id: "lib-3", nome: "Levantamento terra", grupo: "Posterior", videoUrl: "https://youtube.com/lib/terra" },
  { id: "lib-4", nome: "Puxada frontal", grupo: "Costas", videoUrl: "https://youtube.com/lib/puxada" },
  { id: "lib-5", nome: "Rosca direta", grupo: "Bíceps", videoUrl: "https://youtube.com/lib/rosca" },
  { id: "lib-6", nome: "Tríceps na polia", grupo: "Tríceps", videoUrl: "https://youtube.com/lib/triceps" },
  { id: "lib-7", nome: "Desenvolvimento militar", grupo: "Ombros", videoUrl: "https://youtube.com/lib/desenvolvimento" },
  { id: "lib-8", nome: "Leg press 45°", grupo: "Pernas", videoUrl: "https://youtube.com/lib/legpress" },
];

export const suplementoLibrary: SuplementoModelo[] = [
  { id: "sup-1", nome: "Creatina monohidratada", categoria: "Suplementos", doseSugerida: "5 g/dia" },
  { id: "sup-2", nome: "Whey protein", categoria: "Suplementos", doseSugerida: "30 g" },
  { id: "sup-3", nome: "Cafeína", categoria: "Pré-treino", doseSugerida: "200 mg" },
  { id: "sup-4", nome: "Beta-alanina", categoria: "Pré-treino", doseSugerida: "3-5 g/dia" },
  { id: "sup-5", nome: "Vitamina D3", categoria: "Vitaminas", doseSugerida: "2.000 UI" },
  { id: "sup-6", nome: "Ômega 3", categoria: "Vitaminas", doseSugerida: "1-2 g" },
  { id: "sup-7", nome: "Multivitamínico", categoria: "Vitaminas", doseSugerida: "1 cápsula" },
  { id: "sup-8", nome: "Glutamina", categoria: "Suplementos", doseSugerida: "5 g" },
];

export const alimentoLibrary: AlimentoModelo[] = [
  { id: "taco-1", nome: "Peito de frango grelhado", porcao: "100g", macros: { kcal: 165, p: 31, c: 0, g: 3.6 } },
  { id: "taco-2", nome: "Arroz branco cozido", porcao: "100g", macros: { kcal: 130, p: 2.5, c: 28, g: 0.2 } },
  { id: "taco-3", nome: "Feijão preto cozido", porcao: "100g", macros: { kcal: 77, p: 4.5, c: 14, g: 0.5 } },
  { id: "taco-4", nome: "Ovo de galinha", porcao: "1 unid (50g)", macros: { kcal: 78, p: 6, c: 0.6, g: 5 } },
  { id: "taco-5", nome: "Batata doce cozida", porcao: "100g", macros: { kcal: 86, p: 1.6, c: 20, g: 0.1 } },
  { id: "taco-6", nome: "Aveia em flocos", porcao: "30g", macros: { kcal: 117, p: 4, c: 20, g: 2.4 } },
  { id: "taco-7", nome: "Banana prata", porcao: "1 unid", macros: { kcal: 105, p: 1.3, c: 27, g: 0.4 } },
  { id: "taco-8", nome: "Whey protein", porcao: "30g", macros: { kcal: 120, p: 24, c: 3, g: 1 } },
];

// ---------------- Anamnese padrão ----------------
export const anamneseTemplate: AnamneseTemplate = {
  perguntas: [
    { id: "q1", ordem: 1, texto: "Qual seu principal objetivo?", tipo: "escolha", obrigatoria: true, opcoes: ["Hipertrofia", "Emagrecimento", "Condicionamento", "Saúde"] },
    { id: "q2", ordem: 2, texto: "Peso atual (kg)", tipo: "numero", obrigatoria: true },
    { id: "q3", ordem: 3, texto: "Altura (cm)", tipo: "numero", obrigatoria: true },
    { id: "q4", ordem: 4, texto: "Possui alguma lesão ou restrição médica? Descreva.", tipo: "texto", obrigatoria: true },
    { id: "q5", ordem: 5, texto: "Quantos dias por semana pode treinar?", tipo: "escolha", obrigatoria: true, opcoes: ["2", "3", "4", "5", "6"] },
    { id: "q6", ordem: 6, texto: "Foto de frente (corpo inteiro)", tipo: "foto", obrigatoria: false },
  ],
};

// ============================================================
// Acessores
// ============================================================
export function listAlunos(): Aluno[] {
  return alunos;
}

export function getAluno(id: string): Aluno | undefined {
  return alunos.find((a) => a.id === id);
}

export function listPlanos(): Plano[] {
  return planos;
}

export function getPlano(id: string): Plano | undefined {
  return planos.find((p) => p.id === id);
}

export function planoNome(id: string): string {
  return getPlano(id)?.nome ?? "—";
}

export function getTreino(alunoId: string): Treino | undefined {
  return treinos.find((t) => t.alunoId === alunoId);
}

export function getDieta(alunoId: string): Dieta | undefined {
  return dietas.find((d) => d.alunoId === alunoId);
}

export function getProtocolo(alunoId: string): Protocolo | undefined {
  return protocolos.find((p) => p.alunoId === alunoId);
}

export function getCheckins(alunoId: string): CheckIn[] {
  return checkins
    .filter((c) => c.alunoId === alunoId)
    .sort((a, b) => a.semana - b.semana);
}

export function getCheckin(alunoId: string, semana: number): CheckIn | undefined {
  return checkins.find((c) => c.alunoId === alunoId && c.semana === semana);
}

export function ultimoCheckin(alunoId: string): CheckIn | undefined {
  const cs = getCheckins(alunoId);
  return cs[cs.length - 1];
}

export function listTransacoes(): Transacao[] {
  return transacoes;
}

// ---------------- Estatísticas derivadas (Resumo) ----------------
export const stats = {
  alunosAtivos: alunos.filter((a) => a.statusPagamento !== "novo").length + 1, // ativos incl. novos pagantes
  totalAlunos: alunos.length,
  novosNoMes: alunos.filter((a) => a.inicio >= "2026-06-01").length,
  faturamento30d: 12480,
  faturamento30dDelta: "+12%",
  saldo: coach.saldo,
  checkinsParaResponder: alunos.filter((a) => a.checkinPendente).length,
  pagamentosAtrasados: alunos.filter((a) => a.statusPagamento === "atrasado").length,
  novosSemPlano: alunos.filter((a) => a.aguardandoProtocolo).length,
};

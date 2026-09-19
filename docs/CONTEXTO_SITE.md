# Revo — Contexto do produto para reconstrução do site

> Documento de contexto (PT-BR) para quem for reconstruir o **site institucional / landing page** da Revo.
> Descreve o que o produto faz hoje, para quem, como funciona, o que é real vs. protótipo, marca, tokens de design e o copy já usado dentro do app.
> Fonte: código dos dois repositórios (`fitapp-main` = dashboard web + área do aluno; `coachfit-mobile` = app do aluno) em 2026-09-12.

---

## 1. Resumo em uma frase

**Revo é a plataforma para consultores fitness (personal trainers, nutricionistas, coaches online) gerenciarem alunos, montarem treino/dieta/protocolo, receberem check-ins semanais com fotos e cobrarem mensalidades — com o aluno usando um app mobile próprio.**

Modelo de negócio: **SaaS + marketplace.** O consultor assina um plano da Revo (Gratuito / Pro / Pro Max) e cobra seus alunos pela própria plataforma; a Revo retém uma taxa percentual sobre cada pagamento aluno→coach (split via Asaas).

---

## 2. Personas e superfícies

| Persona | Superfície | Onde roda | Para que serve |
|---|---|---|---|
| **Consultor** (dono da consultoria) | **Dashboard web** (`/`) | Navegador, desktop-first, responsivo | Gerir alunos, montar treino/dieta/protocolo, ver/responder check-ins, planos/mensalidade, financeiro (saldo, saque PIX), configurações, anamnese |
| **Aluno** (cliente final do consultor) | **App mobile Revo** (iOS/Android via Expo) + **PWA/área web** (`/aluno`) | Celular | Ver treino do dia com player guiado, dieta, protocolo, fazer check-in com fotos, responder anamnese, pagar mensalidade |
| **Aluno (pré-conta)** | **Onboarding público** (`/onboarding/[token]`) | Link enviado pelo coach | Dados → pagamento (PIX/cartão) → criar senha → instalar app |
| **Admin da plataforma** (Revo) | **Painel admin** (`/admin`) | Navegador | Ver todas as consultorias, alunos, assinaturas SaaS, MRR/GMV, conta master Asaas, configurar taxa/planos |

> Para o site, as personas que importam são **Consultor (comprador)** e **Aluno (usuário do app)**. O admin é interno.

---

## 3. O que o consultor faz no dashboard (feature por feature)

### 3.1 Resumo (home `/`)
- KPIs: **Alunos ativos**, **Novos no mês**, **Faturamento 30d**, **Saldo disponível** (lidos do banco).
- Gráfico de faturamento.
- Lista de alunos com busca, badges de pagamento (Em dia / Pendente / Atrasado) e tags de ação ("Check-in pra responder", "Aguardando protocolo").
- Conta nova mostra zero (sem dados fake).

### 3.2 Alunos (`/alunos`, `/alunos/[id]`)
- Diretório de alunos + convites pendentes.
- **Ficha do aluno**: dados, plano, status de pagamento, peso atual e aderência ao treino (derivados do último check-in), **gráfico de evolução de peso**, histórico de check-ins, atalhos para Treino / Dieta / Extras (protocolo).
- Cadastro de aluno (nome obrigatório, demais opcionais, altura etc.) + geração de convite.

### 3.3 Construtor de treino (`/alunos/[id]/treino`)
- **Multi-treino** por aluno (Treino A, B, C…).
- Biblioteca de exercícios + **criar exercício próprio**.
- Por exercício: séries/reps/descanso (detalhamento por série), vídeo (biblioteca/próprio), **observações do coach**.
- Ordenação drag-and-drop, salvar no banco (o aluno vê no app ao abrir).

### 3.4 Construtor de dieta (`/alunos/[id]/dieta`)
- Refeições com alimentos, quantidade editável, macros (kcal/P/C/G) somados automaticamente.
- Biblioteca de alimentos + **criar alimento** (macros opcionais).
- Observações por refeição e por alimento; substituições.

### 3.5 Protocolo / Extras (`/alunos/[id]/protocolo`)
- Blocos de suplementos, vitaminas e extras: dose, horário, observações.
- Biblioteca de suplementos.

### 3.6 Check-in (`/alunos/[id]/checkin/[semana]`)
- Recebe o check-in semanal do aluno: **peso, fotos por ângulo (Frente/Lado/Costas), energia/sono/dieta (1–5), treinos feitos/planejados, comentário**.
- **Comparação de fotos** entre semanas.
- Coach **responde** ao check-in (resposta chega no app do aluno).
- **Check-ins automáticos agendados**: o plano define frequência (semanal/quinzenal/mensal), dias da semana e horário; um agendador (pg_cron, fuso São Paulo) solicita o check-in automaticamente. Também dá para "Solicitar check-in" manualmente.
- Contadores "Check-in pra responder" no Resumo/diretório.

### 3.7 Planos / Mensalidade (`/planos`, `/planos/novo`, `/planos/[id]/editar`)
- O coach define a **mensalidade** que cobra dos alunos e gera **link de convite/compra** (`/onboarding/[token]`).
- Editor de plano completo: nome, descrição, capa, tipo de cobrança (**recorrente / pacote / avulso**), modalidade (**online / personal / consulta**), prazo de entrega, o que está incluso (treino, dieta, protocolos, check-in), preço, recorrência (semanal/mensal/trimestral/anual), formas de pagamento (cartão/PIX/boleto), parcelamento, solicitar documentos, agendar check-ins, upsell, visibilidade, checkout customizado (logo/cor).
- **Gate de plano**: para criar produto o coach precisa ter recebimento ativo e a anamnese "decidida".

### 3.8 Financeiro (`/financeiro`)
- **Saldo disponível**, **A liberar**, **Recebido no mês**, gráfico de faturamento, **próximos recebimentos**, **extrato**.
- **Ativar recebimento**: cria subconta Asaas do coach (KYC: dados pessoais, endereço, faturamento estimado) → o dinheiro dos alunos cai direto na wallet dele (split automático).
- **Sacar saldo via PIX** para a chave cadastrada (movimento real, com confirmação).
- Convidar aluno diretamente (nome opcional + mensalidade).

### 3.9 Configurações (`/configuracoes`)
- Perfil da consultoria (nome do negócio, logo, bio, especialidade), dados do profissional (nome, foto, conselho CREF/CRN/CRM), conta (e-mail, telefone).
- Recebimento (chave PIX, banco/agência/conta, CPF/CNPJ).
- Checkout (logo + cor de destaque).
- **Anamnese padrão**: construtor de questionário (texto, número, escolha, foto; obrigatória ou não). O aluno responde no primeiro acesso, antes de liberar o check-in.
- Notificações (novo pagamento, check-in recebido, pagamento atrasado, novo aluno).
- **Minha assinatura (Revo)**: ver plano, trocar cartão, cancelar/reativar.

### 3.10 Cadastro do consultor (`/cadastro`)
Wizard: **Conta** (nome/e-mail/CPF/celular, aceite de termos — vira lead de marketing) → **Plano** (Gratuito / Pro / Pro Max, "Comece grátis ou desbloqueie mais com um plano pago") → **Pagamento** (só pago; cartão via Asaas) → **Senha** → **Pronto** (confirmar e-mail). Login em `/login`, recuperação em `/recuperar-senha`.

---

## 4. O que o aluno faz no app mobile (Revo · app do aluno)

Bottom tabs: **Hoje · Treino · Dieta · Protocolo · Perfil**. Título da home: *"Vamos pro treino de hoje?"*

- **Hoje**: saudação, cartão de check-in (status: fazer / enviado / respondido), peso atual e aderência (derivados do último check-in), aviso "Responda sua anamnese" no 1º acesso, aviso "Atualizar forma de pagamento" quando necessário, atalhos "Treino de hoje", "Sua dieta", "Extras".
- **Treino**: lista de treinos publicados pelo coach → detalhe (exercícios, séries, minutos) → **sessão guiada** (player com timer de descanso, +15s, reiniciar, marcar série/exercício feito) e **registro de carga** pelo aluno.
- **Dieta**: meta kcal do dia (soma das refeições montadas pelo coach), refeições, alimentos, macros, substituições e observações.
- **Protocolo**: blocos de suplementos/vitaminas (dose, horário, observações) + marcar tomado.
- **Check-in** (modal): peso, fotos Frente/Lado/Costas (câmera/galeria, redimensionadas), energia/sono/dieta 1–5, treinos feitos/planejados, comentário → enviar. Histórico com as **respostas do coach**.
- **Anamnese**: responde o questionário do coach no primeiro acesso.
- **Perfil**: plano, consultor/consultoria, próximo vencimento, **pagamento** (trocar cartão ↔ PIX, cancelar assinatura self-service — acesso mantido até o fim do ciclo), notificações, conta e senha, ajuda e suporte, sair.
- Login/cadastro/recuperar senha. Sessão real (Supabase); dados sincronizam em tempo real com o que o coach publica (relê ao focar a tela).

**Distribuição**: Expo SDK 56 / React Native; alvo App Store + Google Play via EAS (bundle id `app.coachfit.aluno`). Também há **PWA instalável** ao fim do onboarding e a área web `/aluno`.

> ⚠️ Status das lojas: **ainda não publicado** nas lojas (contas Apple/Google e submissão pendentes). Não anunciar "disponível na App Store/Google Play" até publicar — usar "em breve" ou botões desabilitados.

---

## 5. Fluxo ponta a ponta (história pra contar no site)

1. Consultor cria conta grátis em minutos (`/cadastro`), define mensalidade e ativa o recebimento (KYC Asaas).
2. Gera um **link de convite** e manda pro aluno (WhatsApp).
3. Aluno abre o link → preenche dados (CPF é a identidade) → **paga por PIX (copia e cola) ou cartão** ("Cobrança recorrente · cancele quando quiser") → cria senha → instala o app.
4. Pagamento confirmado pelo **webhook do Asaas** (fonte de verdade; libera acesso no servidor) e **split automático**: coach recebe (100 − taxa)% na própria wallet; Revo fica com a taxa.
5. Aluno responde a anamnese; coach monta **treino, dieta e protocolo** no dashboard → aparece no app na hora.
6. Toda semana (dia/horário definidos no plano) o app pede o **check-in com fotos** → coach vê na ficha, compara fotos, acompanha o gráfico de peso e **responde**.
7. Coach acompanha **saldo, próximos recebimentos, inadimplência** e **saca via PIX** quando quiser. Aluno pode trocar forma de pagamento ou cancelar sozinho.

---

## 6. Pricing (planos SaaS do consultor — seed atual, editável no admin)

| Slug | Nome | Preço/mês | Limite de alunos | Recursos (lista no card) | Destaque |
|---|---|---|---|---|---|
| `free` | **Gratuito** — "Para começar a consultoria." | **R$ 0** | 5 | Até 5 alunos · Treino e dieta · Check-in semanal | — |
| `pro` | **Revo Pro** — "Para consultorias em crescimento." | **R$ 60** | 150 | Até 150 alunos · Protocolos extras · Link de pagamento · Suporte prioritário | ✅ (recomendado) |
| `avancado` | **Revo Pro Max** — "Operações grandes, sem limites." | **R$ 120** | ilimitado | Alunos ilimitados · Checkout personalizado · Suporte prioritário | — |

- **Taxa da plataforma** sobre pagamentos aluno→coach: padrão **10%** do líquido (configurável globalmente e por consultoria no admin). Calculada após a taxa do gateway.
- Regra de acesso: o coach **nunca perde a conta**; com plano lapsado só perde a escrita (criar aluno/produto) — leitura e saque continuam liberados. Cancelamento mantém acesso até o fim do ciclo pago.
- Admin pode configurar dias de trial e cobrança automática no fim do trial (campo existe; verificar valor antes de anunciar "X dias grátis").

> ⚠️ Confirme os preços no `/admin/planos` antes de publicar — o seed pode ter sido alterado.

---

## 7. O que é REAL hoje vs. protótipo/roadmap (para não prometer errado)

**Real (persistido no Supabase / integrado):**
- Auth de consultor e aluno; multi-tenant com RLS por consultoria; membership aluno↔consultoria (histórico preservado ao trocar de consultor).
- Alunos, treinos (multi), dieta, protocolo, check-ins (com fotos e resposta do coach), anamnese (template + respostas), planos/mensalidade, convites.
- Pagamentos via **Asaas**: cliente, cobrança PIX (QR/copia-e-cola) e cartão, assinatura recorrente, subconta do coach + KYC, split, webhook idempotente, estorno, saque PIX do coach, troca de cartão/forma, cancelamento self-service do aluno, assinatura SaaS do consultor.
- Check-ins agendados automaticamente (pg_cron).
- Painel admin com dados reais (KPIs, MRR, GMV, conta master, CRUD).
- Leads de marketing (e-mails do cadastro, com aceite LGPD).
- Termos de uso (`/termos`) e política de privacidade (`/privacidade`) publicados.

**Protótipo / parcial / não implementado (não anunciar como pronto):**
- **Chat coach↔aluno** — removido do produto (decisão de 2026-09-19); não anunciar.
- **Vitrine pública de planos / checkout público por slug** — planejado, não construído (o "link de pagamento" por convite funciona).
- **Vídeos dos exercícios** — modelo suporta URL, sem player/upload real.
- **Push notifications** — tela de notificações in-app existe; push nativo não.
- **Relatórios avançados / gerente de conta / cupons / integrações** — não existem; já retirados dos cards de plano e do editor (2026-09-19).
- Verificação de e-mail/WhatsApp no cadastro — placeholder.
- Publicação nas lojas — pendente.

---

## 8. Marca e identidade visual

- **Nome:** Revo (ex-CoachFit; zero menções a CoachFit no produto — só em IDs técnicos).
- **Logo:** ícone "R" quadrado (`public/icon.svg`) + wordmark (`public/revo-logo.svg`). Mobile: `assets/images/revo-icon.svg`.
- **Cores da marca:** verde profundo **`#04453d`** (revo-green — sidebar, theme-color, PWA) + ice **`#edfffa`**.
- **Design System "petrol + mint, superfícies ice"** (identidade editorial, cantos generosos, sombra fria, sem bordas nos cards):

| Token | Hex | Uso |
|---|---|---|
| petrol-deep | `#022128` | texto primário, headings, botões/âncora escura |
| petrol-700 | `#004860` | primária/ação, links |
| revo-green | `#04453d` | marca, sidebar |
| mint-400 | `#7cd3bb` | **accent** (CTAs, active, destaque) |
| mint-700 | `#2f8f74` | texto accent/sucesso sobre claro |
| mint-100 | `#e3f6f0` | fill suave da marca / info / sucesso |
| lilac | `#6a6dc0` | secundário |
| ice-50 | `#f4f8f7` | canvas/fundo |
| ice-100 | `#e0ecea` | painel interno |
| petrol-100 | `#d8e9ee` | chips, trilhos |
| texto secundário | `#3a4845` · terciário `#5d6c69` | |
| warning | `#8a5a12` / bg `#f7ecd6` | pendente |
| danger | `#bd463f` / bg `#f7e2e0` | atrasado/erro |
| bordas | `rgba(2,33,40,.12)` / `.20` | |

- **Raios:** 10 / 16 / 22 (cards) / 28 / 36 (heros) / pill.
- **Sombras:** `0 1px 2px rgba(2,33,40,.04), 0 12px 30px rgba(2,33,40,.06)`.
- **Tipografia (dashboard):** **Xenon Nue** (títulos/display, pesos 400–900, self-hosted em `public/fonts/XenonNue-*.woff2`, tracking −0.03em) + **Inter** (corpo, dados, rótulos; Google Fonts). Rótulos/eyebrows em uppercase pequeno (11px).
- **Tipografia (mobile):** títulos em Blandy Grotesque; corpo sistema.
- **Ícones:** Tabler Icons (webfont) no dashboard; Ionicons no mobile.
- **Tom de voz:** direto, informal-profissional, PT-BR, 2ª pessoa ("Vamos pro treino de hoje?", "Comece grátis", "cancele quando quiser"). Sem jargão corporativo.
- **Tema:** claro (tokens preparados para dark).

---

## 9. Copy já existente no produto (reaproveitável)

- Tagline do painel de auth: **"Revo · Dashboard do consultor"** / "Acesse o painel da sua consultoria."
- Três bullets do painel de marca (login/cadastro):
  1. **"Treinos, dietas e protocolos personalizados"**
  2. **"Check-ins semanais com fotos e evolução"**
  3. **"Planos, link de pagamento e financeiro"**
- Cadastro: "Comece grátis ou desbloqueie mais com um plano pago." · botão **"Começar grátis"**.
- Onboarding do aluno: "Cobrança recorrente · cancele quando quiser" · "PIX copia e cola" · "Agora crie uma senha para acessar o app." · "Tudo certo, {nome}!"
- App do aluno: "Vamos pro treino de hoje?" · "Fazer check-in" · "Check-in enviado!" · "Responda sua anamnese" · "Protocolo & suplementos".
- Termos (§2): *"A Revo é uma plataforma para consultores de fitness gerenciarem alunos, treinos, dietas, check-ins e cobranças."*
- Metadata atual: título "Revo — Dashboard do Consultor", descrição "Dashboard web do prestador de consultoria fitness."

---

## 10. Propostas de valor sugeridas (derivadas das features reais)

**Para o consultor**
- Tudo num só lugar: alunos, treino, dieta, protocolo, check-in e cobrança — sem planilha, sem PDF, sem WhatsApp perdido.
- Receba pelo app: PIX e cartão, cobrança recorrente automática, dinheiro cai na sua conta (subconta própria), **saque via PIX quando quiser**.
- Cobrança sem inadimplência silenciosa: status de cada aluno (em dia/pendente/atrasado) no Resumo.
- Check-in automático no dia e horário que você definir; fotos lado a lado semana a semana; gráfico de peso.
- Anamnese própria no primeiro acesso do aluno.
- Comece grátis com até 5 alunos.

**Para o aluno**
- App com o treino do dia, player guiado com timer e registro de carga.
- Dieta com macros e substituições; protocolo de suplementos com horários.
- Check-in semanal em 2 minutos, com fotos, e resposta do coach dentro do app.
- Pagamento por PIX ou cartão; troque a forma ou cancele quando quiser.

**Confiança / técnico (opcional, pé de página ou FAQ)**
- Pagamentos processados pelo **Asaas** (gateway brasileiro regulado); a Revo não armazena dados de cartão.
- Dados isolados por consultoria (multi-tenant com RLS); identidade do aluno por CPF, histórico preservado se trocar de consultor.
- LGPD: aceite de termos registrado; termos e privacidade públicos.

---

## 11. Estrutura sugerida do site (rotas e CTAs)

- **Hero**: headline para consultor + CTA primário **"Começar grátis"** → `/cadastro`; secundário **"Entrar"** → `/login`. Mockup do dashboard + app lado a lado.
- **Como funciona** (3–4 passos do §5).
- **Funcionalidades do consultor** (§3) e **do aluno / app** (§4) — dois blocos ou abas.
- **Pagamentos & financeiro** (split, PIX, saque, inadimplência).
- **Preços** (§6) com toggle/cards; CTA de cada card → `/cadastro`.
- **Para alunos**: "Recebeu um convite do seu coach? Abra o link que ele enviou" + badges das lojas (em breve) + link `/aluno`.
- **FAQ** (taxa, cancelamento, lojas, dados, CREF/CRN).
- **Rodapé**: `/termos`, `/privacidade`, e-mail de suporte (configurável no admin), Instagram.
- SEO/keywords: consultoria fitness online, app para personal trainer, plataforma para consultoria online, gestão de alunos, cobrança recorrente PIX personal, check-in com fotos, montar treino e dieta online.

---

## 12. Referências técnicas (caso o site viva no mesmo repo)

- Repositórios: dashboard `github.com/diogoassisramos-code/fitapp-main` (Next.js 16, React 19, TS, CSS Modules, sem Tailwind); mobile `github.com/diogoassisramos-code/coachfit-mobile` (Expo SDK 56).
- Rotas públicas atuais (sem login): `/login`, `/cadastro`, `/recuperar-senha`, `/onboarding/[token]`, `/termos`, `/privacidade`. Hoje a raiz `/` é o dashboard (gate redireciona para `/login`); um site em `/` exigiria mover o dashboard (ex.: `/app`) ou hospedar o site em domínio/subdomínio próprio (recomendado: `revo.app` site + `app.revo.app` dashboard).
- Tokens CSS em `src/app/globals.css`; assets em `public/` (`icon.svg`, `revo-logo.svg`, `fonts/XenonNue-*.woff2`, `manifest.webmanifest`).
- Captura de lead pronta: `POST /api/lead` (e-mail, nome, cpf, telefone, plano, origem, aceite) — pode ser usada por um formulário "Quero ser avisado" no site.

# CoachFit — Dashboard do Consultor

Dashboard web do prestador (consultoria fitness). Next.js App Router. App do aluno (mobile) é projeto separado, fora de escopo.

## Stack & convenções
- **Next.js 16 (App Router) + React 19 + TypeScript.** Sem Tailwind.
- **Estilo:** CSS Modules + variáveis CSS. Todos os tokens em `src/app/globals.css` (§1 do spec). **Nunca** use cores hardcoded — sempre `var(--color-*)`, `var(--space-*)`, `var(--border-radius-*)`.
- **Ícones:** Tabler webfont via CDN (`<i className="ti ti-NOME" />`). Componentes recebem o nome sem o prefixo `ti ti-`.
- **Fontes:** Inter (corpo, `--font-sans`), IBM Plex Mono (rótulos/eyebrows/URLs, uppercase, `--font-mono`). Carregadas via `<link>` no `layout.tsx`.
- **Path alias:** `@/*` → `src/*`.
- Server Components por padrão; `"use client"` só quando há estado/interação.

## Estrutura
- `src/app/` — rotas. Stub screens usam `<Placeholder/>`.
- `src/components/shell/` — `AppShell` (estado de colapso/mobile; **tela cheia em `/login`/`/cadastro`/`/recuperar-senha`**; **`/admin/*` usa o `AdminShell`**), `Sidebar` (com "Sair" → `/login` e link "Painel admin" → `/admin`), `Topbar`.
- `src/components/admin/` — **shell do painel da plataforma** (`AdminShell` + `AdminSidebar` escura + `AdminTopbar`). Telas admin em `/admin/*` renderizam só o conteúdo (o shell vem de fora). Persona super-admin, distinta do consultor.
- `src/components/auth/` — `AuthLayout` (painel de marca + slot de conteúdo) usado por login/cadastro.
- `src/components/ui/` — primitivos. **Reuse sempre** via `@/components/ui`:
  - `Button` (primary/outline/ghost/danger, `href` vira Link), `Card`/`CardHeader`/`CardBody`,
    `MetricCard`, `StatusBadge` (ok/late/pending/new/off), `Toggle` (40×23), `Segmented`,
    `Chip`, `Input`, `Textarea` (com contador), `ListRow`, `SectionBlock`, `Avatar`.
  - Gráficos: `LineChart`/`BarChart` (SVG sem dependências, usados no app do consultor) e `PointsChart` (recharts + `lucide-react`, usado nos gráficos do **admin** — linha suave, grid tracejado, tooltip e linhas de nível com estrela; estilizado com os tokens do projeto via `PointsChart.module.css`, sem Tailwind). Em Server Components, passar `formatValue` (função) ao `PointsChart` exige `"use client"` na página.
  - CSS compartilhado: `src/components/ui/ui.module.css`.
- `src/components/` — `PageHeader`, `Placeholder` (compartilhados entre telas).
- `src/lib/` — `nav.ts` (itens do menu + COACH de exemplo), `format.ts` (`brl()`), `testAlunos.ts` (store localStorage dos **alunos de teste** do modelo experimental — `addTestAluno`/`getTestAlunos`/`getTestAluno`/`conviteUrl`/`camposPendentes`, `LIMITE_ALUNOS_TESTE = 3`; só o nome é obrigatório; ler via `useEffect` para evitar mismatch de hidratação), `useAlunoResolvido.ts` (hook client que resolve um id como aluno seeded OU de teste — os builders treino/dieta/protocolo usam para funcionar com alunos de teste sem 404).
- `/styleguide` — vitrine de todos os primitivos (validação visual).

## Regras de UI do spec
- **ListRow = padrão de 2 linhas sempre** (título flex:1 + ação na linha 1; metadados em largura cheia na linha 2). Evita sobreposição no mobile.
- Badges de pagamento: Em dia=ok, Pendente=pending, Atrasado=late. Tags de ação: "Check-in pra responder"=new, "Aguardando protocolo"=pending.
- Métrica grande = 22px. Saldo positivo em verde (success).
- Desktop-first (grids 3–4 col); mobile (<880px) vira coluna única e a sidebar vira menu deslizante.

## Comandos
- `npm run dev` — dev server (porta 3000).
- `npm run build` — build de produção (valida tipos).

## Camada de dados
- `src/lib/types.ts` — todas as entidades do §4 (Prestador, Plano, Aluno, Treino, Dieta, CheckIn, Transacao, AnamneseTemplate, etc.). `CheckIn.fotos` é `FotoCheckin[]` (`{id,angulo,url}` — imagens enviadas pelo aluno); `Plano.checkinConfig` (`{frequencia,diasSemana[],horario}`) personaliza os dias de check-in; `Alimento` tem `custom?`/`semMacros?` para alimentos criados pelo coach com macros opcionais. `Exercicio`, `Alimento` e `Refeicao` têm `observacoes?` (orientações do coach). `Protocolo`/`ProtocoloBloco`/`ProtocoloItem` modelam a aba de protocolo (suplementos/extras); `getProtocolo(alunoId)` e `suplementoLibrary` em `data.ts`.
- `src/lib/data.ts` — dados mock + acessores: `coach`, `planos`, `alunos`, `transacoes`, `proximosRecebimentos`, `financeiro`, `exercicioLibrary`, `alimentoLibrary`, `anamneseTemplate`, `stats`; funções `getAluno/listAlunos/getPlano/planoNome/getTreino/getDieta/getCheckins/getCheckin/ultimoCheckin/listTransacoes`. Datas absolutas relativas a 2026-06-21.
- `src/lib/format.ts` — `brl`, `dataCurta/dataLonga`, `estaAtrasada`, e maps de rótulo/variante (`STATUS_PAGAMENTO`, `TIPO_COBRANCA_LABEL`, `MODALIDADE_LABEL`, `RECORRENCIA_LABEL`, `FORMA_PAGAMENTO_LABEL`, `inclusoResumo`).

## Estado da implementação
**Todas as telas do spec implementadas e com build/typecheck limpos.** Rotas: `/` (Resumo §3.1), `/alunos` (§3.2), `/alunos/[id]` (ficha §3.3, com histórico de check-ins), `/alunos/[id]/treino` (§3.4, observações por exercício), `/alunos/[id]/dieta` (§3.5, quantidade editável + criar alimento + observações por refeição/alimento), `/alunos/[id]/protocolo` (construtor de protocolo/extras, espelha a dieta), `/alunos/[id]/checkin/[semana]` (§3.8, fotos reais + comparação), `/planos` (§3.6), `/planos/novo` + `/planos/[id]/editar` (§3.7, editor compartilhado em `src/components/screens/plano-editor/`, com dias de check-in), `/financeiro` (§3.9), `/configuracoes` (§3.10), `/login` + `/cadastro` (auth do consultor — protótipo, sem backend; cadastro = wizard de 2 passos com nome/e-mail/celular/senha) + `/recuperar-senha` (envio de link, protótipo), `/alunos/novo` (cadastro de aluno do **modelo experimental**: infos básicas incl. altura, só o nome obrigatório, mostra pendências + convite, com **limite sistêmico de 3 alunos de teste** via `testAlunos.ts`; os criados aparecem em "Convites pendentes" no diretório e têm ficha-hub própria — `TestAlunoFicha` em `src/components/screens/test-aluno/` — de onde se monta treino/dieta/protocolo), `/styleguide`. Resumo tem gráfico de faturamento; a ficha do aluno tem gráfico de evolução do peso. A aba de protocolo é acessada pelo card "Extras" da ficha. O construtor de treino tem "Criar exercício" (modal que pede o nome) no canto direito da biblioteca e no rodapé.
**Painel admin da plataforma (persona super-admin):** rotas `/admin` (visão geral — KPIs + gráficos receita/volume + top consultorias), `/admin/consultores` (lista com nº de alunos ativos por consultor + CRUD via KebabMenu), `/admin/consultores/[id]` (detalhe: dados, assinatura, alunos do consultor com CRUD), `/admin/consultores/novo` + `/admin/consultores/[id]/editar` (form em `src/components/admin/screens/ConsultorForm`), `/admin/alunos` (todos os alunos da plataforma + CRUD), `/admin/planos` (planos SaaS que as consultorias assinam — pricing cards + criar), `/admin/assinaturas` (gestão das assinaturas), `/admin/financeiro` (MRR, faturamento, **volume processado/GMV**, gráficos, extrato), `/admin/configuracoes` (plataforma, cobrança, planos, admins, notificações). Dados em `src/lib/admin.ts` (`consultorias`, `planosPlataforma`, `assinaturas`, `alunosPlataforma`, `adminFinanceiro`, `adminStats` + acessores + `STATUS_CONSULTORIA`); nav em `src/lib/adminNav.ts`.

**Nota de primitivo:** `ListRow` com `onClick` renderiza um `<div role="button">` (não `<button>`) para permitir KebabMenu/Links aninhados sem HTML inválido.

Tudo é protótipo de UI: estados são efêmeros (sem backend); botões de salvar/enviar/CRUD são stubs visuais. Fora de escopo: app do aluno, vitrine pública, cupons, integrações.

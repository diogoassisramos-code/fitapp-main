# CoachFit

Protótipo de UI de uma plataforma de consultoria fitness. **Dois apps no mesmo projeto:**

- **Dashboard do consultor** (`/`) — gerenciar alunos, montar treino/dieta/protocolo, planos, financeiro, check-ins.
- **Painel admin da plataforma** (`/admin`) — super-admin que controla todas as consultorias, assinaturas e o financeiro da plataforma.

> É um protótipo: dados são mock, o estado é efêmero (sem backend) e os botões de salvar/enviar/CRUD são stubs visuais. Os "alunos de teste" persistem só no `localStorage` do navegador.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · CSS Modules + variáveis CSS (sem Tailwind) · ícones Tabler (CDN) · fontes Inter + IBM Plex Mono.

## Como rodar (em qualquer PC)
Requer **Node 18+** (testado no Node 22).

```bash
npm install      # instala as dependências (gera node_modules)
npm run dev      # sobe o dev server em http://localhost:3000
```

Outros comandos:
```bash
npm run build    # build de produção (valida tipos)
npx tsc --noEmit # só checagem de tipos
```

> Se rodar `npm run build` e depois `npm run dev` der erro de "React Client Manifest", apague a pasta `.next` e suba o dev de novo.

## Rotas principais
**Consultor:** `/` (resumo) · `/alunos` · `/alunos/[id]` (ficha) · `/alunos/[id]/treino` · `/dieta` · `/protocolo` · `/checkin/[semana]` · `/alunos/novo` (modelo experimental, limite de 3) · `/planos` · `/planos/novo` · `/financeiro` · `/configuracoes` · `/login` · `/cadastro` · `/recuperar-senha` · `/styleguide`.

**Admin (`/admin`):** visão geral · `/admin/consultores` (+ detalhe/novo/editar) · `/admin/alunos` · `/admin/planos` · `/admin/assinaturas` · `/admin/financeiro` · `/admin/configuracoes`.

Acesso ao admin: link **"Painel admin"** na sidebar do consultor, ou direto por `/admin`.

## Onde está o quê
- `src/app/` — rotas (App Router).
- `src/components/ui/` — biblioteca de primitivos (Button, Card, Modal, ListRow, charts, etc.).
- `src/components/shell/` — shell do consultor; `src/components/admin/` — shell escuro do admin; `src/components/auth/` — layout de login/cadastro.
- `src/lib/` — dados mock e helpers: `data.ts` (consultor), `admin.ts` (plataforma), `types.ts`, `format.ts`, `testAlunos.ts` (alunos de teste no localStorage).

**`CLAUDE.md`** tem a documentação detalhada da arquitetura, convenções e estado da implementação — leia-o ao retomar o trabalho.

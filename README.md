# Revo

Dashboard de uma plataforma de consultoria fitness. **Três personas no mesmo projeto:**

- **Dashboard do consultor** (`/`) — gerenciar alunos, montar treino/dieta/protocolo, planos, financeiro, check-ins.
- **Painel admin da plataforma** (`/admin`) — super-admin que controla todas as consultorias, assinaturas e o financeiro da plataforma.
- **Área do aluno** (`/aluno`, `/onboarding/[token]`) — envio de check-in e onboarding/compra (PWA).

> Grande parte da UI é protótipo (botões de CRUD como stubs, pagamento simulado, "alunos de teste" só no `localStorage`). **Porém já há backend real opcional via Supabase**: com `.env.local` configurado, cadastro, alunos, treino/dieta/protocolo e check-ins persistem de verdade. Sem `.env.local`, tudo cai nos dados mock.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · CSS Modules + variáveis CSS (sem Tailwind) · ícones Tabler (CDN) · fontes Hanken Grotesk + Space Grotesk · Supabase (opcional).

## Como rodar (em qualquer PC)
Requer **Node >=20.9** (exigência do Next 16; testado no Node 22).

```bash
npm install      # instala as dependências (gera node_modules)
npm run dev      # sobe o dev server em http://localhost:3000
```

Outros comandos:
```bash
npm run build      # build de produção (valida tipos)
npm run typecheck  # só checagem de tipos (tsc --noEmit)
```

### Modo Supabase (backend real, opcional)
1. `cp .env.local.example .env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. No SQL Editor do Supabase, rode as migrations de `supabase/` **nesta ordem**: `schema.sql` → `schema_dieta_protocolo.sql` → `schema_checkin.sql` → `schema_consultor_signup.sql` → `schema_membership.sql`. Opcionais: `save_treino.sql`/`save_dieta.sql`/`save_protocolo.sql` (saves atômicos), `add_admin.sql` (super-admin), `seed.sql` (dados de exemplo).
3. Reinicie o `npm run dev`.

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

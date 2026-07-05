# CoachFit — Banco de dados (Supabase)

Backend compartilhado pelos dois apps: o **dashboard** (Next.js, este repo) e o **app do aluno** (Expo, repo `coachfit-mobile`). Um único projeto Supabase serve os dois.

## Fatia vertical (o que já está modelado)

Tabelas: `consultorias` (tenant) · `profiles` (auth) · `alunos` · `treinos` · `exercicios`, com **RLS multi-tenant** (cada consultoria só vê seus alunos; cada aluno só vê o que é dele e já publicado). Demais entidades (planos, dieta, protocolo, check-in, financeiro, plataforma) vêm nas próximas fatias — ver fim do `schema.sql`.

## ⚠️ Ordem das migrations (importante)

Os scripts NÃO são versionados por uma ferramenta — rode-os **na ordem abaixo, uma vez cada**. Todos usam `drop policy … + create policy` com os **mesmos nomes**, então **re-rodar um arquivo antigo depois de um mais novo REGRIDE a segurança** (ex.: re-rodar `schema_checkin.sql` ou `schema.sql` depois do `schema_membership.sql` reverte policies endurecidas). Se precisar reaplicar, rode a cadeia inteira até o fim, ou migre para `supabase/migrations/` + `supabase db push` (recomendado antes de produção).

Ordem obrigatória:

1. `schema.sql` (base + RLS + consultorias)
2. `schema_dieta_protocolo.sql`
3. `schema_checkin.sql`
4. `schema_consultor_signup.sql`
5. `schema_pagamentos.sql` (ids do Asaas + tabelas `pagamentos`/`webhook_events`)
6. `schema_membership.sql` (**deve ser o ÚLTIMO** — reescreve a RLS para o modelo de vínculo)

Opcionais (podem rodar a qualquer momento depois da base): `save_treino.sql` / `save_dieta.sql` / `save_protocolo.sql` (saves atômicos usados pelo `db.ts`), `add_admin.sql` (super-admin; senha aleatória impressa na execução), `seed.sql` (dados de exemplo — rode antes do membership ou insira os vínculos manualmente).

### Integração Asaas (pagamentos)
Além das migrations, o modo Asaas exige env de SERVIDOR em `.env.local` (ver `.env.local.example`): `SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN`. Configure o webhook no painel/API do Asaas apontando para `https://SEU-DOMINIO/api/webhooks/asaas` com o mesmo `authToken` de `ASAAS_WEBHOOK_TOKEN` e `sendType = SEQUENTIALLY`. Em dev, exponha a porta 3000 por um túnel (ex.: ngrok) para o Asaas alcançar o webhook. Smoke-test da credencial: `GET /api/asaas/health`.

## Passo a passo de provisão

1. **Crie o projeto** em [supabase.com](https://supabase.com) → New project. Região: `South America (São Paulo)`. Guarde a senha do banco.
2. **Rode as migrations** na ordem acima: SQL Editor → New query → cole cada arquivo → Run.
3. **Rode o seed** (dados + logins de demo): SQL Editor → cole [`seed.sql`](./seed.sql) → Run.
4. **Desligue a confirmação de e-mail** (protótipo): Authentication → Providers → Email → **Confirm email = OFF**. (O seed já marca os usuários como confirmados, mas isso evita atrito em cadastros novos.)
5. **Pegue as chaves**: Project Settings → API:
   - **Project URL** → vai pros dois `.env`
   - **anon/publishable key** → vai pros dois `.env` (pública; segurança real é a RLS)
   - **service_role key** → ⚠️ secreta, **não** versionar nem colar no chat
6. **Configure os `.env`** (templates abaixo) e me avise — eu ligo a auth real + as leituras e a gente verifica no preview.

### Logins de demonstração (criados pelo seed)

| Perfil | Onde | E-mail | Senha |
|---|---|---|---|
| Consultor | Dashboard | `rafael@coachfit.com` | `coachfit123` |
| Aluno | App mobile | `ana@coachfit.com` | `coachfit123` |

## `.env`

**Dashboard** (`App Fitness/.env.local`, baseado em `.env.local.example`):

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
```

**Mobile** (`coachfit-mobile/.env`, baseado em `.env.example`):

```
EXPO_PUBLIC_SUPABASE_URL=https://SEU-REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
```

## Testar o isolamento (RLS) — opcional

No SQL Editor dá pra simular um usuário e conferir que ninguém vê dados de outro tenant:

```sql
begin;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true); -- consultor
set local role authenticated;
select count(*) from public.alunos;   -- só os da consultoria dele
rollback;
```

## Segurança — notas da revisão

O schema passou por revisão adversarial. Correções já aplicadas: signup endurecido (sem sequestro de aluno entre consultorias), aluno não enxerga treino em rascunho, vínculo único aluno↔conta, helpers sem colisão com `current_role`, e `saldo/a_liberar` da consultoria fora do alcance de escrita do consultor (só `service_role`/admin). Antes de produção: revisar policies de Storage (fotos de check-in) quando essa fatia entrar.

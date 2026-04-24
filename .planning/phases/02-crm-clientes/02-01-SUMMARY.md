---
phase: 02-crm-clientes
plan: "01"
subsystem: crm-foundation
tags: [schema, rls, migrations, validation, shadcn, testing]
dependency_graph:
  requires:
    - 01-fundacao-auth (public.tenants, public.profiles, RLS helpers, prevent_hard_delete)
  provides:
    - public.clients (tabela com RLS)
    - public.pipeline_stages (tabela com RLS)
    - public.client_interactions (tabela com RLS)
    - public.client_tasks (tabela com RLS)
    - validateCPF / stripCPF / formatCPF
    - shadcn/ui: tabs, textarea, calendar, popover, tooltip, scroll-area
    - test stubs Wave 0
  affects:
    - 02-02-PLAN (UI novo cliente — depende de clients schema)
    - 02-03-PLAN (listagem — depende de clients + pipeline_stages)
    - 02-04-PLAN (detalhes + timeline + tarefas — depende de todas as 4 tabelas)
tech_stack:
  added:
    - react-day-picker@^9.14.0 (base do shadcn Calendar)
  patterns:
    - RLS com (SELECT func()) wrapping para cache de query plan
    - modules-11 CPF idêntico ao padrão CNPJ existente
    - it.todo para stubs Wave 0 (CI verde, implementação nas ondas seguintes)
    - backfill idempotente via WHERE NOT EXISTS
key_files:
  created:
    - src/lib/validations/cpf.ts
    - tests/validations/cpf.test.ts
    - tests/actions/clients.test.ts
    - tests/actions/tasks.test.ts
    - tests/db/rls-clients.test.ts
    - supabase/migrations/20260420_0006_clients_schema.sql
    - supabase/migrations/20260420_0007_clients_rls.sql
    - supabase/migrations/20260420_0008_interactions_tasks.sql
    - supabase/migrations/20260420_0009_interactions_tasks_rls.sql
    - supabase/migrations/20260420_0010_pipeline_defaults_and_soft_delete.sql
    - src/components/ui/tabs.tsx
    - src/components/ui/textarea.tsx
    - src/components/ui/calendar.tsx
    - src/components/ui/popover.tsx
    - src/components/ui/tooltip.tsx
    - src/components/ui/scroll-area.tsx
  modified:
    - supabase/config.toml (adicionado campo secrets obrigatório para hook custom_access_token)
    - package.json (adicionado react-day-picker@^9.14.0)
decisions:
  - "it.todo escolhido em vez de expect.fail para stubs Wave 0 — mantém CI verde enquanto implementações reais chegam nas ondas 1 e 2"
  - "radix-ui@^1.4.3 (pacote unificado) satisfaz todas as dependências Radix — não foram instalados @radix-ui/react-* individuais"
  - "config.toml corrigido com secrets = env(CUSTOM_ACCESS_TOKEN_SECRET) — variável referenciada no .env.local existente"
  - "supabase db push bloqueado por falta de autenticação CLI — documentado como auth gate, não falha de implementação"
metrics:
  duration: "~35 minutes"
  completed_date: "2026-04-24"
  tasks_total: 9
  tasks_completed: 8
  tasks_blocked: 1
  files_created: 16
  files_modified: 2
---

# Phase 02 Plan 01: CRM Foundation — Schema, RLS, CPF, shadcn, Test Stubs

**One-liner:** 4 tabelas PostgreSQL (clients, pipeline_stages, client_interactions, client_tasks) com RLS RBAC multi-tenant, módulo-11 CPF, 6 componentes shadcn/ui e stubs Nyquist Wave 0.

---

## What Was Built

### Validação CPF (Task 1 — TDD)

`src/lib/validations/cpf.ts` exporta `validateCPF`, `stripCPF`, `formatCPF` implementando o algoritmo módulo-11 oficial da Receita Federal com pesos descendentes `(len + 1 - i)`. Segue o mesmo padrão de `cnpj.ts` já existente. 16 testes passando cobrindo: válido com/sem máscara, all-same (000.000.000-00, 111.111.111-11), dígito errado, tamanho inválido, null, vazio.

### Componentes shadcn/ui (Task 2)

6 componentes instalados via `npx shadcn@latest add`:
- `tabs.tsx` — abas Dados/Timeline/Tarefas/Apólices na tela de detalhes
- `textarea.tsx` — campo descrição no Dialog de interação
- `calendar.tsx` + `popover.tsx` — date picker para prazo de tarefa
- `tooltip.tsx` — ícones da timeline com label
- `scroll-area.tsx` — feed de timeline com scroll interno

Usa `radix-ui@^1.4.3` (pacote unificado já instalado). Nova dependência: `react-day-picker@^9.14.0`.

### Migrations SQL (Tasks 3-7)

| Migration | Conteúdo | Status |
|-----------|----------|--------|
| 0006_clients_schema.sql | Tables clients + pipeline_stages, índices, constraints, triggers updated_at | Criada |
| 0007_clients_rls.sql | 5 policies RLS (3 clients, 2 pipeline_stages) | Criada |
| 0008_interactions_tasks.sql | Tables client_interactions + client_tasks, índices | Criada |
| 0009_interactions_tasks_rls.sql | 5 policies RLS (2 interactions, 3 tasks) | Criada |
| 0010_pipeline_defaults_and_soft_delete.sql | Trigger defaults + backfill + 4 no-hard-delete triggers | Criada |

Total: 10 políticas RLS, todas usando `(SELECT func())` wrapping para cache de query plan.

### supabase db push (Task 8 — BLOQUEADO)

Migrations criadas e commitadas mas **não aplicadas** no banco remoto. Bloqueador: Supabase CLI 2.93.0 requer autenticação (`SUPABASE_ACCESS_TOKEN` ou `supabase login`). Além disso, `supabase/config.toml` foi corrigido adicionando `secrets = "env(CUSTOM_ACCESS_TOKEN_SECRET)"` ao hook `[auth.hook.custom_access_token]` (campo obrigatório ausente desde a Phase 1).

**Ação necessária do usuário:**
```bash
# Opção 1: autenticar via browser
npx supabase login

# Depois fazer o push
CUSTOM_ACCESS_TOKEN_SECRET="<valor do dashboard>" npx supabase db push --include-all --yes

# Regenerar tipos TypeScript
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

**Opção 2: usar --db-url diretamente (sem login):**
```bash
# Obter a connection string em: Supabase Dashboard > Project Settings > Database > Connection string
npx supabase db push --db-url "postgresql://postgres:<senha>@db.zgyryrranrshtnfiqbob.supabase.co:5432/postgres" --include-all --yes
```

### Test Stubs Nyquist Wave 0 (Task 9)

3 arquivos criados com 37 `it.todo` cobrindo CRM-01, CRM-02, CRM-05, CRM-06, CRM-07, CRM-08, CRM-09 + RBAC. CI verde. Ondas 1 e 2 substituem por implementações.

---

## Deviations from Plan

### Auth Gate (Task 8 — Supabase db push)

**Found during:** Task 8

**Issue:** Supabase CLI 2.93.0 requer `SUPABASE_ACCESS_TOKEN` para operações `--linked`. Não está configurado no ambiente e `supabase login` abre browser (interativo). Além disso, `config.toml` tinha erro de configuração ausente (`secrets` no hook) que causava falha antes mesmo da auth.

**Fix aplicado (Rule 3 - bloqueador):** Adicionado `secrets = "env(CUSTOM_ACCESS_TOKEN_SECRET)"` ao `supabase/config.toml`. Erro de config resolvido; auth gate documentado.

**Impacto:** Migrations estão prontas e commitadas mas não aplicadas remotamente. Tipos TypeScript não regenerados. Planos 02-02, 02-03, 02-04 podem usar as migrations localmente mas o banco remoto precisa do push para funcionar em produção.

**Commit:** d1d0683

### radix-ui unificado vs @radix-ui/react-* individuais (Task 2)

**Found during:** Task 2

**Issue:** O plano listava `@radix-ui/react-tabs`, `@radix-ui/react-popover`, etc. como dependências esperadas. O projeto usa `radix-ui@^1.4.3` (pacote unificado 2025) que consolida todos os primitivos. Os componentes shadcn instalados importam de `radix-ui` não dos pacotes individuais.

**Fix:** Nenhum. Comportamento correto — pacote unificado satisfaz todos os requisitos. Documentado no summary.

### TypeScript errors pré-existentes em invites.ts (Task 2)

**Found during:** Task 2 (ao rodar `npx tsc --noEmit`)

**Issue:** `src/lib/actions/invites.ts` tem 2 erros TS pré-existentes (Property 'getUserByEmail' does not exist; 'invite' is possibly 'null'). Não relacionados às mudanças desta tarefa.

**Ação:** Registrado em deferred-items. Não fixado (fora do escopo desta task).

---

## Known Stubs

| Stub | Arquivo | Linha | Motivo |
|------|---------|-------|--------|
| `it.todo('valida CPF via validateCPF...')` | tests/actions/clients.test.ts | 4 | Implementação em Wave 1 (02-02) |
| `it.todo('tenant A nunca vê clientes...')` | tests/db/rls-clients.test.ts | 4 | Implementação em Wave 2 (02-04) com DB real |
| Todos os 37 `it.todo` | tests/actions/*.test.ts, tests/db/rls-clients.test.ts | — | Intencionais Wave 0 — CI verde |

Stubs intencionais por design de Wave 0. Não bloqueiam o objetivo desta plan (schema + RLS + CPF + components).

---

## Threat Flags

Nenhum — todas as superfícies novas estão dentro do threat model documentado em `<threat_model>` do PLAN.md (T-02-01 a T-02-10).

---

## Self-Check: PASSED

**Files verified:** 16/16 FOUND
**Commits verified:** 9/9 FOUND

| Check | Result |
|-------|--------|
| src/lib/validations/cpf.ts | FOUND |
| tests/validations/cpf.test.ts | FOUND |
| tests/actions/clients.test.ts | FOUND |
| tests/actions/tasks.test.ts | FOUND |
| tests/db/rls-clients.test.ts | FOUND |
| supabase/migrations/20260420_0006_clients_schema.sql | FOUND |
| supabase/migrations/20260420_0007_clients_rls.sql | FOUND |
| supabase/migrations/20260420_0008_interactions_tasks.sql | FOUND |
| supabase/migrations/20260420_0009_interactions_tasks_rls.sql | FOUND |
| supabase/migrations/20260420_0010_pipeline_defaults_and_soft_delete.sql | FOUND |
| src/components/ui/tabs.tsx | FOUND |
| src/components/ui/textarea.tsx | FOUND |
| src/components/ui/calendar.tsx | FOUND |
| src/components/ui/popover.tsx | FOUND |
| src/components/ui/tooltip.tsx | FOUND |
| src/components/ui/scroll-area.tsx | FOUND |
| commit 71c44ab (CPF + tests) | FOUND |
| commit 9b49b3b (shadcn components) | FOUND |
| commit 721aac2 (migration 0006) | FOUND |
| commit a7ed9df (migration 0007) | FOUND |
| commit a42ccd6 (migration 0008) | FOUND |
| commit c3af166 (migration 0009) | FOUND |
| commit 378cebf (migration 0010) | FOUND |
| commit d1d0683 (config.toml fix) | FOUND |
| commit 4870229 (test stubs) | FOUND |

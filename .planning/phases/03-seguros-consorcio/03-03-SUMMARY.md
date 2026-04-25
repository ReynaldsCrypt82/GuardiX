---
phase: 03-seguros-consorcio
plan: 03
subsystem: consorcio-module
tags: [server-actions, ui, forms, tdd, consorcio, rls, multi-tenant, pipeline-pos-contemplacao]
dependency_graph:
  requires:
    - "03-01 (consortium_groups, consortium_quotas tables + RLS + Zod schemas)"
    - "03-02 (padrão de Server Actions, UI conventions, sidebar com link Consórcio)"
    - "02-crm-clientes (clients table, profiles)"
  provides:
    - "createGroupAction, updateGroupAction"
    - "createQuotaAction, updateQuotaContemplationAction, updateQuotaStageAction"
    - "consorcio/page.tsx — listagem de grupos com filtros"
    - "consorcio/grupos/novo/group-form.tsx — formulário de criação de grupo"
    - "consorcio/[id]/page.tsx — detalhes do grupo + lista de cotas"
    - "QuotaTable, QuotaForm, ContemplationDialog"
    - "24 testes unitários TDD passando"
  affects:
    - "03-04 (alertas de assembleia usam next_assembly_date dos grupos aqui criados)"
    - "04-corretores-comissoes (consortium_quotas.assigned_to base para comissões)"
tech_stack:
  added: []
  patterns:
    - "updateQuotaContemplationAction com discriminatedUnion Zod coerce manual antes de parse — lance_value convertido para Number antes de safeParse"
    - "ContemplationDialog: campo lance_value condicional via useState contemplationType — visível apenas quando tipo=lance"
    - "StageAdvanceButton: botão inline Client Component com NEXT_STAGE map para avançar aguardando_docs → em_analise → credito_liberado"
    - "next_assembly_date: exibir '—' ou 'Não agendada' quando null — nunca comparar NULL com date (T-03-15)"
    - "Server Actions usam as any cast no Supabase client — tabelas consortium não em generated types (pendente supabase gen types)"
    - "Corretor guard em createQuotaAction: assigned_to !== user.id → error.assigned_to (T-03-12)"
    - "updateQuotaStageAction: role=corretor faz SELECT assigned_to via DB antes de UPDATE (T-03-16)"
key_files:
  created:
    - src/lib/actions/consortium-groups.ts
    - src/lib/actions/consortium-quotas.ts
    - src/app/(app)/[slug]/consorcio/page.tsx
    - src/app/(app)/[slug]/consorcio/grupos/novo/page.tsx
    - src/app/(app)/[slug]/consorcio/grupos/novo/group-form.tsx
    - src/app/(app)/[slug]/consorcio/[id]/page.tsx
    - src/components/consorcio/quota-table.tsx
    - src/components/consorcio/quota-form.tsx
    - src/components/consorcio/contemplation-dialog.tsx
  modified:
    - tests/actions/consortium.test.ts
decisions:
  - "updateQuotaContemplationAction coerce lance_value para Number antes de discriminatedUnion.safeParse — FormData envia strings, discriminatedUnion Zod precisa do número convertido antes de validar o literal 'lance'"
  - "StageAdvanceButton implementado como sub-componente Client dentro de quota-table.tsx — mantém colocation e evita props drilling desnecessário"
  - "QuotaTable recebe QuotaRow[] com tipo explícito — evita union type inferido pelo Supabase client na página Server Component"
metrics:
  duration: "18 minutos"
  completed_date: "2026-04-25"
  tasks_completed: 2
  tasks_total: 2
  files_created: 9
  files_modified: 1
---

# Phase 03 Plan 03: Módulo Consórcio — Server Actions e UI Summary

**One-liner:** Módulo completo de Consórcio com 5 Server Actions (CRUD grupos, cotas, contemplação com discriminatedUnion sorteio/lance, pipeline pós-contemplação aguardando_docs→em_analise→credito_liberado), ContemplationDialog com campo lance_value condicional, e 24 testes TDD passando — entrega CON-01 a CON-04 e CON-06.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Server Actions consortium-groups e consortium-quotas (TDD) | `83bd527` | consortium-groups.ts, consortium-quotas.ts, consortium.test.ts |
| 2 | UI módulo Consórcio — listagem, formulário, detalhes, componentes | `158ebdf` | 8 novos arquivos UI |

## What Was Built

### Server Actions (Task 1 — TDD RED→GREEN)

**src/lib/actions/consortium-groups.ts:**
- `createGroupAction`: valida via `createGroupSchema` (administrator min 2, type enum, credit_value > 0, term_months >= 1), next_assembly_date normalizado (string vazia → null), tenant_id do JWT (T-03-14), role guard admin/corretor, `revalidatePath` para `/consorcio`
- `updateGroupAction`: role guard, atualiza apenas next_assembly_date e updated_at, `revalidatePath` duplo (lista + detalhe)

**src/lib/actions/consortium-quotas.ts:**
- `createQuotaAction`: group_id injetado da rota (não do FormData), guard de corretor (T-03-12 — `assigned_to !== user.id`), 23505 tratado (quota_number duplicado), status='ativo' por default, tenant_id do JWT
- `updateQuotaContemplationAction`: discriminatedUnion Zod valida tipo 'sorteio'/'lance' estritamente (T-03-13), lance_value coercido para Number antes do parse, status='contemplado' + post_contemplation_stage='aguardando_docs' por default após sucesso
- `updateQuotaStageAction`: enum guard (aguardando_docs/em_analise/credito_liberado), role=corretor faz SELECT para verificar assigned_to antes de UPDATE (T-03-16)

**Testes TDD (24 testes passando):**
- createGroupAction: 8 testes (administrator, type, credit_value, term_months, next_assembly_date opcional, tenant_id do JWT, sessão expirada)
- createQuotaAction: 5 testes (group_id UUID, client_id UUID, corretor guard, tenant_id + status, 23505)
- updateQuotaContemplationAction: 6 testes (tipo inválido, lance=0, lance ausente, sorteio sem lance, lance válido, atualização de campos)
- updateQuotaStageAction: 5 testes (stage inválido, 3 transições válidas, corretor guard)

### UI (Task 2)

**consorcio/page.tsx** (listagem de grupos):
- Server Component com filtros via URL searchParams (type enum whitelist, administrator ilike max 100 chars, status de cota)
- Tabela: administradora, tipo (badge), crédito (BRL), prazo (N meses), cotas (X ativas/Y total), próxima assembleia (data ou "—")
- Estado vazio com CTA "Criar grupo"
- Link "Novo grupo" → /consorcio/grupos/novo

**GroupForm** (`consorcio/grupos/novo/group-form.tsx`):
- `'use client'` com useState para tipo e submitting
- Campos: administrator, type (Select), credit_value, term_months, start_date, total_quotas, next_assembly_date (opcional)
- Submit via `createGroupAction(slug, formData)`, redirect para `/[slug]/consorcio/${id}` após sucesso
- Erros inline por campo

**consorcio/[id]/page.tsx** (detalhes do grupo):
- Server Component busca grupo + cotas em paralelo com `Promise.all` (clientes e profiles para o form)
- Card principal: tipo, crédito, prazo, total cotas, start_date, next_assembly_date ("Não agendada" se null — T-03-15)
- Resumo de cotas em badges por status
- `QuotaTable` + `QuotaForm` (dialog)
- Filtro de status por URL searchParams

**QuotaTable** (`src/components/consorcio/quota-table.tsx`):
- `StatusBadge`: ativo=azul, contemplado=verde, cancelado=gray
- `StageBadge`: aguardando_docs=amarelo, em_analise=laranja, credito_liberado=verde (apenas quando contemplado)
- `StageAdvanceButton`: botão inline para avançar stage via `updateQuotaStageAction`, mapeado por `NEXT_STAGE`
- Botão "Contemplar" visível apenas para status='ativo' → abre ContemplationDialog

**ContemplationDialog** (`src/components/consorcio/contemplation-dialog.tsx`):
- Campo `lance_value` condicional — exibido apenas quando `contemplationType === 'lance'`
- Hidden input `quota_id` com valor quotaId (crítico para updateQuotaContemplationAction)
- Selects controlados para contemplation_type e post_contemplation_stage via useState
- Toast após sucesso, fecha dialog e reseta form

**QuotaForm** (`src/components/consorcio/quota-form.tsx`):
- Dialog shadcn com selects de cliente e corretor
- Toast "Cota adicionada" após sucesso

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] discriminatedUnion Zod não coerce lance_value de string para number**
- **Found during:** Task 1 — testes de lance_value
- **Issue:** FormData sempre envia strings. O discriminatedUnion Zod processa o campo `lance_value` como string antes de determinar o branch pelo `contemplation_type`. O `z.coerce.number()` não é acionado para o branch 'lance' quando o valor chega como `"15000"` sem pré-conversão.
- **Fix:** `updateQuotaContemplationAction` converte `raw.lance_value` para `Number(raw.lance_value)` antes de `safeParse` quando o campo está presente e não vazio
- **Files modified:** `src/lib/actions/consortium-quotas.ts`
- **Commit:** `83bd527`

**2. [Rule 1 - Bug] Mock TypeScript type mismatch em updateQuotaStageAction test**
- **Found during:** Task 2 — typecheck pós-implementação
- **Issue:** `mockQuotaChain.select.mockReturnValue({ eq: eqSelectFn })` retornava tipo incompatível com `mockQuotaSelectChain` que tem `{ eq, maybeSingle }` — TypeScript error TS2345
- **Fix:** Cast `as any` no mockReturnValue do eq para o teste de corretor guard
- **Files modified:** `tests/actions/consortium.test.ts`
- **Commit:** `158ebdf`

### Pre-existing Issues (Out of Scope)

- `src/lib/actions/invites.ts`: 2 erros TypeScript pré-existentes (`getUserByEmail` não existe, `invite` possibly null) — já documentados nos Plans 03-01 e 03-02, não causados por este plano.
- `tests/auth/rls-isolation.test.ts`: 1 falha intencional (`expect.fail(...)`) — stub Wave 0 a ser implementado em fases posteriores.

## Known Stubs

Nenhum — todos os componentes e Server Actions estão funcionais. As queries dependem de dados reais via Supabase com RLS. As páginas de listagem exibem estado vazio quando não há grupos/cotas.

## Threat Flags

Nenhum — todas as superfícies de segurança introduzidas estão documentadas no `<threat_model>` do plano e mitigadas:
- T-03-12 (corretor assigned_to guard): implementado em createQuotaAction linhas 30-32
- T-03-13 (contemplation_type injection): discriminatedUnion Zod valida estritamente 'sorteio'/'lance'
- T-03-14 (tenant_id spoofing): tenant_id do JWT em todos os Server Actions
- T-03-15 (next_assembly_date NULL): exibir '—' ou 'Não agendada' — sem comparação com data
- T-03-16 (quota cross-tenant via quota_id): corretor faz SELECT assigned_to antes de UPDATE

## Self-Check

**Arquivos criados verificados:**
- `src/lib/actions/consortium-groups.ts` — FOUND
- `src/lib/actions/consortium-quotas.ts` — FOUND
- `src/app/(app)/[slug]/consorcio/page.tsx` — FOUND
- `src/app/(app)/[slug]/consorcio/grupos/novo/page.tsx` — FOUND
- `src/app/(app)/[slug]/consorcio/grupos/novo/group-form.tsx` — FOUND
- `src/app/(app)/[slug]/consorcio/[id]/page.tsx` — FOUND
- `src/components/consorcio/quota-table.tsx` — FOUND
- `src/components/consorcio/quota-form.tsx` — FOUND
- `src/components/consorcio/contemplation-dialog.tsx` — FOUND

**Commits verificados:**
- `83bd527` — Task 1: Server Actions + 24 testes TDD
- `158ebdf` — Task 2: UI módulo Consórcio

**Testes:** 24/24 passando em `tests/actions/consortium.test.ts`

**TypeScript:** Limpo (apenas invites.ts pré-existentes fora de escopo)

**Verificações do plano:**
- `head -1 src/lib/actions/consortium-groups.ts` → `'use server'` — OK
- `head -1 src/lib/actions/consortium-quotas.ts` → `'use server'` — OK
- `grep "app_metadata.*tenant_id"` nos 2 arquivos — OK
- `grep "contemplado|post_contemplation_stage.*aguardando"` — OK
- Todas as rotas e componentes existem — OK

## Self-Check: PASSED

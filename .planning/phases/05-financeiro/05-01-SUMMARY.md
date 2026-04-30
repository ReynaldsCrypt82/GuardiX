---
phase: 05-financeiro
plan: "01"
subsystem: financeiro-foundation
tags: [migrations, rls, zod, financial-entries]
requires: [01-foundation-auth, 02-crm-clientes, 03-seguros-consorcio, 04-corretores]
provides: [financial_entries-table, financial-rls, financial-zod-schemas]
affects: [05-02-PLAN.md, 05-03-PLAN.md]
tech-stack:
  added: []
  patterns: [soft-delete-trigger, rls-3-path-rbac, zod-canonical-schemas]
key-files:
  created:
    - supabase/migrations/20260420_0019_financeiro_schema.sql
    - supabase/migrations/20260420_0020_financeiro_rls.sql
    - src/lib/validations/financial-schemas.ts
    - tests/db/rls-financeiro.test.ts
    - tests/validations/financial-schemas.test.ts
  modified: []
key-decisions:
  - "supabase db push --linked --include-all falha com versioning collision (mesma date key 20260420 dos planos anteriores) — workaround: supabase db query --linked -f para cada migration"
  - "financial_entries tem RLS UPDATE (diferente de commission_entries append-only) — necessário para markFinancialEntryPaidAction (Pitfall 1)"
  - "Corretor vê apenas lançamentos via subquery clients.assigned_to = auth.uid() — lançamentos avulsos (sem client_id) invisíveis ao corretor (T-5-04)"
requirements-completed: [FIN-01, FIN-02]
duration: "12 min"
completed: "2026-04-30"
---

# Phase 05 Plan 01: Fundação de Dados Financeiro Summary

Fundação de dados completa para o módulo Financeiro: tabela `financial_entries` com lifecycle de status mutável (pending/paid/cancelled), RLS com 3 caminhos de acesso (admin/financeiro/corretor via subquery), soft delete via trigger, e schemas Zod canônicos tipados.

**Duração:** 12 min | **Tasks:** 4/4 | **Arquivos:** 5 criados

## Tasks Completadas

| Task | Descrição | Commit | Status |
|------|-----------|--------|--------|
| 1 | Migration schema `financial_entries` + 5 indexes + 2 triggers | 137f8a1 | ✓ |
| 2 | Migration RLS 3 policies (SELECT/INSERT/UPDATE) | 20e4d4b | ✓ |
| 3 | Zod schemas (3) + tipos inferidos (3) + test stubs (2 files) | 2d827d7 | ✓ |
| 4 | Apply migrations via `supabase db query --linked -f` (workaround) | — | ✓ |

## O que foi construído

- **Tabela `public.financial_entries`**: 16 colunas, 5 índices, 2 triggers — aplicada ao banco linked
- **RLS SELECT**: admin/financeiro veem tudo do tenant; corretor vê apenas lançamentos com `client_id IN (clients WHERE assigned_to = auth.uid())`
- **RLS INSERT/UPDATE**: exclusivo para admin e financeiro; sem RLS DELETE (soft delete via trigger)
- **Schemas Zod**: `createFinancialEntrySchema`, `markFinancialEntryPaidSchema`, `softDeleteFinancialEntrySchema` com tipos TypeScript inferidos
- **Test stubs**: 4 testes implementados passando, 27 `it.todo` para implementação futura

## Deviações do Plano

**[Workaround documentado] supabase db push com versioning collision**
- Encontrado em: Task 4
- Causa: todas as migrations compartilham o prefixo `20260420`, chave já existente em `supabase_migrations`
- Fix: `supabase db query --linked -f migration.sql` para cada arquivo (idêntico à Phase 03)
- Commit: N/A (operação de DB, não código)

**Total deviações:** 1 workaround documentado. **Impacto:** Nenhum — migrations aplicadas com sucesso.

## Notas para Plan 02

Plan 02 (Server Actions + UI) deve importar de `@/lib/validations/financial-schemas`:

```typescript
import {
  createFinancialEntrySchema,
  markFinancialEntryPaidSchema,
  softDeleteFinancialEntrySchema,
  type CreateFinancialEntryInput,
  type MarkFinancialEntryPaidInput,
  type SoftDeleteFinancialEntryInput,
} from '@/lib/validations/financial-schemas'
```

Contrato da tabela (não há tipos gerados — usar `as any` no supabase client):
```typescript
// public.financial_entries (
//   id UUID, tenant_id UUID, entry_type 'receivable'|'payable',
//   description TEXT, amount NUMERIC(12,2) > 0, due_date DATE,
//   status 'pending'|'paid'|'cancelled', paid_at TIMESTAMPTZ?,
//   policy_id UUID?, quota_id UUID?, client_id UUID?,
//   notes TEXT?, created_by UUID?, deleted_at TIMESTAMPTZ?,
//   created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
// )
```

## Issues Encontrados

Nenhum bloqueador. Workaround de `supabase db push` já conhecido e documentado desde Phase 03.

## Self-Check: PASSED

- [x] `supabase/migrations/20260420_0019_financeiro_schema.sql` existe com `CREATE TABLE public.financial_entries`
- [x] `supabase/migrations/20260420_0020_financeiro_rls.sql` existe com 3 CREATE POLICY
- [x] `src/lib/validations/financial-schemas.ts` exporta 3 schemas + 3 tipos
- [x] `npx vitest run tests/validations/financial-schemas.test.ts tests/db/rls-financeiro.test.ts` passa
- [x] Banco: 16 colunas, 3 policies, 2 triggers confirmados via `supabase db query --linked`

---
phase: 03-seguros-consorcio
plan: 01
subsystem: database-schema
tags: [migrations, rls, zod, tdd, vigencia, seguros, consorcio]
dependency_graph:
  requires:
    - "01-fundacao-auth (public.tenants, public.profiles, jwt_tenant_id, jwt_tenant_role, set_updated_at, prevent_hard_delete)"
    - "02-crm-clientes (public.clients)"
  provides:
    - "public.policies (DDL + RLS + índices)"
    - "public.claims (DDL + RLS + índices)"
    - "public.endorsements (DDL + RLS + índices)"
    - "public.consortium_groups (DDL + RLS + índices)"
    - "public.consortium_quotas (DDL + RLS + post_contemplation_stage enum)"
    - "getVigenciaStatus(vigencia_fim) — função pura testada"
    - "createPolicySchema (discriminatedUnion por tipo)"
    - "createClaimSchema, createEndorsementSchema"
    - "createGroupSchema, createQuotaSchema, updateQuotaContemplationSchema"
    - "Wave 0 test stubs para Plans 03-02 e 03-03"
  affects:
    - "Plans 03-02 e 03-03 dependem de todas as tabelas aqui criadas"
tech_stack:
  added: []
  patterns:
    - "discriminatedUnion Zod por tipo de seguro (auto/vida/residencial/empresarial/saude/outros)"
    - "getVigenciaStatus runtime calculation — nunca armazenar status, sempre calcular de vigencia_fim"
    - "(SELECT public.jwt_tenant_id()) wrapping em todas as RLS policies para caching de query plan"
    - "post_contemplation_stage TEXT CHECK enum — stage filtrável + post_contemplation_notes texto livre"
    - "supabase db query --linked -f <file> como fallback quando db push falha por versioning"
key_files:
  created:
    - supabase/migrations/20260420_0011_seguros_schema.sql
    - supabase/migrations/20260420_0012_seguros_rls.sql
    - supabase/migrations/20260420_0013_consorcio_schema.sql
    - supabase/migrations/20260420_0014_consorcio_rls.sql
    - src/lib/utils/vigencia.ts
    - src/lib/validations/policy-schemas.ts
    - src/lib/validations/claim-schemas.ts
    - src/lib/validations/endorsement-schemas.ts
    - src/lib/validations/consortium-schemas.ts
    - tests/utils/vigencia.test.ts
    - tests/actions/policies.test.ts
    - tests/actions/claims.test.ts
    - tests/actions/endorsements.test.ts
    - tests/actions/consortium.test.ts
    - tests/db/rls-seguros.test.ts
  modified: []
decisions:
  - "updatePolicySchema usa z.object com campos opcionais em vez de discriminatedUnion.partial() — discriminatedUnion no Zod não suporta .partial() diretamente (Rule 1 auto-fix)"
  - "supabase db push falhou por versioning collision (todos os arquivos compartilham prefixo 20260420_ — CLI usa só a parte da data como version key). Alternativa: supabase db query --linked -f file.sql para cada migration"
  - "post_contemplation_stage TEXT CHECK IN ('aguardando_docs','em_analise','credito_liberado') adicionado — CON-04 exige stages filtráveis, não só notas de texto (resolvido em RESEARCH.md open questions)"
metrics:
  duration: "6 minutos"
  completed_date: "2026-04-25"
  tasks_completed: 3
  tasks_total: 3
  files_created: 15
  files_modified: 0
---

# Phase 03 Plan 01: Schema Seguros + Consórcio Summary

**One-liner:** Schema completo de 5 tabelas (policies, claims, endorsements, consortium_groups, consortium_quotas) com RLS RBAC multi-role, função `getVigenciaStatus` testada por TDD (8/8 boundary cases), e schemas Zod `discriminatedUnion` por tipo de seguro — fundação que desbloqueia Plans 03-02 e 03-03.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrations SQL (4 arquivos) | `2e13f2f` | 4 migrations SQL em supabase/migrations/ |
| 2 | Vigência util + Zod schemas + stubs Wave 0 | `e967cfa` | vigencia.ts, 4 schemas Zod, 6 arquivos de teste |
| 3 | supabase db push | (DB only — sem commit de código) | 5 tabelas ativas no banco remoto |

## What Was Built

### Banco de Dados (Migrations)

**0011_seguros_schema.sql:** Tabelas `policies`, `claims`, `endorsements` com índices otimizados (incluindo `idx_policies_vigencia_fim` para queries de alerta) e triggers `set_updated_at` + `prevent_hard_delete` (LGPD compliance D-12).

**0012_seguros_rls.sql:** RLS habilitado nas 3 tabelas de seguros. `policies_select` usa lógica RBAC: admin/financeiro/visualizador veem tudo; corretor vê apenas `assigned_to = auth.uid()`. Claims e endorsements usam `EXISTS (SELECT 1 FROM policies p ...)` para verificar propriedade via apólice.

**0013_consorcio_schema.sql:** Tabelas `consortium_groups` e `consortium_quotas` com campo `post_contemplation_stage TEXT CHECK IN ('aguardando_docs','em_analise','credito_liberado')` adicional ao `post_contemplation_notes TEXT` do D-04 (adição aditiva para suportar CON-04 com stages filtráveis).

**0014_consorcio_rls.sql:** RLS para consórcio seguindo o mesmo padrão. `consortium_quotas_select` replica o padrão de `policies_select` com `assigned_to = auth.uid()` para corretor.

### Utilitário de Vigência

`src/lib/utils/vigencia.ts` — função pura `getVigenciaStatus(vigencia_fim: string): VigenciaStatus` usando `differenceInDays` do date-fns. Lógica: `>60d → 'verde'`, `>30d → 'amarelo'`, `≤30d → 'vermelho'` (inclui vencidas). 8 testes unitários cobrindo todos os boundary cases (D-03).

### Schemas Zod de Validação

- `policy-schemas.ts`: `createPolicySchema` com `z.discriminatedUnion('type', [...])` cobrindo 6 tipos de seguro. Cada tipo tem seus campos específicos validados (placa/chassi para auto, CNPJ para empresarial, etc.). `updatePolicySchema` usa `z.object` com campos opcionais (discriminatedUnion não suporta `.partial()`).
- `claim-schemas.ts`: `createClaimSchema` com enum de status `aberto/em_analise/encerrado`.
- `endorsement-schemas.ts`: `createEndorsementSchema` com enum de tipo `inclusao/exclusao/alteracao`.
- `consortium-schemas.ts`: `createGroupSchema`, `createQuotaSchema`, e `updateQuotaContemplationSchema` (discriminatedUnion por `contemplation_type`: sorteio sem lance_value, lance com lance_value obrigatório).

### Testes Wave 0

- `tests/utils/vigencia.test.ts`: 8 testes reais passando (TDD GREEN)
- `tests/actions/{policies,claims,endorsements,consortium}.test.ts`: stubs `it.todo` para implementação nos Plans 03-02 e 03-03
- `tests/db/rls-seguros.test.ts`: stubs `it.todo` seguindo padrão de `rls-clients.test.ts`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] updatePolicySchema não suporta .partial() em discriminatedUnion**
- **Found during:** Task 2 (TypeScript typecheck)
- **Issue:** `createPolicySchema.partial()` falha com TS error — `ZodDiscriminatedUnion` não expõe `.partial()`
- **Fix:** `updatePolicySchema` reimplementado como `z.object` independente com campos opcionais + `id: z.string().uuid()` obrigatório
- **Files modified:** `src/lib/validations/policy-schemas.ts`
- **Commit:** `e967cfa`

**2. [Rule 3 - Blocking] supabase db push falhou por versioning collision**
- **Found during:** Task 3
- **Issue:** Supabase CLI 2.93.0 usa apenas a parte da data (`20260420`) como version key na tabela `supabase_migrations.schema_migrations`. Todos os migration files do projeto compartilham o prefixo `20260420_` — apenas o primeiro pode ser registrado, causando `duplicate key value violates unique constraint "schema_migrations_pkey"`.
- **Fix:** Aplicação direta via `npx supabase db query --linked -f <migration_file>` para cada um dos 4 arquivos em ordem. Contorna o versionamento do CLI sem alterar os nomes dos arquivos (que já foram commitados seguindo a convenção estabelecida).
- **Files modified:** Nenhum (operação de banco apenas)
- **Commit:** N/A (operação de runtime)

### Pre-existing Issues (Out of Scope)

- `src/lib/actions/invites.ts`: 2 erros TypeScript pré-existentes (`getUserByEmail` não existe, `invite` possivelmente null) — não causados por este plano, registrados em deferred-items.

## Known Stubs

Nenhum — todos os arquivos de schema e validação estão completos. Os `it.todo` nos arquivos de teste são intencionais (Wave 0 pattern) e serão implementados nos Plans 03-02 e 03-03.

## Threat Flags

Nenhum — todas as superfícies de segurança introduzidas estão documentadas no `<threat_model>` do plano (T-03-01 a T-03-06) e mitigadas pelas RLS policies e triggers criados.

## Self-Check

**Arquivos criados verificados:**
- `supabase/migrations/20260420_001{1,2,3,4}*.sql` — FOUND (4 arquivos)
- `src/lib/utils/vigencia.ts` — FOUND
- `src/lib/validations/{policy,claim,endorsement,consortium}-schemas.ts` — FOUND (4 arquivos)
- `tests/utils/vigencia.test.ts` — FOUND
- `tests/actions/{policies,claims,endorsements,consortium}.test.ts` — FOUND (4 arquivos)
- `tests/db/rls-seguros.test.ts` — FOUND

**Commits verificados:**
- `2e13f2f` — FOUND (feat(03-01): migrations SQL)
- `e967cfa` — FOUND (feat(03-01): vigencia util + Zod schemas + stubs)

**Testes:** 8/8 passando em `tests/utils/vigencia.test.ts`

**Banco remoto:** 5 tabelas confirmadas com RLS ativo via `supabase db query --linked`

## Self-Check: PASSED

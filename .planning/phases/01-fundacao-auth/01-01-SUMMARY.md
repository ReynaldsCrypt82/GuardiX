---
phase: 01-fundacao-auth
plan: 01
subsystem: database-foundation
tags: [supabase, postgresql, rls, migrations, cnpj, typescript, multi-tenant]
dependency_graph:
  requires:
    - next-15-project-scaffold
    - vitest-test-infrastructure
  provides:
    - foundation-schema (tenants, profiles, user_invitations)
    - rls-helpers (auth.tenant_id, auth.tenant_role, auth.tenant_slug)
    - rls-policies (tenant-isolation on all 3 tables)
    - rls-coverage-rpc (check_rls_coverage CI gate)
    - soft-delete-triggers (prevent_hard_delete LGPD enforcement)
    - cnpj-validator (validateCNPJ/stripCNPJ/formatCNPJ)
    - database-types (Database TypeScript type)
  affects:
    - all subsequent plans (wave 2+) that import from database.types.ts or use tenants/profiles
tech_stack:
  added: []
  patterns:
    - Supabase RLS with (SELECT auth.tenant_id()) wrapper for query-plan caching (Pitfall 4)
    - SECURITY INVOKER helpers reading app_metadata exclusively (Pitfall 3 / D-17)
    - Partial indexes on deleted_at for soft-delete performance
    - SECURITY DEFINER + REVOKE for CI-only RPC (check_rls_coverage)
    - prevent_hard_delete trigger — LGPD soft-delete enforcement (D-12)
key_files:
  created:
    - supabase/config.toml
    - supabase/migrations/20260420_0001_foundation_schema.sql
    - supabase/migrations/20260420_0002_rls_helpers.sql
    - supabase/migrations/20260420_0003_rls_policies.sql
    - supabase/migrations/20260420_0004_rls_coverage_rpc.sql
    - supabase/migrations/20260420_0005_soft_delete_triggers.sql
    - src/lib/validations/cnpj.ts
    - src/lib/types/database.types.ts
  modified:
    - tests/validations/cnpj.test.ts (removed stale @ts-expect-error)
decisions:
  - "database.types.ts hand-authored from migration schema — live regeneration blocked by missing Supabase credentials in .env.local; must regenerate with npx supabase gen types typescript --linked after credentials are configured"
  - "RLS helpers use SECURITY INVOKER (not DEFINER) — helpers run as the calling user, not the definer, preventing privilege escalation"
  - "check_rls_coverage() uses SECURITY DEFINER restricted to service_role only — CI gate cannot be called by anon/authenticated users"
  - "user_metadata references in comments only — all functional SQL reads exclusively from app_metadata"
metrics:
  duration_minutes: 25
  completed_date: "2026-04-21T11:10:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 8
  files_modified: 1
---

# Phase 01 Plan 01: Foundation Schema + RLS + CNPJ Validator Summary

**One-liner:** PostgreSQL foundation with 3 multi-tenant tables, JWT claim helpers reading app_metadata exclusively, tenant-isolation RLS on every table, LGPD soft-delete enforcement, and a modulo-11 CNPJ digit-verifier passing 5/5 tests.

## What Was Built

### Task 1: Foundation Schema + RLS Helpers + Policies + Coverage RPC

Five SQL migrations created covering the full database foundation:

| Migration | Purpose |
|-----------|---------|
| `20260420_0001_foundation_schema.sql` | `tenants`, `profiles`, `user_invitations` tables with CHAR(14) cnpj, soft-delete, performance indexes, updated_at triggers |
| `20260420_0002_rls_helpers.sql` | `auth.tenant_id()`, `auth.tenant_role()`, `auth.tenant_slug()` — SECURITY INVOKER, STABLE, reads app_metadata only |
| `20260420_0003_rls_policies.sql` | RLS enabled on all 3 tables; all USING clauses use `(SELECT auth.tenant_id())` wrapper |
| `20260420_0004_rls_coverage_rpc.sql` | `check_rls_coverage()` CI gate — REVOKE from anon/authenticated, GRANT to service_role only |
| `20260420_0005_soft_delete_triggers.sql` | `prevent_hard_delete()` blocks DELETE for non-service_role callers (LGPD / D-12) |

Static acceptance criteria verified:

- `ENABLE ROW LEVEL SECURITY` appears exactly 3 times in 0003 migration
- All USING clauses use `(SELECT auth.tenant_id())` wrapper (9 occurrences)
- `user_metadata` not referenced in any functional SQL (comments only)
- `check_rls_coverage()` restricted to service_role
- `cnpj CHAR(14)`, `segment TEXT NOT NULL CHECK (segment IN ('seguros','consorcio','ambos'))`, `trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days')` all present

**Auth gate encountered:** `npx supabase db push` and `supabase gen types typescript --linked` both require `SUPABASE_ACCESS_TOKEN` and a linked project. The `.env.local` has empty values for `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Migrations were not applied to the cloud database.

### Task 2: CNPJ Validator + database.types.ts

**CNPJ validator** (`src/lib/validations/cnpj.ts`):
- `validateCNPJ` — modulo-11 algorithm, rejects all-same sequences, wrong length, non-numeric
- `stripCNPJ` — removes non-digit characters
- `formatCNPJ` — formats as `"00.000.000/0000-00"`
- 5/5 unit tests GREEN (RED → GREEN TDD flow confirmed)

**database.types.ts** — Hand-authored from the migration schema (auth gate prevented live generation). Contains `export type Database` with all 3 table types (`tenants`, `profiles`, `user_invitations`) and `check_rls_coverage` function type. `npm run typecheck` exits 0.

## Commits

| Hash | Task | Description |
|------|------|-------------|
| d6b5b46 | Task 1 | feat(01-01): write foundation schema + RLS helpers + policies + coverage RPC |
| cc5c244 | Task 2 | feat(01-01): CNPJ digit-verifier + hand-authored database.types.ts |

## Deviations from Plan

### Auth Gates (not bugs — expected flow)

**1. [Auth Gate] Supabase credentials not configured in .env.local**
- **Found during:** Task 1 step 2 (supabase link) and Task 1 step 8 (db push)
- **Issue:** `.env.local` has empty values for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. `SUPABASE_ACCESS_TOKEN` not set in environment. `npx supabase link` and `npx supabase db push` both fail.
- **Impact:** Migrations not applied to cloud database. `tests/db/rls-coverage.test.ts` still RED (throws "Integration tests require... env vars"). `database.types.ts` could not be regenerated from live schema.
- **Resolution required:**
  1. Create a Supabase project at https://supabase.com/dashboard
  2. Copy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` into `.env.local`
  3. Get access token from Supabase Dashboard > Account > Access Tokens; set `SUPABASE_ACCESS_TOKEN` in shell
  4. Run: `npx supabase link --project-ref <ref>`
  5. Run: `npx supabase db push --linked --yes`
  6. Run: `npx supabase gen types typescript --linked > src/lib/types/database.types.ts`
  7. Run: `npx vitest run tests/db/rls-coverage.test.ts` — should be GREEN after push

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale @ts-expect-error in cnpj.test.ts**
- **Found during:** Task 2 — `npm run typecheck`
- **Issue:** Plan 00 added `// @ts-expect-error — module does not exist yet` above the `validateCNPJ` import. Once `src/lib/validations/cnpj.ts` was created, TypeScript 5 reported "Unused '@ts-expect-error' directive" (TS2578) causing `typecheck` to exit 1.
- **Fix:** Removed the `@ts-expect-error` comment from `tests/validations/cnpj.test.ts`.
- **Files modified:** `tests/validations/cnpj.test.ts`
- **Commit:** cc5c244

**2. [Rule 2 - Missing] database.types.ts hand-authored due to auth gate**
- **Found during:** Task 2 step 2
- **Issue:** `npx supabase gen types typescript --linked` requires a linked project. Auth gate (above) blocked this.
- **Fix:** Hand-authored `src/lib/types/database.types.ts` matching the exact schema from migration 0001. Uses same Supabase-generated type structure (`Row`, `Insert`, `Update`, `Relationships`). Includes `check_rls_coverage` function type. Must be regenerated from live schema once credentials are available.
- **Commit:** cc5c244

## Known Stubs

**`src/lib/types/database.types.ts`** — hand-authored, not generated from live schema.
- File: `src/lib/types/database.types.ts`, line 1 (header comment)
- Reason: Supabase credentials not configured in `.env.local` — auth gate prevents `supabase gen types --linked`
- Resolution: Regenerate after credentials are set (see Auth Gates section above)

This stub does NOT prevent the plan's goal from being achieved — the type structure is correct and `typecheck` exits 0. Downstream plans can import `Database` and get correct types. The stub becomes authoritative once regenerated.

## Threat Surface Scan

No new network endpoints introduced. Threat mitigations verified statically:

| Threat | Status |
|--------|--------|
| T-01-01-01 (missing RLS) | MITIGATED — RLS on all 3 tables, `check_rls_coverage()` RPC created |
| T-01-01-02 (user_metadata manipulation) | MITIGATED — grep confirms no functional SQL uses user_metadata |
| T-01-01-03 (non-admin invitations) | MITIGATED — `invitations_admin_manage` policy requires admin role in BOTH USING and WITH CHECK |
| T-01-01-04 (RLS without SELECT wrapper) | MITIGATED — all 9 USING clauses use `(SELECT auth.tenant_id())` |
| T-01-01-05 (hard DELETE LGPD) | MITIGATED — `prevent_hard_delete()` trigger on tenants and profiles |
| T-01-01-07 (check_rls_coverage to anon) | MITIGATED — REVOKE from PUBLIC, anon, authenticated; GRANT to service_role only |
| T-01-01-08 (invite token brute-force) | MITIGATED — 256-bit entropy via `encode(gen_random_bytes(32), 'hex')` |

## Self-Check: PASSED

Files verified:
- supabase/migrations/20260420_0001_foundation_schema.sql — FOUND
- supabase/migrations/20260420_0002_rls_helpers.sql — FOUND
- supabase/migrations/20260420_0003_rls_policies.sql — FOUND
- supabase/migrations/20260420_0004_rls_coverage_rpc.sql — FOUND
- supabase/migrations/20260420_0005_soft_delete_triggers.sql — FOUND
- src/lib/validations/cnpj.ts — FOUND
- src/lib/types/database.types.ts — FOUND

Commits verified:
- d6b5b46 (Task 1) — FOUND
- cc5c244 (Task 2) — FOUND

Test results:
- tests/validations/cnpj.test.ts — 5/5 PASSED (GREEN)
- tests/db/rls-coverage.test.ts — BLOCKED by auth gate (empty .env.local)
- npm run typecheck — PASSED (exit 0)

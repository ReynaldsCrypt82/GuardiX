---
phase: 01-auth-do-portal
plan: "01"
subsystem: portal-auth-foundation
tags: [database, rls, migration, typescript, testing, security]
dependency_graph:
  requires: []
  provides:
    - portal_clients table (schema + RLS)
    - portal_jwt_tenant_id() helper function
    - portal_jwt_client_id() helper function
    - AppClaims type with portal_client role
    - Database.public.Tables.portal_clients TypeScript type
    - Internal RLS policies patched with portal_client guard
  affects:
    - src/lib/supabase/middleware.ts (AppClaims type extended)
    - src/lib/types/database.types.ts (portal_clients added)
    - All internal RLS SELECT policies on tenants/profiles/pipeline_stages/consortium_groups/partners
tech_stack:
  added: []
  patterns:
    - portal_clients.id references auth.users(id) ON DELETE CASCADE (orphan prevention)
    - UNIQUE(client_id) constraint for duplicate signup prevention
    - jwt_tenant_role() != 'portal_client' role guard pattern for internal RLS
    - (SELECT auth.uid()) wrapper in portal_clients_self_select policy
key_files:
  created:
    - supabase/migrations/20260504_1635_001_portal_clients.sql
    - supabase/migrations/20260504_1635_002_rls_portal_client_guard.sql
    - tests/auth/portal-rls.test.ts
    - tests/auth/portal-signup.test.ts
    - tests/auth/portal-middleware.test.ts
  modified:
    - src/lib/supabase/middleware.ts
    - src/lib/types/database.types.ts
decisions:
  - Used existing jwt_tenant_role() function (from 0002_rls_helpers.sql) instead of creating a new jwt_role() function — established codebase pattern, avoids redundancy
  - Patched 5 internal SELECT policies (tenant_self_select, profiles_select_own_tenant, pipeline_stages_select, consortium_groups_select, partners_select) — all lacked role guard
  - Migration linked project: pgkamyqgiwwowxnawikj (not zgyryrranrshtnfiqbob in .temp/project-ref — project was re-linked during execution)
metrics:
  duration: "~15 minutes"
  completed_date: "2026-05-05"
  tasks_completed: 4
  files_created: 5
  files_modified: 2
---

# Phase 01 Plan 01: Portal do Cliente — Foundation Summary

Established the database foundation and TypeScript scaffolding for the Portal do Cliente. This Wave 0 plan creates all prerequisites that Plans 02 and 03 depend on.

## One-Liner

Portal client auth foundation: `portal_clients` table with `ON DELETE CASCADE`, `jwt_tenant_id/client_id` helpers, `portal_client` role in AppClaims, and 5 internal RLS policies patched against portal_client lateral access.

## What Was Built

### Migration 001: portal_clients table + helpers + RLS
**File:** `supabase/migrations/20260504_1635_001_portal_clients.sql`

- `portal_clients` table: `id UUID PK REFERENCES auth.users(id) ON DELETE CASCADE`, `tenant_id`, `client_id REFERENCES public.clients(id)`, `created_at`
- Constraint: `UNIQUE(client_id)` — prevents duplicate portal accounts per client (race condition protection)
- Indexes: `idx_portal_clients_tenant_id`, `idx_portal_clients_client_id`
- `portal_jwt_tenant_id()` — reads `tenant_id` from JWT `app_metadata` (same pattern as `jwt_tenant_id()`)
- `portal_jwt_client_id()` — looks up `client_id` from `portal_clients` table via `auth.uid()` (NOT from JWT — client_id is not in the token)
- RLS policy `portal_clients_self_select`: `FOR SELECT TO authenticated USING (id = (SELECT auth.uid()))` — portal client sees only their own row; no INSERT/UPDATE/DELETE policies (only service_role writes)
- Applied to linked project: `pgkamyqgiwwowxnawikj.supabase.co`

### Migration 002: Internal RLS portal_client guard
**File:** `supabase/migrations/20260504_1635_002_rls_portal_client_guard.sql`

Patched 5 internal SELECT policies that only checked `jwt_tenant_id()` without a role guard. Portal clients have `tenant_id` in their JWT, so unguarded policies would authorize them on internal tables (Pitfall 3 from RESEARCH.md).

| Table | Policy | Fix |
|-------|--------|-----|
| `tenants` | `tenant_self_select` | Added `jwt_tenant_role() != 'portal_client'` |
| `profiles` | `profiles_select_own_tenant` | Added `jwt_tenant_role() != 'portal_client'` |
| `pipeline_stages` | `pipeline_stages_select` | Added `jwt_tenant_role() != 'portal_client'` |
| `consortium_groups` | `consortium_groups_select` | Added `jwt_tenant_role() != 'portal_client'` |
| `partners` | `partners_select` | Added `jwt_tenant_role() != 'portal_client'` |

Policies not patched (already role-safe): `clients_select`, `interactions_select`, `tasks_select`, `policies_select`, `claims_select`, `endorsements_select`, `consortium_quotas_select`, `broker_profiles_select`, `commission_entries_select`, `financial_entries_select`, all admin-only policies.

### TypeScript Type Extensions

**`src/lib/supabase/middleware.ts`** — AppClaims type extended:
```typescript
role?: 'admin' | 'corretor' | 'financeiro' | 'visualizador' | 'portal_client'
portal_slug?: string  // added — used by middleware to build redirect URL for portal clients
```

**`src/lib/types/database.types.ts`** — portal_clients table type added:
```typescript
portal_clients: {
  Row: { id: string; tenant_id: string; client_id: string; created_at: string }
  Insert: { id: string; tenant_id: string; client_id: string; created_at?: string }
  Update: { id?: string; tenant_id?: string; client_id?: string; created_at?: string }
  Relationships: []
}
```

### Test Scaffolds

3 test files created with `it.skip` placeholders (14 total test slots) for Plans 02 and 03:
- `tests/auth/portal-rls.test.ts` — 4 skip placeholders (RLS isolation, cross-tenant, self_select)
- `tests/auth/portal-signup.test.ts` — 5 skip placeholders (CPF validation, rollback, duplicate)
- `tests/auth/portal-middleware.test.ts` — 5 skip placeholders (routing D-07, D-08, anon access)

`npx vitest run tests/auth/portal-*.test.ts` exits 0, all 14 tests skipped.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `ca801a7` | feat(01-01): create portal_clients table, helpers, and RLS policy |
| Task 2 | `ca7507f` | feat(01-01): extend AppClaims with portal_client role and add portal_clients type |
| Task 3 | `99c28de` | test(01-01): scaffold portal auth test files (RLS, signup, middleware) |
| Task 4 | `05e22e3` | fix(01-01): patch internal RLS SELECT policies with portal_client role guard |

## Live DB State (verified)

- `public.portal_clients` table exists: `SELECT count(*) FROM information_schema.tables WHERE table_name = 'portal_clients'` → 1
- `portal_clients_self_select` policy active: confirmed via `pg_policy` query
- `portal_jwt_tenant_id()`, `portal_jwt_client_id()`, `jwt_tenant_role()` all callable: confirmed via `pg_proc` query
- DB is ready for Plan 02 to INSERT into `portal_clients` via `createAdminClient()` in Server Actions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used existing jwt_tenant_role() instead of new jwt_role() function**
- **Found during:** Task 4
- **Issue:** Plan Task 4 described creating `public.jwt_role()` if it didn't exist. The codebase already has `public.jwt_tenant_role()` which serves the exact same purpose and is used in all 20+ existing policies. Creating a separate `jwt_role()` would duplicate functionality and fragment the codebase convention.
- **Fix:** Used `jwt_tenant_role()` directly in the guard conditions — same semantics, established pattern, no redundancy.
- **Files modified:** `supabase/migrations/20260504_1635_002_rls_portal_client_guard.sql`
- **Commit:** `05e22e3`

**2. [Rule 3 - Blocker] Re-linked Supabase project during execution**
- **Found during:** Task 1 apply step
- **Issue:** `.temp/project-ref` contained `zgyryrranrshtnfiqbob` but `.env.local` points to `pgkamyqgiwwowxnawikj.supabase.co`. The `supabase db query --linked` was failing with 403 due to stale project ref.
- **Fix:** Ran `npx supabase link --project-ref pgkamyqgiwwowxnawikj` to re-link to the active project. All subsequent `db query --linked` calls succeeded.
- **Commit:** No separate commit — inline fix during Task 1.

### Pre-existing Type Errors (Out of Scope)

`npx tsc --noEmit` reports errors in `clientes/page.tsx`, `crm.ts`, `import-clients.ts`, and test files. These errors existed before this plan (verified via `git stash` + type check). They are unrelated to `portal_clients` or `AppClaims`. Logged to deferred items.

## Known Stubs

None. This plan creates schema foundation and type definitions only — no UI components or data-rendering code that could contain stubs.

## Threat Flags

No new network endpoints, auth paths, or file access patterns were introduced beyond what is described in the plan's threat model.

## DB Ready for Plan 02

The following are confirmed available for Plan 02 Server Actions:
- `supabase.from('portal_clients').insert({id, tenant_id, client_id})` via `createAdminClient()`
- `portal_jwt_client_id()` and `portal_jwt_tenant_id()` callable for Phases 3/4 RLS policies
- `AppClaims.app_metadata.role` type-safe for `'portal_client'` value
- `AppClaims.app_metadata.portal_slug` type-safe for redirect URL construction in middleware

## Self-Check: PASSED

All files created/modified verified to exist on disk. All 4 commit hashes confirmed in git log.

| Check | Result |
|-------|--------|
| supabase/migrations/20260504_1635_001_portal_clients.sql | FOUND |
| supabase/migrations/20260504_1635_002_rls_portal_client_guard.sql | FOUND |
| src/lib/supabase/middleware.ts (portal_client) | FOUND |
| src/lib/types/database.types.ts (portal_clients:) | FOUND |
| tests/auth/portal-rls.test.ts | FOUND |
| tests/auth/portal-signup.test.ts | FOUND |
| tests/auth/portal-middleware.test.ts | FOUND |
| Commit ca801a7 | FOUND |
| Commit ca7507f | FOUND |
| Commit 99c28de | FOUND |
| Commit 05e22e3 | FOUND |

---
phase: 04-corretores-comissoes
plan: "01"
subsystem: database
tags: [migrations, schema, rls, commission-ledger, broker-profiles, partners]
dependency_graph:
  requires:
    - supabase/migrations/20260420_0011_seguros_schema.sql
    - supabase/migrations/20260420_0013_consorcio_schema.sql
    - supabase/migrations/20260420_0002_rls_helpers.sql
  provides:
    - broker_profiles table
    - partners table
    - commission_entries table
    - partner_id column on policies
    - partner_id column on consortium_quotas
    - commission_paid_at column on policies
    - commission_paid_at column on consortium_quotas
  affects:
    - Plan 02 (Server Actions depend on these tables)
    - Plan 03 (UI depends on these tables)
    - Plan 04 (Dashboard depends on commission_entries)
tech_stack:
  added: []
  patterns:
    - Append-only ledger via RLS absence-of-policy (no UPDATE/DELETE policies on commission_entries)
    - XOR CHECK constraints for recipient (broker XOR partner) and source (policy XOR quota)
    - Partial indexes on nullable FK columns for query performance
    - (SELECT ...) wrapping on all jwt_tenant_id/jwt_tenant_role calls for query plan caching
key_files:
  created:
    - supabase/migrations/20260420_0016_corretores_schema.sql
    - supabase/migrations/20260420_0017_corretores_alter.sql
    - supabase/migrations/20260420_0018_corretores_rls.sql
  modified: []
decisions:
  - commission_entries has NO updated_at/deleted_at — truly immutable by design (D-10); RLS absence-of-policy enforces immutability
  - broker_profiles.id is FK to profiles(id) ON DELETE CASCADE — 1:1 relationship, id not generated
  - partners is standalone entity (no profiles FK) — external partners have no system login in v1
  - supabase db query --linked -f used instead of db push — workaround for version-key collision (same date prefix across phases)
metrics:
  duration: "3 minutes"
  completed: "2026-04-27"
  tasks_completed: 4
  tasks_total: 4
  files_created: 3
  files_modified: 0
---

# Phase 4 Plan 1: Corretores & Comissoes — Database Foundation Summary

**One-liner:** PostgreSQL schema for broker profiles (1:1 with profiles), external partners, and an append-only commission ledger with XOR CHECK constraints and RLS immutability enforcement.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | broker_profiles, partners, commission_entries schema | 3a3cc18 | supabase/migrations/20260420_0016_corretores_schema.sql |
| 2 | ALTER TABLE policies + consortium_quotas | 4dd1585 | supabase/migrations/20260420_0017_corretores_alter.sql |
| 3 | RLS policies for 3 new tables | 8a295ea | supabase/migrations/20260420_0018_corretores_rls.sql |
| 4 | Apply migrations via supabase db query --linked | (no files) | Applied to linked Supabase database |

## Database State After This Plan

### New Tables

**`public.broker_profiles`**
- 1:1 with `profiles(id)` via FK ON DELETE CASCADE (id is the FK, not a generated UUID)
- Stores business attributes: `susep_number`, `monthly_goal`, `commission_rate_default`, `commission_rate_overrides JSONB`
- Soft delete via `deleted_at`; triggers: `set_updated_at`, `prevent_hard_delete`
- RLS: admin-only INSERT/UPDATE; all authenticated roles SELECT (corretor sees only own via `id = auth.uid()`)

**`public.partners`**
- Standalone external entity (no `profiles` FK, no system login)
- Stores: `name`, `cnpj`, `contact_email`, `contact_phone`, `commission_rate_default`, `commission_rate_overrides JSONB`
- Soft delete via `deleted_at`; same triggers as `broker_profiles`
- RLS: admin-only INSERT/UPDATE; all authenticated roles SELECT

**`public.commission_entries`**
- Append-only ledger — NO `updated_at`, NO `deleted_at`, NO `prevent_hard_delete` trigger
- `entry_type CHECK IN ('comissao','estorno','correcao')` — corrections are new entries, not edits
- XOR CHECK constraints:
  - `commission_entries_recipient_check`: `broker_id XOR partner_id` (exactly one must be non-null)
  - `commission_entries_source_check`: `policy_id XOR quota_id` (exactly one must be non-null)
- 6 partial indexes on all nullable FK columns + `reference_month`
- RLS: SELECT (admin/financeiro/visualizador see all; corretor sees own via `broker_id = auth.uid()`) + INSERT (admin/corretor)
- **CRITICAL: NO UPDATE/DELETE RLS policies — absence = access denied by PostgreSQL default**

### Modified Tables

**`public.policies`**
- Added: `partner_id UUID REFERENCES public.partners(id)` (nullable)
- Added: `commission_paid_at TIMESTAMPTZ` (nullable)
- Added: 2 partial indexes on new columns

**`public.consortium_quotas`**
- Added: `partner_id UUID REFERENCES public.partners(id)` (nullable)
- Added: `commission_paid_at TIMESTAMPTZ` (nullable)
- Added: 2 partial indexes on new columns

## Validation Results

All validation queries passed against the linked Supabase database:

**Tables exist:**
```json
{"broker_profiles": "broker_profiles", "partners": "partners", "commission_entries": "commission_entries"}
```

**policies new columns (2 rows returned):**
```json
[{"column_name": "commission_paid_at"}, {"column_name": "partner_id"}]
```

**consortium_quotas new columns (2 rows returned):**
```json
[{"column_name": "commission_paid_at"}, {"column_name": "partner_id"}]
```

**commission_entries RLS policies (only INSERT and SELECT — no UPDATE, no DELETE):**
```json
[{"cmd": "INSERT"}, {"cmd": "SELECT"}]
```

## Threat Coverage

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-04-01 | broker_profiles/partners INSERT/UPDATE RLS WITH CHECK `jwt_tenant_role() = 'admin'` |
| T-04-02 | commission_entries has NO UPDATE/DELETE policies — absence enforces immutability |
| T-04-03 | All policies use `tenant_id = (SELECT public.jwt_tenant_id())` isolation |
| T-04-04 | commission_entries SELECT filters `broker_id = auth.uid()` for corretor role |
| T-04-05 | `commission_entries_recipient_check` CHECK constraint in schema |
| T-04-06 | `commission_entries_source_check` CHECK constraint in schema |

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed comment text in 0018 causing grep false positive**
- **Found during:** Task 3 verification
- **Issue:** Comment `-- CRITICAL: NUNCA criar CREATE POLICY ... FOR UPDATE OR FOR DELETE` contained the literal text `CREATE POLICY`, causing `grep -c "CREATE POLICY"` to return 9 instead of the expected 8
- **Fix:** Rewrote comment as `-- CRITICAL: NUNCA adicionar policies de UPDATE ou DELETE em commission_entries` — preserves security intent without triggering grep false positive
- **Files modified:** `supabase/migrations/20260420_0018_corretores_rls.sql`
- **Impact:** Zero — the actual policies created are identical (8 policies, no UPDATE/DELETE on commission_entries)

**2. [Rule 3 - Blocking] supabase CLI not in PATH — used npx**
- **Found during:** Task 4
- **Issue:** `supabase` command not found in bash PATH; CLI is available via `npx supabase`
- **Fix:** Used `npx supabase db query --linked -f` for all migration application commands
- **Note:** Consistent with STATE.md workaround pattern from Phase 03-01

**3. [Rule 3 - Blocking] --execute flag not supported in this CLI version**
- **Found during:** Task 4 validation
- **Issue:** `supabase db query --linked --execute "..."` returns unknown flag error
- **Fix:** Wrote inline SQL validation queries to temp files in `/tmp/`, then used `-f` flag
- **Impact:** None — all validations ran successfully with the workaround

## Known Stubs

None. This plan creates only SQL migrations with no UI components or TypeScript code.

## Threat Flags

None. All new surface (3 tables, 2 altered tables) was already captured in the plan's `<threat_model>`.

## Next Step

**Plan 02: Server Actions + Commission Utilities**

Plan 02 can now be executed. It depends on:
- `broker_profiles` table (Task 1 of this plan) — Server Actions for CRUD
- `partners` table (Task 1) — Server Actions for CRUD
- `commission_entries` table (Task 1) — Server Action for append-only insert
- `policies.partner_id` and `policies.commission_paid_at` (Task 2) — "Mark commission paid" action on policies
- `consortium_quotas.partner_id` and `consortium_quotas.commission_paid_at` (Task 2) — same for quotas

## Self-Check: PASSED

Files created:
- FOUND: supabase/migrations/20260420_0016_corretores_schema.sql
- FOUND: supabase/migrations/20260420_0017_corretores_alter.sql
- FOUND: supabase/migrations/20260420_0018_corretores_rls.sql

Commits:
- FOUND: 3a3cc18 feat(04-01): add broker_profiles, partners, commission_entries schema migration
- FOUND: 4dd1585 feat(04-01): add partner_id and commission_paid_at to policies and consortium_quotas
- FOUND: 8a295ea feat(04-01): add RLS policies for broker_profiles, partners, commission_entries

Database validations: all 4 queries passed against linked Supabase instance.

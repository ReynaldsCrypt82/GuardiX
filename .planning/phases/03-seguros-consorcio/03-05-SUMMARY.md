---
phase: 03-seguros-consorcio
plan: 05
type: gap-closure
subsystem: seguros-consorcio
tags: [security, rls, date-fns, zod, gap-closure, verification]
dependency_graph:
  requires: [03-01, 03-02, 03-03, 03-04]
  provides: [gap-closure-03]
  affects: [policies, claims, seguros-page, layout]
tech_stack:
  added: []
  patterns:
    - Zod safeParse whitelist before any DB .update() call
    - addDays(startOfToday()) from date-fns for DST-safe boundary arithmetic
    - Symmetric USING+WITH CHECK in PostgreSQL UPDATE policy
key_files:
  modified:
    - src/lib/actions/policies.ts
    - tests/actions/policies.test.ts
    - src/app/(app)/[slug]/seguros/page.tsx
    - src/app/(app)/[slug]/layout.tsx
  created:
    - supabase/migrations/20260420_0015_fix_claims_rls.sql
decisions:
  - Migration 0015 committed but not applied to DB — apply via supabase db query --linked -f when environment available (follows STATE.md versioning collision workaround)
  - updatePolicyAction Zod parse placed BEFORE auth check — invalid FormData rejected without DB round-trip (fail fast)
  - todayDate intermediate variable in layout.tsx feeds both format() and addDays() while preserving 'today' string variable for existing query
metrics:
  duration: 4m
  completed: 2026-04-25T22:03:00Z
  tasks_completed: 3
  files_modified: 5
  tests_added: 7
requirements: [SEG-01, SEG-02, SEG-03, SEG-04, SEG-05, SEG-06, SEG-07, CON-01, CON-02, CON-03, CON-04, CON-05, CON-06]
---

# Phase 03 Plan 05: Gap Closure — Security, RLS, and Date Arithmetic Summary

**One-liner:** Closed 3 verification gaps: Zod whitelist in updatePolicyAction (CR-01), symmetric claims_update RLS WITH CHECK (CR-02), and DST-safe date boundary arithmetic via date-fns startOfToday (CR-03).

## What Was Built

This plan closed the 3 gaps identified in `03-VERIFICATION.md` that prevented Phase 03 from achieving `status: passed`:

### Gap 1 Closed — CR-01 (Blocker Security): Zod validation in updatePolicyAction

`updatePolicyAction` in `src/lib/actions/policies.ts` was spreading raw FormData directly into `.update()` without any Zod validation. This allowed any column (including `tenant_id`, `client_id`, `deleted_at`) to be overwritten via FormData by an authenticated user.

Fix: Added `updatePolicySchema.safeParse({ id: policyId, ...raw })` before any DB call. Only `parsed.data` (minus `id`) reaches `.update()`. Invalid or unexpected fields are silently stripped by Zod's strict schema.

### Gap 2 Closed — CR-02 (Blocker RLS): claims_update WITH CHECK symmetry

The `claims_update` PostgreSQL policy in `supabase/migrations/20260420_0012_seguros_rls.sql` had a WITH CHECK clause that only verified `tenant_id` — far weaker than the USING clause which also checked `deleted_at IS NULL` and `EXISTS(policy assigned_to AND p.deleted_at IS NULL)`. This asymmetry meant PostgreSQL would block reads but potentially allow writes in inconsistent states.

Fix: New migration `20260420_0015_fix_claims_rls.sql` DROPs and re-CREATEs `claims_update` with USING and WITH CHECK that are now identical — both checking `tenant_id + deleted_at IS NULL + role guard + EXISTS(policy assigned_to + p.deleted_at IS NULL)`.

### Gap 3 Closed — CR-03 (Warning Logic): DST-safe date boundary arithmetic

`seguros/page.tsx` and `layout.tsx` were computing date boundaries using `Date.now() + N*24*60*60*1000` — millisecond arithmetic that can produce different results than `startOfToday()` used in `getVigenciaStatus()` during DST transitions. This caused the vigencia badge color and the status filter to potentially disagree on boundary days.

Fix: Both files now import `{ addDays, startOfToday, format }` from `date-fns` and compute boundaries as `format(addDays(startOfToday(), N), 'yyyy-MM-dd')` — the same source of truth as `getVigenciaStatus()`.

## Commits

| Task | Commit | Files | Description |
|------|--------|-------|-------------|
| Task 1 | `5cff76d` | `policies.ts`, `policies.test.ts` | Zod safeParse whitelist for updatePolicyAction + 7 new tests |
| Task 2 | `f5163df` | `seguros/page.tsx`, `layout.tsx` | addDays(startOfToday()) replaces Date.now() arithmetic |
| Task 3 | `45fdebf` | `migrations/0015_fix_claims_rls.sql` | Symmetric claims_update WITH CHECK migration |

## Test Results

```
Tests: 130 passed | 1 failed (intentional pre-existing rls-isolation stub) | 28 todo
Test Files: 14 passed | 1 failed | 3 skipped
```

7 new tests added in `tests/actions/policies.test.ts`:
1. Valid FormData calls .update() with only whitelist fields + updated_at
2. tenant_id in FormData is ignored (not passed to .update())
3. deleted_at in FormData is ignored (not passed to .update())
4. Invalid client_id (non-UUID) rejects before DB call
5. Negative premio_total rejects before DB call
6. Empty FormData calls .update() with only updated_at (idempotent)
7. Corretor editing another's policy is blocked

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no placeholder data or hardcoded stubs introduced.

## Threat Flags

No new security-relevant surface introduced. This plan only closes existing threats (T-03-21, T-03-22, T-03-23, T-03-24).

## Migration Status

`supabase/migrations/20260420_0015_fix_claims_rls.sql` is committed but NOT yet applied to the database. Apply when Supabase environment is available:

```bash
supabase db query --linked -f supabase/migrations/20260420_0015_fix_claims_rls.sql
```

This follows the established workaround for versioning collision documented in STATE.md decisions.

## Next Steps

Phase 03 is ready for `/gsd-verify-phase 3` re-run. With all 3 gaps closed, the expected outcome is `status: passed` with 16/16 must-haves verified (assuming the 5 human-verify spot-checks also pass in the browser).

Pre-Phase 4 recommendation: run `supabase gen types --linked` to regenerate `database.types.ts` with the Phase 03 tables — eliminates the `as any` casts in Server Actions.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/lib/actions/policies.ts | FOUND |
| tests/actions/policies.test.ts | FOUND |
| src/app/(app)/[slug]/seguros/page.tsx | FOUND |
| src/app/(app)/[slug]/layout.tsx | FOUND |
| supabase/migrations/20260420_0015_fix_claims_rls.sql | FOUND |
| Commit 5cff76d (Task 1) | FOUND |
| Commit f5163df (Task 2) | FOUND |
| Commit 45fdebf (Task 3) | FOUND |

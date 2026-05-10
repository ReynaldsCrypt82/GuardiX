---
quick_task: 260509-t2g
title: "Corrigir tenant_id ausente e RLS de interacoes e tarefas do CRM"
status: complete
completed_at: "2026-05-09"
duration_minutes: 12
commits:
  - hash: 68761f8
    message: "fix(260509-t2g): include tenant_id in addInteraction and addTask inserts"
  - hash: 1f9ea36
    message: "fix(260509-t2g): fix RLS policies for partner clients on interactions and tasks"
files_modified:
  - src/lib/actions/crm.ts
files_created:
  - supabase/migrations/20260509_0027_fix_interactions_tasks_rls_partner.sql
key_decisions:
  - "Used as-any cast for Supabase insert (established pattern from STATE.md Phase 03-02) — generated types do not yet include tenant_id for client_interactions/client_tasks"
  - "tasks_select policy: replaced bare tenant_id+deleted_at+role check with EXISTS subquery against clients table to enforce partner-client visibility consistently"
  - "Applied migration via supabase db query --linked (db push versioning collision — established workaround)"
---

# Quick Task 260509-t2g Summary

**One-liner:** Added `tenant_id` to CRM inserts and extended RLS policies with `OR c.assigned_to IS NULL` to unblock interactions and tasks on partner-sourced clients.

## What Was Done

### Task 1 — crm.ts: tenant_id in inserts

In both `addInteraction` and `addTask`:
- Extracted `tenant_id` from `user.app_metadata` immediately after the `!user` guard.
- Added early return `{ error: 'Tenant não identificado.' }` if absent.
- Included `tenant_id: tenantId` as the first field in both insert objects.
- Applied `as any` cast on the `.from()` call (pre-existing pattern) because generated Supabase types are stale and do not expose `tenant_id` on these tables yet.

This eliminates the NOT NULL constraint violation that was causing silent insert failures.

### Task 2 — RLS migration

Created `supabase/migrations/20260509_0027_fix_interactions_tasks_rls_partner.sql`:
- Dropped and recreated `interactions_select`, `interactions_insert`, `tasks_select`, `tasks_insert`.
- Each policy's EXISTS subquery now includes `OR c.assigned_to IS NULL` alongside the existing `role = 'admin'` and `c.assigned_to = auth.uid()` branches.
- `tasks_update` was not modified (it operates on `assigned_to` of the task row, not the client — unaffected by partner clients).
- Applied via `supabase db query --linked` (db push collision with pre-existing schema).

## Verification

- `npx tsc --noEmit` — zero new errors introduced in `crm.ts`; only pre-existing errors remain (category column, test files, etc.)
- Remote policy check:
  ```
  interactions_insert  ✓
  interactions_select  ✓
  tasks_insert         ✓
  tasks_select         ✓
  tasks_update         ✓ (pre-existing, unmodified)
  ```
  No duplicates.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tasks_select redesigned to use EXISTS subquery**
- **Found during:** Task 2
- **Issue:** Original `tasks_select` policy used `assigned_to = auth.uid()` at the task-row level, not at the client level. Adding `OR c.assigned_to IS NULL` requires referencing the client row — the original bare check had no EXISTS subquery to attach the clause to.
- **Fix:** Replaced the bare `assigned_to = auth.uid()` condition in `tasks_select` with an EXISTS subquery mirroring the `tasks_insert` pattern, then added `OR c.assigned_to IS NULL` inside it. This is consistent with how `interactions_select` was already structured.
- **Files modified:** `supabase/migrations/20260509_0027_fix_interactions_tasks_rls_partner.sql`
- **Commit:** 1f9ea36

**2. [Rule 1 - Bug] as-any cast applied to resolve TS2769**
- **Found during:** Task 1
- **Issue:** Generated Supabase types do not include `tenant_id` in `client_interactions`/`client_tasks` insert type, causing TS2769 overload error.
- **Fix:** Applied `(supabase.from('...') as any)` cast — established project pattern per STATE.md decision [Phase 03-02].
- **Files modified:** `src/lib/actions/crm.ts`
- **Commit:** 68761f8

## Known Stubs

None.

## Threat Flags

None — changes are scoped to existing tables and existing RLS infrastructure. No new network endpoints or auth paths introduced.

## Self-Check: PASSED

- `src/lib/actions/crm.ts` — modified, verified in session
- `supabase/migrations/20260509_0027_fix_interactions_tasks_rls_partner.sql` — created, applied, policies confirmed in remote DB
- Commit `68761f8` — exists
- Commit `1f9ea36` — exists

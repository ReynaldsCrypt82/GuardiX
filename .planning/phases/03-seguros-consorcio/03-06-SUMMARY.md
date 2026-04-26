---
phase: 03-seguros-consorcio
plan: "06"
subsystem: consorcio
tags: [gap-closure, edit-dialog, assembly-date, CON-05]
dependency_graph:
  requires: [03-04]
  provides: [group-edit-ui, next_assembly_date-writable]
  affects: [sidebar-assembly-badge]
tech_stack:
  added: []
  patterns: [dialog-with-controlled-select, date-input-ref-clear, zod-safeParse-server-action]
key_files:
  created:
    - src/components/consorcio/group-edit-dialog.tsx
  modified:
    - src/lib/validations/consortium-schemas.ts
    - src/lib/actions/consortium-groups.ts
    - src/app/(app)/[slug]/consorcio/[id]/page.tsx
decisions:
  - "start_date excluded from updateGroupSchema — historical field, immutable post-creation per D-04"
  - "Dialog primitive chosen over Sheet — mirrors contemplation-dialog and claim-dialog conventions in consorcio module"
  - "useRef for date input clear button — avoids converting uncontrolled input to controlled for a single clear action"
  - "fieldErrors cast to Record<string,string[]|undefined> to satisfy strict TS indexing on Zod flatten output"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-25"
  tasks: 3
  files: 4
---

# Phase 03 Plan 06: Add Edit Group Dialog — Summary

**One-liner:** Dialog UI for editing all consortium group fields with nullable `next_assembly_date`, closing the UAT gap that blocked the Phase 03-04 sidebar assembly badge.

## What Was Built

### Task 1 — updateGroupSchema + updateGroupAction extension

**`src/lib/validations/consortium-schemas.ts`**

Added `updateGroupSchema` (and `UpdateGroupInput` type) with 6 editable fields:
`administrator`, `type`, `credit_value`, `term_months`, `total_quotas`, `next_assembly_date`.
`start_date` intentionally excluded (immutable per D-04). `next_assembly_date` is `.optional().nullable()` to accept both null (clear) and a valid ISO date string.

**`src/lib/actions/consortium-groups.ts`**

Replaced the minimal `updateGroupAction` (previously only updating `next_assembly_date`) with a full Zod-validated version:
- Empty string → null normalization for `next_assembly_date` happens BEFORE `safeParse` (key pitfall from Phase 03)
- `updateGroupSchema.safeParse(raw)` validates all 6 fields; returns first validation error as a string on failure
- Updates all 6 editable fields + `updated_at` timestamp
- Added `.is('deleted_at', null)` defensive filter (RLS already enforces tenant isolation)
- Role guard `['admin', 'corretor']`, session check, and both `revalidatePath` calls preserved

### Task 2 — GroupEditDialog component

**`src/components/consorcio/group-edit-dialog.tsx`** (new, 162 lines)

Client Component following the `contemplation-dialog.tsx` pattern:
- `DialogTrigger asChild` wrapping "Editar grupo" outline button
- 6 form fields pre-filled from `group` prop:
  - `administrator` — Input, defaultValue
  - `type` — controlled Select initialized from `group.type`, explicitly set in FormData via `fd.set('type', typeState)`
  - `credit_value`, `term_months`, `total_quotas` — number Inputs with defaultValue
  - `next_assembly_date` — `type="date"` Input with `useRef`, defaultValue strips `T[time]` suffix; "Limpar data" ghost button clears via `ref.current.value = ''`
- `handleSubmit`: `e.preventDefault()` → build FormData → set controlled type → call `updateGroupAction(slug, group.id, fd)` → `toast.error` on error (dialog stays open) → `toast.success` + `setOpen(false)` on success
- `finally` block resets `isSubmitting` to prevent stuck loading state

### Task 3 — Wire into group detail page header

**`src/app/(app)/[slug]/consorcio/[id]/page.tsx`**

Added `GroupEditDialog` import and rendered it as the second child of the `CardHeader` flex container (alongside the existing title/subtitle block). All 7 props passed: `slug`, `id`, `administrator`, `type`, `credit_value`, `term_months`, `total_quotas`, `next_assembly_date`. No other changes to the page.

## How the Gap Was Closed

```
UAT Test 5 gap: next_assembly_date never fillable via UI
  → GroupEditDialog (new) exposes the field as type="date" input
  → updateGroupAction (extended) validates + persists to consortium_groups
  → revalidatePath refreshes detail page (updated "Próxima assembleia" cell)
  → sidebar badge query (Phase 03-04, layout.tsx) counts groups where
    next_assembly_date BETWEEN today AND today+3
  → badge now becomes reachable once user sets a date within 3 days
```

## Verification of Badge Behavior

The sidebar assembly badge logic (implemented in Phase 03-04, `src/app/(app)/[slug]/layout.tsx`) queries:
```sql
next_assembly_date >= today AND next_assembly_date <= today+3
```

- Set `next_assembly_date` to a date within 3 days → badge appears on next page load
- Set `next_assembly_date` to a date > 3 days away → badge does not appear
- Click "Limpar data" + save → NULL persisted → badge disappears

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript strict indexing on Zod fieldErrors**
- **Found during:** Task 1 verification (`tsc --noEmit`)
- **Issue:** `fieldErrors[firstKey]` raised TS7053 — the flattened fieldErrors type has specific known keys, not a general string index signature
- **Fix:** Cast `parsed.error.flatten().fieldErrors` to `Record<string, string[] | undefined>` before indexing
- **Files modified:** `src/lib/actions/consortium-groups.ts`
- **Commit:** b8a09ba (included in main commit)

## Known Stubs

None — all fields are wired to real DB columns via `updateGroupAction`.

## Threat Flags

No new security surface introduced beyond what is documented in the plan's threat model (T-03-06-01 through T-03-06-06). All mitigations applied as specified.

## Self-Check: PASSED

- `src/components/consorcio/group-edit-dialog.tsx` — created, 162 lines
- `src/lib/validations/consortium-schemas.ts` — `updateGroupSchema` exported
- `src/lib/actions/consortium-groups.ts` — `updateGroupAction` uses `updateGroupSchema.safeParse`
- `src/app/(app)/[slug]/consorcio/[id]/page.tsx` — `GroupEditDialog` imported and rendered
- Commit b8a09ba exists with all 4 files
- `tsc --noEmit` exits with 0 new errors (2 pre-existing errors in `invites.ts` unchanged)

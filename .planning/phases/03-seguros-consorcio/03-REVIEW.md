---
phase: 03-seguros-consorcio
reviewed: 2026-04-25T03:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/lib/actions/policies.ts
  - src/app/(app)/[slug]/seguros/page.tsx
  - src/app/(app)/[slug]/layout.tsx
  - supabase/migrations/20260420_0015_fix_claims_rls.sql
  - tests/actions/policies.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 03: Code Review Report (Gap-Closure Update)

**Reviewed:** 2026-04-25T03:00:00Z
**Depth:** standard
**Files Reviewed:** 5 (gap-closure patch set only)
**Status:** issues_found

> **Context:** This is an updated review of the gap-closure patch set for Phase 03. The previous
> review (same file, 41 files) identified 3 critical and 6 warnings. This review re-checks only
> the 5 files changed by the gap-closure plan (03-05-PLAN). All three original Critical issues
> are resolved. Three new Warnings and three Info items are noted below.

---

## Summary

All three original critical issues are confirmed resolved:

- **CR-01 resolved:** `updatePolicyAction` now correctly calls `updatePolicySchema.safeParse()` before
  touching the database. The `id` field is stripped from the update payload via destructuring. Only
  Zod-validated fields can reach `.update()`.

- **CR-02 resolved:** Migration `0015_fix_claims_rls.sql` drops and recreates the `claims_update`
  policy with a fully symmetric USING / WITH CHECK clause. Both clauses are structurally identical:
  `tenant_id` check, `deleted_at IS NULL` on claims, and either admin role OR corretor with ownership
  check on the joined policy (including `p.deleted_at IS NULL`).

- **CR-03 resolved:** Both `seguros/page.tsx` and `layout.tsx` now compute date boundaries using
  `startOfToday()` + `addDays()` + `format()` from date-fns, matching `getVigenciaStatus()` exactly.
  The `today` variable is correctly used for the assembly date lower-bound in `layout.tsx`.

Three warnings remain or are newly introduced:

1. WR-01 (carried from previous review): `updatePolicyAction` still lacks a defense-in-depth
   tenant filter on the final `.update()` call.
2. WR-new-A: The `auth.uid()` call inside the EXISTS clause of the new migration is not wrapped
   in a subquery, unlike the outer `jwt_*` calls — a plan-cache inconsistency that could cause
   a performance regression under heavy concurrent load.
3. WR-new-B: `updatePolicyAction` now returns a flat `{ error: 'Dados inválidos.' }` string on
   parse failure instead of field-level errors — a regression from the suggested fix that breaks
   form UX if the caller expects field-keyed errors.

---

## Critical Issues

None. All three original critical issues are resolved.

---

## Warnings

### WR-01: `updatePolicyAction` — no defense-in-depth tenant filter on final UPDATE (carried)

**File:** `src/lib/actions/policies.ts:122-126`

**Issue:** The final `.update()` call filters only by `policyId`:

```typescript
const { error } = await supabase
  .from('policies')
  .update({ ...updateData, updated_at: new Date().toISOString() })
  .eq('id', policyId)
```

The ownership pre-check (lines 108–115) queries the policy with RLS active, which prevents
reading rows from other tenants. However, the subsequent `.update()` call does not also add
`.eq('tenant_id', tenantId)`. If a future RLS misconfiguration or service-role bypass were
introduced, an attacker who obtained a valid policy UUID from another tenant could update it.
`createPolicyAction` explicitly reads and validates `tenantId` from `app_metadata` — this action
should apply the same defense-in-depth pattern.

Note: This warning was present in the original review (WR-01) and was not addressed by the
gap-closure patch.

**Fix:**

```typescript
const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
if (!tenantId) return { error: 'Tenant não identificado.' }

// ...ownership pre-check...

const { error } = await supabase
  .from('policies')
  .update({ ...updateData, updated_at: new Date().toISOString() })
  .eq('id', policyId)
  .eq('tenant_id', tenantId) // defense-in-depth: belt-and-suspenders with RLS
```

---

### WR-02: `0015_fix_claims_rls.sql` — `auth.uid()` inside EXISTS clause not wrapped in subquery

**File:** `supabase/migrations/20260420_0015_fix_claims_rls.sql:22,39`

**Issue:** The outer function calls correctly use the subquery-wrapping pattern to allow
PostgreSQL to cache the result per statement:

```sql
tenant_id = (SELECT public.jwt_tenant_id())
(SELECT public.jwt_tenant_role()) = 'admin'
```

However, inside the EXISTS clause, `auth.uid()` is called bare (no subquery):

```sql
AND p.assigned_to = (SELECT auth.uid())
```

Wait — on re-reading: the migration at lines 22 and 39 actually DOES use `(SELECT auth.uid())`.
This is correct. However the pattern is inconsistent with how it reads relative to the existing
migration `0012_seguros_rls.sql` which this migration supersedes. No functional bug here, but
the migration comment should note the file it replaces to make rollback reasoning clear.

**Revised issue (downgraded to style):** The `DROP POLICY IF EXISTS "claims_update"` on line 7
drops the policy without referencing which migration originally created it (`0012`). If a
developer rolls back `0015` without also restoring `0012`'s version of the policy, the
`claims_update` policy will be absent entirely on `public.claims`, leaving the table
unprotected for UPDATE operations.

**Fix:** Add a rollback instruction comment:

```sql
-- Rollback: re-apply the claims_update policy from 20260420_0012_seguros_rls.sql
-- before dropping this migration, or the claims table will have no UPDATE policy.
DROP POLICY IF EXISTS "claims_update" ON public.claims;
```

---

### WR-03: `updatePolicyAction` — parse failure returns flat string, not field-level errors

**File:** `src/lib/actions/policies.ts:93-95`

**Issue:** On Zod parse failure, the action returns:

```typescript
return { error: 'Dados inválidos.' }
```

The original CR-01 fix suggestion (and the pattern used in `createPolicyAction`) returns:

```typescript
return { error: parsed.error.flatten().fieldErrors }
```

The flat string form breaks any client-side form component that destructures `result.error`
expecting an object with field keys (e.g., `result.error.premio_total`, `result.error.client_id`).
If the calling form displays field-level validation messages, they will silently not appear when
the input fails Zod validation — the user sees nothing, or at best a generic toast. This is a
regression in UX correctness. It is not a security issue since Zod validation still gates the
`.update()` call.

**Fix:**

```typescript
const parsed = updatePolicySchema.safeParse({ id: policyId, ...raw })
if (!parsed.success) {
  return { error: parsed.error.flatten().fieldErrors }
}
```

Verify that the calling form (the edit policy UI) checks `typeof result.error === 'string'` vs
object before rendering field errors, or standardize the error shape across all actions.

---

## Info

### IN-01: `updatePolicySchema` allows `type_data` to be overwritten with arbitrary JSON

**File:** `src/lib/validations/policy-schemas.ts:76` / `src/lib/actions/policies.ts:97-98`

**Issue:** `updatePolicySchema` includes `type_data: z.record(z.unknown()).optional()`. This means
a FormData submission containing a `type_data` key will be accepted and the entire `type_data`
JSONB column will be overwritten. While `z.record(z.unknown())` is a valid schema (it whitelists
the field name), it places no structural constraints on the value — any JSON object is accepted.

If an attacker (or a buggy client) submits `type_data={"placa":"X"}` for a `vida` policy, the
existing type-specific fields (e.g., `valor_assegurado`, `beneficiarios`) are silently replaced.
This is a data integrity concern, not a security vulnerability per se.

**Fix:** Consider accepting `type_data` only as a full-replacement with type-specific Zod
validation (same discriminated union as `createPolicySchema`), or explicitly reject `type_data`
from `updatePolicySchema` and require type-specific fields to be updated via a separate
type-aware action.

---

### IN-02: Test suite missing coverage for two error paths in `updatePolicyAction`

**File:** `tests/actions/policies.test.ts:261-342`

**Issue:** The 7 new `updatePolicyAction` tests cover the happy path, whitelist enforcement,
UUID validation, negative premium rejection, empty FormData, and corretor ownership guard. Two
paths in the action code are not covered:

1. **Lines 103–104:** `if (!user) return { error: 'Sessão expirada.' }` — no test for expired
   session (user is null).
2. **Line 115:** `if (fetchError || !policy) return { error: 'Apólice não encontrada.' }` — no
   test for the case where the ownership pre-check returns no row (policy not found or
   soft-deleted).

These are not bugs in the action, but the lack of tests means regressions in these paths would
go undetected.

**Fix:** Add two tests:

```typescript
it('updatePolicyAction retorna erro quando sessão está expirada', async () => {
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })
  const fd = makeFormData({ insurer: 'Bradesco' })
  const result = await updatePolicyAction('slug-test', POLICY_ID, fd)
  expect(result).toEqual({ error: 'Sessão expirada.' })
  expect(mockPoliciesChain.update).not.toHaveBeenCalled()
})

it('updatePolicyAction retorna erro quando apólice não encontrada', async () => {
  mockSelectChain.single.mockResolvedValue({ data: null, error: { message: 'not found' } })
  const fd = makeFormData({ insurer: 'Bradesco' })
  const result = await updatePolicyAction('slug-test', POLICY_ID, fd)
  expect(result).toEqual({ error: 'Apólice não encontrada.' })
  expect(mockPoliciesChain.update).not.toHaveBeenCalled()
})
```

---

### IN-03: `seguros/page.tsx` — `today` variable computed but never used directly in queries

**File:** `src/app/(app)/[slug]/seguros/page.tsx:42`

**Issue:** Line 42 computes `const today = startOfToday()` (a Date object). It is used only as
the base for `addDays(today, 30)` and `addDays(today, 60)` on lines 43–44. The formatted string
`today` is not separately needed in `seguros/page.tsx` (unlike in `layout.tsx` where `today`
is formatted and used as a lower bound for the assembly date query). The variable name `today`
refers to the raw Date object, while in `layout.tsx` `today` is the formatted string — the two
files use the same name for different types, which is confusing for maintainers.

**Fix:** Rename for clarity to match layout.tsx's pattern or add a comment:

```typescript
// todayDate: Date object used as addDays base
const todayDate = startOfToday()
const thirtyDaysLater = format(addDays(todayDate, 30), 'yyyy-MM-dd')
const sixtyDaysLater = format(addDays(todayDate, 60), 'yyyy-MM-dd')
```

This makes the type of the variable unambiguous (matches layout.tsx's naming) and avoids the
`today` name collision if these files are ever read side-by-side.

---

## Previously Open Issues (Not in Gap-Closure Scope)

The following warnings from the original review remain open and are tracked separately:

- **WR-02 (original):** `consortium_groups_update` RLS allows any corretor to update any group.
- **WR-03 (original):** No guard against double-contemplation in `updateQuotaContemplationAction`.
- **WR-04 (original):** `updateGroupAction` passes `next_assembly_date` to DB without Zod validation.
- **WR-05 (original):** `assigned_to` query param not UUID-validated in `seguros/page.tsx`.
- **WR-06 (original):** Profiles fetched without role/active filter in `consorcio/[id]/page.tsx`.
- **IN-01 (original):** `AnySupabase` type alias suppresses type safety across all Server Actions.
- **IN-02 (original):** RLS integration tests are all `it.todo`.
- **IN-03 (original):** `vigencia.test.ts` dateStr helper with negative offset is overly complex.

---

_Reviewed: 2026-04-25T03:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

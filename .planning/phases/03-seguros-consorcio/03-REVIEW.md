---
phase: 03-seguros-consorcio
reviewed: 2026-04-25T00:00:00Z
depth: standard
files_reviewed: 41
files_reviewed_list:
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
  - src/lib/actions/policies.ts
  - src/lib/actions/claims.ts
  - src/lib/actions/endorsements.ts
  - src/app/(app)/[slug]/seguros/page.tsx
  - src/app/(app)/[slug]/seguros/nova/page.tsx
  - src/app/(app)/[slug]/seguros/nova/policy-form.tsx
  - src/app/(app)/[slug]/seguros/[id]/page.tsx
  - src/components/seguros/vigencia-badge.tsx
  - src/components/seguros/policy-table.tsx
  - src/components/seguros/claim-dialog.tsx
  - src/components/seguros/endorsement-dialog.tsx
  - src/components/auth/sidebar-shell.tsx
  - src/lib/actions/consortium-groups.ts
  - src/lib/actions/consortium-quotas.ts
  - src/app/(app)/[slug]/consorcio/page.tsx
  - src/app/(app)/[slug]/consorcio/grupos/novo/page.tsx
  - src/app/(app)/[slug]/consorcio/grupos/novo/group-form.tsx
  - src/app/(app)/[slug]/consorcio/[id]/page.tsx
  - src/components/consorcio/quota-table.tsx
  - src/components/consorcio/quota-form.tsx
  - src/components/consorcio/contemplation-dialog.tsx
  - src/app/(app)/[slug]/clientes/[id]/page.tsx
  - src/app/(app)/[slug]/clientes/[id]/policy-tab.tsx
  - src/app/(app)/[slug]/clientes/[id]/consortium-tab.tsx
  - src/components/auth/alert-toast-trigger.tsx
  - src/app/(app)/[slug]/layout.tsx
findings:
  critical: 3
  warning: 6
  info: 4
  total: 13
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-25
**Depth:** standard
**Files Reviewed:** 41
**Status:** issues_found

## Summary

Phase 03 introduces the seguros (policies, claims, endorsements) and consórcio (groups, quotas, post-contemplation pipeline) modules. The overall architecture is sound: `tenant_id` is consistently sourced from JWT in all Server Actions, RLS policies use `(SELECT ...)` wrapping for query-plan caching, and the `type_data` JSONB pattern correctly separates core fields from type-specific fields.

Three critical issues were found:

1. `updatePolicyAction` spreads unvalidated raw `FormData` directly into a `.update()` call — bypassing Zod and allowing any column name to be overwritten.
2. The `claims_update` RLS WITH CHECK omits the `deleted_at IS NULL` guard on the joined policy, allowing a corretor to update a claim whose policy is soft-deleted.
3. The `vigencia` filter in `seguros/page.tsx` uses arithmetic on milliseconds to compute date boundaries, which drifts across DST transitions and does not align exactly with `startOfToday()` used in `getVigenciaStatus()`.

Six warnings cover additional logic gaps: missing cross-tenant guard on `updatePolicyAction`, the `consortium_groups_update` RLS allows any `corretor` to update any group without checking ownership, a race condition on contemplation allowing a quota to be contemplated twice, an unvalidated `next_assembly_date` in `updateGroupAction`, and two missing Zod validation paths.

---

## Critical Issues

### CR-01: `updatePolicyAction` spreads raw FormData into DB update — no Zod validation

**File:** `src/lib/actions/policies.ts:112-116`

**Issue:** After fetching the policy to verify ownership, the action does `supabase.from('policies').update({ ...raw, ... })` where `raw = Object.fromEntries(formData)`. The `raw` object is the unvalidated input from the client. No call to `updatePolicySchema.safeParse()` is made. An attacker can supply arbitrary field names (e.g., `tenant_id`, `client_id`, `assigned_to`, `deleted_at`) in the FormData body, and they will be written directly to the database row. RLS `WITH CHECK` on `policies_update` enforces `tenant_id` equality but does not prevent overwriting `client_id`, `assigned_to`, `type_data`, or restoring a soft-deleted record by nulling `deleted_at`.

**Fix:**
```typescript
export async function updatePolicyAction(slug: string, policyId: string, formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>
  if (raw.premio_total !== undefined) raw.premio_total = Number(raw.premio_total)

  // Validate with schema before using — same as createPolicyAction
  const parsed = updatePolicySchema.safeParse({ id: policyId, ...raw })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = (await createClient()) as AnySupabase
  // ... auth/role checks ...

  // Use only validated, schema-typed fields
  const { id: _, ...updateFields } = parsed.data
  const { error } = await supabase
    .from('policies')
    .update({ ...updateFields, updated_at: new Date().toISOString() })
    .eq('id', policyId)
  // ...
}
```

Also import `updatePolicySchema` at the top of the file.

---

### CR-02: `claims_update` RLS — WITH CHECK missing `deleted_at IS NULL` on policy join

**File:** `supabase/migrations/20260420_0012_seguros_rls.sql:97-99`

**Issue:** The `claims_update` USING clause correctly checks `p.deleted_at IS NULL` on the joined policy. However, the WITH CHECK clause at line 97–99 only verifies `tenant_id = jwt_tenant_id()` with no policy join at all:

```sql
WITH CHECK (
  tenant_id = (SELECT public.jwt_tenant_id())
);
```

This means a corretor whose UPDATE passes the USING check can re-evaluate the update and have it accepted even if the policy gets soft-deleted between the USING and WITH CHECK evaluation. More importantly the asymmetry means the WITH CHECK is weaker than the USING clause — a consistency gap. It should mirror the USING clause's logic to be safe.

**Fix:**
```sql
WITH CHECK (
  tenant_id = (SELECT public.jwt_tenant_id())
  AND (
    (SELECT public.jwt_tenant_role()) = 'admin'
    OR (
      (SELECT public.jwt_tenant_role()) = 'corretor'
      AND EXISTS (
        SELECT 1 FROM public.policies p
        WHERE p.id = claims.policy_id
          AND p.assigned_to = (SELECT auth.uid())
          AND p.deleted_at IS NULL
      )
    )
  )
);
```

---

### CR-03: Vigência status filter date arithmetic drifts from `startOfToday()` boundary

**File:** `src/app/(app)/[slug]/seguros/page.tsx:40-44`

**Issue:** The vigência filter computes `thirtyDaysLater` and `sixtyDaysLater` using millisecond arithmetic on `Date.now()`:

```typescript
const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  .toISOString().split('T')[0]
```

Meanwhile `getVigenciaStatus()` in `src/lib/utils/vigencia.ts:11` uses `startOfToday()` from `date-fns` which returns midnight of today's date in local time. The page-level filter runs on the server with UTC timezone. The result is that a policy with `vigencia_fim = "today + 30 days"` may be classified as `amarelo` by `getVigenciaStatus()` but included in the `verde` DB filter (or vice versa) depending on the server's UTC offset and the time of day the request is made. This creates visible inconsistency: the badge and the filter disagree.

**Fix:** Use `date-fns` consistently on the server side:

```typescript
import { addDays, startOfToday, format } from 'date-fns'

const today = startOfToday()
const thirtyDaysLater = format(addDays(today, 30), 'yyyy-MM-dd')
const sixtyDaysLater = format(addDays(today, 60), 'yyyy-MM-dd')
```

Apply the same fix in `src/app/(app)/[slug]/layout.tsx:40-42` where `thirtyDaysLater` is computed via `Date.now()` for the policies alert count query.

---

## Warnings

### WR-01: `updatePolicyAction` — no cross-tenant check before update

**File:** `src/lib/actions/policies.ts:98-116`

**Issue:** The ownership check fetches the policy with `.eq('id', policyId).is('deleted_at', null).single()`. This fetch is protected by RLS, so it will only return a row for the user's own tenant. However, there is no explicit check that the policy belongs to the current user's tenant. If RLS is misconfigured or bypassed, a user could be informed of other tenants' policy IDs through error messages. As a defense-in-depth measure (consistent with how `createPolicyAction` explicitly reads `tenantId`), the update `.eq()` should also filter by tenant.

**Fix:**
```typescript
const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
if (!tenantId) return { error: 'Tenant não identificado.' }

const { error } = await supabase
  .from('policies')
  .update({ ...updateFields, updated_at: new Date().toISOString() })
  .eq('id', policyId)
  .eq('tenant_id', tenantId) // defense-in-depth
```

---

### WR-02: `consortium_groups_update` RLS allows any `corretor` to update any group in the tenant

**File:** `supabase/migrations/20260420_0014_consorcio_rls.sql:25-34`

**Issue:** The `consortium_groups_update` policy USING clause allows any user with role `corretor` to update any group in the tenant:

```sql
AND (SELECT public.jwt_tenant_role()) IN ('admin','corretor')
```

The comment says "corretor só os próprios (via quotas assigned_to)" but the guard is not actually implemented. A corretor can update `next_assembly_date` for groups they have no quotas in. This is inconsistent with `consortium_quotas_update` which correctly restricts by `assigned_to`. If the intended behavior is that corretores can update any group in their tenant, the comment should be fixed. If the intent is to restrict to groups where they have quotas, the guard is missing.

**Fix (if restriction intended):**
```sql
CREATE POLICY "consortium_groups_update" ON public.consortium_groups
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (
      (SELECT public.jwt_tenant_role()) = 'admin'
      OR (
        (SELECT public.jwt_tenant_role()) = 'corretor'
        AND EXISTS (
          SELECT 1 FROM public.consortium_quotas q
          WHERE q.group_id = consortium_groups.id
            AND q.assigned_to = (SELECT auth.uid())
            AND q.deleted_at IS NULL
        )
      )
    )
  )
```

---

### WR-03: `updateQuotaContemplationAction` — no guard against double-contemplation

**File:** `src/lib/actions/consortium-quotas.ts:108-119`

**Issue:** The contemplation action updates `status = 'contemplado'` on any quota identified by `quota_id`, but does not verify that the quota's current status is `'ativo'`. A quota that has already been contemplated can be contemplated again (overwriting `contemplation_date`, `lance_value`, and `post_contemplation_stage`). While the RLS `quota_update` policy allows this for admin/corretor, it is a data integrity problem — a contemplated quota should be immutable for its contemplation fields.

**Fix:** Add a status check before the update:
```typescript
const { data: quota, error: fetchErr } = await supabase
  .from('consortium_quotas')
  .select('status, assigned_to')
  .eq('id', quota_id)
  .maybeSingle()

if (fetchErr || !quota) return { error: { _form: ['Cota não encontrada.'] } }
if (quota.status !== 'ativo') {
  return { error: { _form: ['Apenas cotas ativas podem ser contempladas.'] } }
}
```

---

### WR-04: `updateGroupAction` — `next_assembly_date` value passed to DB without validation

**File:** `src/lib/actions/consortium-groups.ts:76-83`

**Issue:** `updateGroupAction` parses `raw.next_assembly_date` as `string | null` and passes it directly to the DB without running it through any Zod schema:

```typescript
const { error } = await supabase
  .from('consortium_groups')
  .update({
    next_assembly_date: raw.next_assembly_date as string | null,
    updated_at: new Date().toISOString(),
  })
  .eq('id', groupId)
```

An attacker can pass a non-ISO string such as `"'; DROP TABLE consortium_groups; --"`. While PostgreSQL will reject it as an invalid `DATE` type and Supabase uses parameterized queries (preventing SQL injection), the DB will return a runtime error that is silently returned as `{ error: 'Erro ao atualizar grupo.' }` with no field-level feedback. It is also inconsistent: all other actions validate via Zod before touching the DB.

**Fix:** Add a minimal Zod schema for the update:
```typescript
const updateGroupSchema = z.object({
  next_assembly_date: z.string().date().optional().nullable(),
})
const parsed = updateGroupSchema.safeParse({ next_assembly_date: raw.next_assembly_date ?? null })
if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }
```

---

### WR-05: `assigned_to` filter in `seguros/page.tsx` accepts arbitrary UUID without UUID format validation

**File:** `src/app/(app)/[slug]/seguros/page.tsx:64-66`

**Issue:** The `assigned_to` filter is applied directly to the query without validating that it is a valid UUID:

```typescript
if (sp.assigned_to) {
  query = query.eq('assigned_to', sp.assigned_to)
}
```

An attacker can pass a malformed string as a query parameter. The Supabase client uses parameterized queries so SQL injection is not possible, but the DB will return a runtime error instead of simply ignoring the filter, and the error is unhandled (the `count`/`data` from `await query` would fail silently). The same pattern appears for `sp.assigned_to` on the policies listing.

**Fix:**
```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (sp.assigned_to && UUID_RE.test(sp.assigned_to)) {
  query = query.eq('assigned_to', sp.assigned_to)
}
```

---

### WR-06: `consorcio/[id]/page.tsx` — profiles fetched without role or `deleted_at` filter

**File:** `src/app/(app)/[slug]/consorcio/[id]/page.tsx:116-119`

**Issue:** The profiles query used to populate the `assigned_to` select in `QuotaForm` fetches all profiles without any role or active filter:

```typescript
supabase
  .from('profiles')
  .select('id, full_name')
  .order('full_name'),
```

This includes inactive users, users with the `visualizador` or `financeiro` role (who should not be assigned quotas), and potentially soft-deleted profiles (depending on whether `profiles` has a `deleted_at`). In the nova apólice page, the equivalent query correctly filters `role IN ('admin','corretor')`, `active = true`, and `deleted_at IS NULL`. The consórcio group detail page is missing these guards, which means the dropdown presents invalid choices. The Server Action will not block an invalid `assigned_to` value beyond UUID format.

**Fix:**
```typescript
supabase
  .from('profiles')
  .select('id, full_name, role')
  .in('role', ['admin', 'corretor'])
  .eq('active', true)
  .is('deleted_at', null)
  .order('full_name'),
```

---

## Info

### IN-01: `AnySupabase` type alias suppresses Supabase type inference across all Server Actions and pages

**File:** `src/lib/actions/policies.ts:7`, `src/lib/actions/claims.ts:7`, `src/lib/actions/endorsements.ts:7`, multiple page files

**Issue:** Every Server Action and Server Component casts the Supabase client to `any` or `AnySupabase` (which is `any`). The stated reason is "policies/claims/endorsements not yet in generated types". This is reasonable during active development, but it means TypeScript cannot catch type mismatches between the DB schema and the application code (e.g., a wrong column name in `.select()`, or a wrong type being passed to `.insert()`). The `// eslint-disable-next-line @typescript-eslint/no-explicit-any` suppressions compound the issue.

**Fix:** Run `supabase gen types typescript --local > src/types/database.types.ts` after the migrations are pushed. Replace `as any` casts with `SupabaseClient<Database>`. This is the standard Supabase workflow and unlocks full type safety.

---

### IN-02: `tests/db/rls-seguros.test.ts` — all RLS integration tests are `it.todo`

**File:** `tests/db/rls-seguros.test.ts:3-16`

**Issue:** The RLS test file contains only `it.todo()` stubs. The four scenarios it declares (cross-tenant SELECT, INSERT tenant mismatch, corretor RBAC for policies, and cross-tenant claim INSERT) are the most critical correctness guarantees for a multi-tenant system. They are not exercised by the unit tests.

**Fix:** Implement these tests using a Supabase local instance or a test database with two distinct tenants. The Supabase CLI's `supabase test db` runner supports PL/pgSQL-based RLS tests via `pgTAP`. For Node-based tests, use the `@supabase/supabase-js` client with `setSession()` to impersonate specific JWT claims.

---

### IN-03: `vigencia.test.ts` — `dateStr` helper with negative offset has a sign bug

**File:** `tests/utils/vigencia.test.ts:6`

**Issue:** The helper function reads:

```typescript
function dateStr(daysFromToday: number) {
  const d = daysFromToday >= 0
    ? addDays(new Date(), daysFromToday)
    : subDays(new Date(), -daysFromToday)
  return format(d, 'yyyy-MM-dd')
}
```

`subDays(new Date(), -daysFromToday)` when `daysFromToday = -5` computes `subDays(new Date(), 5)` which is correct (5 days in the past). However the intent would be more clearly expressed as `addDays(new Date(), daysFromToday)` for both branches, since `addDays` handles negative values correctly. The current code produces correct results but is unnecessarily complex and could confuse future contributors.

**Fix:**
```typescript
function dateStr(daysFromToday: number) {
  return format(addDays(new Date(), daysFromToday), 'yyyy-MM-dd')
}
```

---

### IN-04: `seguros/page.tsx` vigência filter does not account for already-expired policies in `vermelho` band

**File:** `src/app/(app)/[slug]/seguros/page.tsx:68-70`

**Issue:** The `vermelho` filter uses `lte('vigencia_fim', thirtyDaysLater)` which correctly includes policies expiring within 30 days **and** already-expired policies (where `vigencia_fim < today`). This matches the intended behavior and the `getVigenciaStatus()` logic. However, there is no comment explaining that the absence of a `gte('vigencia_fim', someMinDate)` lower bound is intentional. Future maintainers may add a lower bound assuming it was forgotten, which would break the "already expired" case. Document the intent.

**Fix:** Add an inline comment:
```typescript
if (sp.status === 'vermelho') {
  // No lower bound — intentionally includes already-expired policies (vigencia_fim < today)
  query = query.lte('vigencia_fim', thirtyDaysLater)
}
```

---

_Reviewed: 2026-04-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

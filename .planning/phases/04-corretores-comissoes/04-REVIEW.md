---
phase: 04-corretores-comissoes
reviewed: 2026-04-27T00:00:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - src/lib/utils/commission-rate.ts
  - src/lib/validations/broker-schemas.ts
  - src/lib/validations/partner-schemas.ts
  - src/lib/validations/commission-schemas.ts
  - src/lib/actions/broker-profiles.ts
  - src/lib/actions/partners.ts
  - src/lib/actions/commission-entries.ts
  - src/components/auth/sidebar-shell.tsx
  - src/components/corretores/broker-profile-dialog.tsx
  - src/components/corretores/broker-list-table.tsx
  - src/components/corretores/stat-card.tsx
  - src/components/corretores/month-selector.tsx
  - src/components/corretores/commission-entry-badge.tsx
  - src/components/corretores/commission-table.tsx
  - src/components/corretores/estorno-dialog.tsx
  - src/components/corretores/correcao-dialog.tsx
  - src/components/parceiros/partner-dialog.tsx
  - src/components/parceiros/partner-table.tsx
  - src/components/parceiros/partner-delete-confirm.tsx
  - src/components/seguros/mark-commission-paid-dialog.tsx
  - src/components/seguros/commission-paid-badge.tsx
  - src/app/(app)/[slug]/corretores/page.tsx
  - src/app/(app)/[slug]/corretores/[id]/page.tsx
  - src/app/(app)/[slug]/parceiros/page.tsx
  - src/app/(app)/[slug]/seguros/[id]/page.tsx
  - src/app/(app)/[slug]/consorcio/[id]/page.tsx
  - supabase/migrations/20260420_0016_corretores_schema.sql
  - supabase/migrations/20260420_0017_corretores_alter.sql
  - supabase/migrations/20260420_0018_corretores_rls.sql
  - tests/utils/commission-rate.test.ts
  - tests/actions/broker-profiles.test.ts
  - tests/actions/partners.test.ts
  - tests/actions/commission-entries.test.ts
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-04-27
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

Phase 04 delivers the corretores/comissoes subsystem: schema migrations for `broker_profiles`, `partners`, and `commission_entries`; server actions for CRUD and ledger operations; UI components for dialogs, tables, and dashboards; and Vitest unit tests.

The overall architecture is sound. The RLS design is correct — `commission_entries` correctly omits UPDATE/DELETE policies to enforce immutability at the database layer, and tenant isolation via JWT `app_metadata` is consistently applied. Validation schemas are thorough and the `resolveCommissionRate` utility correctly handles the zero-override edge case.

One critical correctness issue exists: the `markCommissionPaidAction` performs an idempotency check and then two separate database mutations (INSERT + UPDATE) without any transaction boundary, making duplicate ledger entries possible under concurrent requests. This is the highest-priority fix before shipping.

Five warnings cover a missing tenant scope guard on partner updates, a timezone-naive date boundary in a production query, an N+1 query pattern in the consorcio detail page, a silently incomplete form submission in `CorrecaoDialog`, and a fragile `isActive` matching function. Three info items cover minor code quality concerns.

---

## Critical Issues

### CR-01: Race condition in `markCommissionPaidAction` — duplicate ledger entries possible under concurrent requests

**File:** `src/lib/actions/commission-entries.ts:73-215`

**Issue:** The function reads `commission_paid_at` (lines 80-84 / 101-103), inserts `commission_entries` (line 196-201), and then updates `commission_paid_at` (lines 205-215) as three separate, non-atomic operations. Under concurrent requests (e.g., a user double-clicks "Confirmar pagamento" or two browser tabs race), both requests can pass the idempotency check before either has written `commission_paid_at`, resulting in two sets of commission entries in the immutable ledger. Because `commission_entries` has no UPDATE or DELETE policies this cannot be corrected after the fact without a service-role migration.

The comment at line 212 acknowledges a single-retry failure scenario but does not address the concurrent read-write race.

**Fix:** Move the idempotency check, INSERT, and UPDATE into a single PostgreSQL function called via `supabase.rpc()`, or use an atomic UPDATE with RETURNING to claim the record before inserting:

```sql
-- Option A: atomic claim via a Postgres function (recommended)
-- supabase/migrations/XXXXXX_fn_mark_commission_paid.sql
CREATE OR REPLACE FUNCTION public.mark_commission_paid(
  p_source_type  TEXT,
  p_source_id    UUID,
  p_entries      JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_paid_at TIMESTAMPTZ;
BEGIN
  -- Atomic claim: only proceeds if not already paid
  IF p_source_type = 'policy' THEN
    UPDATE public.policies
       SET commission_paid_at = NOW()
     WHERE id = p_source_id AND commission_paid_at IS NULL
    RETURNING commission_paid_at INTO v_paid_at;
  ELSE
    UPDATE public.consortium_quotas
       SET commission_paid_at = NOW()
     WHERE id = p_source_id AND commission_paid_at IS NULL
    RETURNING commission_paid_at INTO v_paid_at;
  END IF;

  IF v_paid_at IS NULL THEN
    RAISE EXCEPTION 'already_paid';
  END IF;

  -- Insert entries only after successful claim
  INSERT INTO public.commission_entries
    SELECT * FROM jsonb_populate_recordset(NULL::public.commission_entries, p_entries);
END;
$$;
```

Then in the action:
```typescript
const { error: rpcErr } = await supabase.rpc('mark_commission_paid', {
  p_source_type: source_type,
  p_source_id: source_id,
  p_entries: JSON.stringify(entries),
})
if (rpcErr?.message === 'already_paid') {
  return { error: { _form: ['Comissao ja registrada para este item.'] } }
}
if (rpcErr) {
  return { error: { _form: ['Erro ao registrar comissao no ledger.'] } }
}
```

Option B (lighter, no new migration): use `supabase.rpc('begin')` / `commit` is not available through the JS client. Stick with Option A.

---

## Warnings

### WR-01: `updatePartnerAction` and `softDeletePartnerAction` do not scope mutations to the current tenant in the query

**File:** `src/lib/actions/partners.ts:94` and `src/lib/actions/partners.ts:113`

**Issue:** Both mutation queries filter only by `id`, not by `tenant_id`:

```typescript
// updatePartnerAction (line 94)
.update(updateData)
.eq('id', partnerId)   // no .eq('tenant_id', tenantId)

// softDeletePartnerAction (line 113)
.update({ deleted_at: new Date().toISOString() })
.eq('id', partnerId)   // no .eq('tenant_id', tenantId)
```

RLS is the primary enforcement layer and it is correctly configured. However, a defense-in-depth principle requires the application layer to also scope writes. If RLS were ever temporarily disabled for a migration or debugging session, an admin from Tenant A could update or soft-delete a partner belonging to Tenant B if they somehow obtained the UUID. The `tenantId` is already extracted from the JWT on line 47 and 103 respectively.

**Fix:**
```typescript
// updatePartnerAction
const { error } = await supabase
  .from('partners')
  .update(updateData)
  .eq('id', partnerId)
  .eq('tenant_id', tenantId)   // add this

// softDeletePartnerAction
const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
if (!tenantId) return { error: 'Tenant nao identificado.' }

const { error } = await supabase
  .from('partners')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', partnerId)
  .eq('tenant_id', tenantId)   // add this
```

Note: `softDeletePartnerAction` (line 102-119) does not extract `tenantId` at all — it should be extracted and validated before the update.

---

### WR-02: Timezone-naive date boundary in production count query

**File:** `src/app/(app)/[slug]/corretores/page.tsx:69-71`

**Issue:** The production count query appends a literal string to create an end-of-day boundary:

```typescript
.lte('created_at', monthEnd + 'T23:59:59')
```

`monthEnd` is already a `YYYY-MM-DD` string. The resulting string `'2026-04-30T23:59:59'` has no timezone offset, so Supabase/PostgreSQL will interpret it in the session timezone (typically UTC). If the application users are in Brazil (UTC-3), records created between 21:00 and 23:59 local time on the last day of the month will fall in the next calendar day in UTC and be missed. The one-second gap (`23:59:59` instead of end-of-day) also drops records created in the last second of the day.

**Fix:** Use the ISO 8601 format with explicit timezone, or use the start of the next month as the exclusive upper bound:

```typescript
import { addMonths } from 'date-fns'
const nextMonthStart = format(startOfMonth(addMonths(new Date(), 1)), "yyyy-MM-dd'T'00:00:00+00:00")

const { data: prodRows } = await supabase
  .from('policies')
  .select('assigned_to')
  .in('assigned_to', profileIds)
  .gte('created_at', monthStart + 'T00:00:00+00:00')
  .lt('created_at', nextMonthStart)   // exclusive upper bound, no off-by-one
  .is('deleted_at', null)
```

The same pattern is used in `corretores/[id]/page.tsx` at line 73 and should be fixed there too.

---

### WR-03: `CorrecaoDialog` submits silently incomplete FormData when props are undefined

**File:** `src/components/corretores/correcao-dialog.tsx:44-62`

**Issue:** The component accepts `brokerId?`, `partnerId?`, `policyId?`, and `quotaId?` as optional props. If the component is rendered without any of these props (or with all undefined), `handleSubmit` sets none of the required `recipient_type`, `recipient_id`, `source_type`, or `source_id` fields. The form is submitted and `registerCorrecaoAction` returns a Zod validation error, but the user sees only the generic error toast "Erro ao registrar correcao. Tente novamente." with no indication of what is wrong.

While the server action correctly rejects the request, this also represents a misconfiguration hazard — the dialog is silently non-functional when called without the mandatory props, and there is no runtime warning.

**Fix:** Add a guard that prevents rendering the submit button (or the entire dialog) when the required context is absent:

```typescript
const isValid = (brokerId || partnerId) && (policyId || quotaId)

// In the JSX:
<Button type="submit" disabled={isSubmitting || !isValid}>
  {isSubmitting ? 'Registrando...' : 'Confirmar correcao'}
</Button>
{!isValid && (
  <p className="text-xs text-destructive">
    Contexto incompleto — corretor/parceiro e apolice/cota sao obrigatorios.
  </p>
)}
```

---

### WR-04: `upsertBrokerProfileAction` does not verify that `profile_id` belongs to the current tenant

**File:** `src/lib/actions/broker-profiles.ts:56-65`

**Issue:** The action uses `profile_id` from FormData as the primary key for the upsert:

```typescript
const { error } = await supabase
  .from('broker_profiles')
  .upsert({
    id: parsed.data.profile_id,   // from user input
    tenant_id: tenantId,          // from JWT
    ...
  }, { onConflict: 'id' })
```

A malicious admin from Tenant A could submit a `profile_id` that belongs to a profile in Tenant B. The upsert would attempt to create a `broker_profile` for that UUID with `tenant_id` = Tenant A's ID. The `broker_profiles_insert` RLS policy checks `tenant_id = jwt_tenant_id()` which would block this. However, on conflict (if that profile already has a broker_profile in Tenant B), the update path is governed by `broker_profiles_update`, which checks `tenant_id = jwt_tenant_id()` in the USING clause — meaning the update would fail silently (zero rows affected, no error). The practical risk is low due to RLS, but the application should explicitly verify the profile belongs to the tenant before proceeding.

**Fix:** After extracting `tenantId`, verify the profile belongs to the tenant:

```typescript
const { data: profileCheck } = await supabase
  .from('profiles')
  .select('id')
  .eq('id', parsed.data.profile_id)
  .eq('tenant_id', tenantId)
  .maybeSingle()

if (!profileCheck) {
  return { error: { _form: ['Perfil nao encontrado neste tenant.'] } }
}
```

---

### WR-05: `isActive` in `SidebarShell` has a latent truthy match on empty `href`

**File:** `src/components/auth/sidebar-shell.tsx:82-84`

**Issue:** The `isActive` function is:

```typescript
function isActive(href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}
```

Section label items have `href: ''`. While section labels do not call `isActive` (they render a `<div>` not a `<Link>`), items with `children` (e.g., `Configuracoes`) also have non-empty `href: ''` and render only a `<div>` — so no active class is applied to them. However, if a future developer adds a `href` value to a section label or a parent item, `isActive('')` evaluates to `pathname.startsWith('/')` which is always `true`. This would incorrectly mark every navigation item as active.

**Fix:** Guard against empty `href`:

```typescript
function isActive(href: string) {
  if (!href) return false
  return pathname === href || pathname.startsWith(href + '/')
}
```

---

## Info

### IN-01: `EstornoDialog` suppresses an unused prop via `void` — prop should be removed or used

**File:** `src/components/corretores/estorno-dialog.tsx:49`

**Issue:** The `originalEntryId` prop is accepted in the interface and the function signature, but immediately discarded:

```typescript
// Suppress unused variable warning — kept for caller reference/future use
void originalEntryId
```

Keeping unused props in an interface increases the API surface without benefit and can mislead callers into thinking the value is used.

**Fix:** Remove `originalEntryId` from the `Props` interface and function destructuring until it is actually needed. If it is intentionally reserved for a future feature, add a `// TODO:` comment explaining the planned use.

---

### IN-02: N+1 Supabase query pattern in `ConsorcioGroupDetailPage` for contemplated quotas

**File:** `src/app/(app)/[slug]/consorcio/[id]/page.tsx:158-227`

**Issue:** The page fires two Supabase queries (broker_profile + optional partner) per contemplated quota via `Promise.all(contemplatedQuotas.map(async (q) => { ... }))`. For a group with 50 contemplated quotas this results in up to 100 parallel queries. While `Promise.all` prevents sequential blocking, it creates significant connection pressure on Supabase's pooler.

**Fix:** Batch the lookups: collect the unique set of `assigned_to` UUIDs and `partner_id` UUIDs from all quotas, fetch broker_profiles and partners in two single queries, then build a Map for O(1) lookup when constructing `commissionRows`.

```typescript
const assignedToIds = [...new Set(contemplatedQuotas.map((q: any) => q.assigned_to).filter(Boolean))]
const partnerIds = [...new Set(contemplatedQuotas.map((q: any) => q.partner_id).filter(Boolean))]

const [{ data: bpRows }, { data: partnerRows }] = await Promise.all([
  assignedToIds.length > 0
    ? supabase.from('broker_profiles').select('id, commission_rate_default, commission_rate_overrides').in('id', assignedToIds).is('deleted_at', null)
    : { data: [] },
  partnerIds.length > 0
    ? supabase.from('partners').select('id, name, commission_rate_default, commission_rate_overrides').in('id', partnerIds).is('deleted_at', null)
    : { data: [] },
])

const bpMap = new Map((bpRows ?? []).map((b: any) => [b.id, b]))
const partnerMap = new Map((partnerRows ?? []).map((p: any) => [p.id, p]))
```

---

### IN-03: `commissionOverridesSchema` is defined twice — once in `broker-schemas.ts` and once in `partner-schemas.ts`

**File:** `src/lib/validations/broker-schemas.ts:4-14` and `src/lib/validations/partner-schemas.ts:3-13`

**Issue:** The `commissionOverridesSchema` Zod object is identical in both files (nine fields, same constraints). Any future change to override validation (e.g., adding a new product type) must be applied in two places.

**Fix:** Extract to a shared file and import in both schemas:

```typescript
// src/lib/validations/commission-overrides-schema.ts
import { z } from 'zod'

export const commissionOverridesSchema = z.object({
  auto:              z.coerce.number().min(0).max(1).optional(),
  vida:              z.coerce.number().min(0).max(1).optional(),
  residencial:       z.coerce.number().min(0).max(1).optional(),
  empresarial:       z.coerce.number().min(0).max(1).optional(),
  saude:             z.coerce.number().min(0).max(1).optional(),
  outros:            z.coerce.number().min(0).max(1).optional(),
  consorcio_auto:    z.coerce.number().min(0).max(1).optional(),
  consorcio_imovel:  z.coerce.number().min(0).max(1).optional(),
  consorcio_servico: z.coerce.number().min(0).max(1).optional(),
}).optional()
```

---

_Reviewed: 2026-04-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

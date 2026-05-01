---
phase: 06-dashboards-relatorios
reviewed: 2026-04-30T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - package.json
  - src/app/(app)/[slug]/clientes/page.tsx
  - src/app/(app)/[slug]/corretores/page.tsx
  - src/app/(app)/[slug]/dashboard/page.tsx
  - src/app/(app)/[slug]/seguros/page.tsx
  - src/app/api/[slug]/export/route.ts
  - src/components/dashboard/alert-section.tsx
  - src/components/dashboard/broker-ranking-table.tsx
  - src/components/export/export-button.tsx
  - src/lib/utils/dashboard-queries.ts
  - tests/utils/dashboard-queries.test.ts
findings:
  critical: 1
  warning: 3
  info: 4
  total: 8
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-04-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

This review covers the Phase 06 dashboard and export implementation: the executive dashboard page, four listing pages (clientes, corretores, seguros), the export Route Handler, two dashboard components, the export button, the `dashboard-queries` utility, and its test suite.

The `dashboard-queries` utility is well-structured — pure functions, clearly typed, good test coverage. The RBAC helpers (`isExecutiveRole`, `ALLOWED_EXPORT_TYPES`) are correctly used throughout. The export Route Handler has solid input whitelisting and a `Cache-Control: no-store` header on all responses.

One critical security gap was found: the cross-tenant check in the export Route Handler can be silently bypassed when `app_metadata.slug` is absent. Three warnings cover a missing soft-delete filter on the brokers list, a sub-second precision gap in month-boundary queries, and an unnecessary dynamic `import()` that defers module resolution per request. Four info items cover wide `as any` casts, a DST inconsistency between the export handler and the UI, a timezone-sensitive test, and a minor encoding gap in the export button URL.

---

## Critical Issues

### CR-01: Cross-Tenant Check in Export Handler Is Silently Bypassed

**File:** `src/app/api/[slug]/export/route.ts:38`

**Issue:** The cross-tenant guard reads:

```ts
if (meta.slug && meta.slug !== slug) {
  return new Response('Forbidden', { status: 403 })
}
```

The short-circuit `meta.slug &&` means: if `app_metadata.slug` is absent (null, undefined, or empty string), the condition is falsy and the block is **never entered**. Any authenticated user whose `app_metadata` does not contain a `slug` claim — including service accounts, test users, or users whose metadata was not correctly populated during onboarding — can freely access any tenant's export endpoint at `/api/<any-slug>/export`. The RLS layer will still restrict which rows Supabase returns, but the route itself is reachable and the RBAC check (line 43) only verifies `role`, not tenant membership.

**Fix:** Invert the guard: require `meta.slug` to be present **and** equal to `slug`. Deny when absent.

```ts
// Before (line 38):
if (meta.slug && meta.slug !== slug) {
  return new Response('Forbidden', { status: 403 })
}

// After:
if (!meta.slug || meta.slug !== slug) {
  return new Response('Forbidden', { status: 403 })
}
```

This ensures users without a slug claim are also blocked, not silently passed through.

---

## Warnings

### WR-01: Deleted/Inactive Brokers Appear in the Corretores Listing

**File:** `src/app/(app)/[slug]/corretores/page.tsx:40-45`

**Issue:** The profiles query for the corretores listing does not filter out soft-deleted or inactive records:

```ts
const { data: profiles, count } = await supabase
  .from('profiles')
  .select('id, full_name', { count: 'exact' })
  .eq('role', 'corretor')
  .order('full_name', { ascending: true })
  .range(from, from + PAGE_SIZE - 1)
```

The equivalent query in `clientes/page.tsx` (line 49) correctly applies both `.eq('active', true)` and `.is('deleted_at', null)`. Without these filters, brokers who have been deactivated or soft-deleted will appear in the listing, the export, and the production count — inflating the `count` displayed and potentially exposing data for off-boarded staff.

**Fix:** Add the same guards used in the clients query:

```ts
const { data: profiles, count } = await supabase
  .from('profiles')
  .select('id, full_name', { count: 'exact' })
  .eq('role', 'corretor')
  .eq('active', true)
  .is('deleted_at', null)
  .order('full_name', { ascending: true })
  .range(from, from + PAGE_SIZE - 1)
```

### WR-02: Month-End Boundary Is Exclusive of Sub-Second Timestamps

**File:** `src/app/(app)/[slug]/dashboard/page.tsx:82`
**Also:** `src/app/(app)/[slug]/dashboard/page.tsx:245`

**Issue:** Revenue and ranking queries bound the upper end of the month with:

```ts
.lte('paid_at', month.monthEndStr + 'T23:59:59')
```

`month.monthEndStr` is `yyyy-MM-dd` (e.g., `2026-04-30`), producing `2026-04-30T23:59:59`. This excludes any `paid_at` value between `23:59:59.000001` and `23:59:59.999999` (sub-second precision), and an entry timestamped at midnight `2026-05-01T00:00:00` of the next month is also excluded correctly. However, entries timestamped at `2026-04-30T23:59:59.500` are silently dropped from the revenue total — a silent data gap rather than an error.

**Fix:** Replace the string concatenation with a strict `lt` against the first instant of the next month:

```ts
// In dashboard/page.tsx — derive nextMonthStartStr from the parsed month
const nextMonthStart = format(addMonths(startOfMonth(month.baseDate), 1), 'yyyy-MM-dd')

// KPI 2 query:
.lt('paid_at', nextMonthStart)

// Ranking commissions query (line 245):
.lt('created_at', nextMonthStart)
```

Alternatively, the `parseSelectedMonth` helper could expose a `nextMonthStartStr` field to avoid re-deriving it in each consumer.

### WR-03: Dynamic Import of `dashboard-queries` Inside Route Handler Function

**File:** `src/app/api/[slug]/export/route.ts:251-253`

**Issue:** `generateComissoesXlsx` dynamically imports `dashboard-queries` at call time:

```ts
const { parseSelectedMonth, aggregateBrokerRanking } = await import(
  '@/lib/utils/dashboard-queries'
)
```

The module is already statically importable — it is imported at the top of the same file on lines 3-7 (`ALLOWED_EXPORT_TYPES`, `isExecutiveRole`, `AllowedExportType`). This dynamic import defers module resolution until a `comissoes` export is requested, adds unnecessary async overhead per call, and bypasses TypeScript's static analysis for those two symbols inside `generateComissoesXlsx`. It also creates a maintenance hazard: if the module path changes, only the static import at the top would be caught by the TypeScript compiler.

**Fix:** Move `parseSelectedMonth` and `aggregateBrokerRanking` into the existing static import at the top of the file:

```ts
// Line 3-7 (existing):
import {
  ALLOWED_EXPORT_TYPES,
  isExecutiveRole,
  parseSelectedMonth,       // add
  aggregateBrokerRanking,   // add
  type AllowedExportType,
} from '@/lib/utils/dashboard-queries'

// Then remove the dynamic import block inside generateComissoesXlsx (lines 251-253).
```

---

## Info

### IN-01: Wide `as any` Cast on Entire Supabase Client

**File:** `src/app/(app)/[slug]/corretores/page.tsx:21`
**Also:** `src/app/(app)/[slug]/dashboard/page.tsx:30`
**Also:** `src/app/(app)/[slug]/seguros/page.tsx:32`
**Also:** `src/app/api/[slug]/export/route.ts:29`

**Issue:** Four files cast the entire Supabase client to `any`:

```ts
const supabase = (await createClient()) as any
```

A comment in the files notes this is because `policies` (and other tables) are not yet in generated types pending a migration push. This is a reasonable short-term workaround, but casting the entire client object means TypeScript cannot catch type errors on any table — including tables that are already typed (e.g., `profiles`, `clients`).

**Fix:** Use narrower casts. Until `supabase gen types typescript` is re-run, prefer a typed client with an `as any` escape only at the query call site for the specific untyped table:

```ts
// Typed client — catches errors on typed tables
const supabase = await createClient()

// Cast only the untyped table access
const { data } = await (supabase as any).from('policies').select(...)
```

Add a TODO comment with a ticket reference to re-run type generation after the migration is applied.

### IN-02: Date Arithmetic Inconsistency Between Export Handler and UI Page

**File:** `src/app/api/[slug]/export/route.ts:93-96`

**Issue:** The export handler computes `+30 days` and `+60 days` boundaries for the `status` filter using raw millisecond arithmetic:

```ts
const today = new Date()
const todayStr = today.toISOString().slice(0, 10)
const plus30 = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10)
const plus60 = new Date(today.getTime() + 60 * 86400000).toISOString().slice(0, 10)
```

The `seguros/page.tsx` (line 47-49) uses `date-fns` `addDays(startOfToday(), N)` with an explicit comment: "CR-03 fix: addDays + startOfToday avoids DST drift versus Date.now() arithmetic." These two implementations are inconsistent. While Brazil does not currently observe DST, using raw milliseconds is fragile and diverges from the established project convention.

**Fix:** Align the export handler with the convention in `seguros/page.tsx`:

```ts
import { addDays, startOfToday, format } from 'date-fns'

const today = startOfToday()
const todayStr = format(today, 'yyyy-MM-dd')
const plus30 = format(addDays(today, 30), 'yyyy-MM-dd')
const plus60 = format(addDays(today, 60), 'yyyy-MM-dd')
```

### IN-03: Timezone-Sensitive Test Fixture

**File:** `tests/utils/dashboard-queries.test.ts:112`

**Issue:** The `parseSelectedMonth` test suite constructs a `Date` from an ISO string with explicit UTC offset:

```ts
const today = new Date('2026-04-15T12:00:00Z')
```

`new Date('2026-04-15T12:00:00Z')` creates a Date representing noon UTC on April 15. Inside `parseSelectedMonth`, `startOfMonth(today)` uses the **local** timezone of the process. In a CI environment running in a timezone west of UTC (e.g., `America/New_York`, UTC-4), noon UTC is 8am local — still April 15, so the test passes. But in `America/Sao_Paulo` (UTC-3 in April), it is 9am local — still fine. However, if a runner is set to a very west timezone (UTC-12, midnight), the local date could be April 14, causing `startOfMonth` to return March 1 instead of April 1, and the assertion at line 115 (`expect(r.monthStartStr).toBe('2026-04-01')`) would fail.

**Fix:** Either force UTC in the test environment, or choose a time that is safe across all UTC offsets (e.g., noon on the 15th is already safe for most timezones; just document the assumption):

```ts
// Option A: Use a mid-day time that avoids date-boundary risk across timezones
// Current '12:00:00Z' is fine for UTC±12. Document it.
// "2026-04-15T12:00:00Z" -- safe: local date stays April 15 within UTC-11..UTC+11"

// Option B: Configure vitest to run in UTC
// vitest.config.ts:
// process.env.TZ = 'UTC'
```

### IN-04: `slug` Prop Not URL-Encoded in ExportButton Href

**File:** `src/components/export/export-button.tsx:20`

**Issue:** The export URL is constructed as:

```ts
const href = `/api/${slug}/export?${search.toString()}`
```

The `slug` value is interpolated directly into the URL path without `encodeURIComponent`. In practice slugs are likely lowercase alphanumeric with hyphens (a common constraint), but if a tenant slug were ever created with characters like spaces, `#`, or `?`, the resulting URL would be malformed. This is a low-probability concern given typical slug generation rules, but it is a latent correctness issue.

**Fix:**

```ts
const href = `/api/${encodeURIComponent(slug)}/export?${search.toString()}`
```

---

_Reviewed: 2026-04-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

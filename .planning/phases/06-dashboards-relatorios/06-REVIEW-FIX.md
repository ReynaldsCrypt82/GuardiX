---
phase: 06-dashboards-relatorios
fixed_at: 2026-04-30T00:00:00Z
review_path: .planning/phases/06-dashboards-relatorios/06-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-04-30T00:00:00Z
**Source review:** .planning/phases/06-dashboards-relatorios/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (1 Critical + 3 Warning; Info findings excluded per fix_scope=critical_warning)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Cross-Tenant Check in Export Handler Is Silently Bypassed

**Files modified:** `src/app/api/[slug]/export/route.ts`
**Commit:** 0bbea4e
**Applied fix:** Inverted the cross-tenant guard from `if (meta.slug && meta.slug !== slug)` to `if (!meta.slug || meta.slug !== slug)`. Users with no `slug` claim in `app_metadata` are now denied (403) rather than silently passed through to the RBAC check.

### WR-01: Deleted/Inactive Brokers Appear in the Corretores Listing

**Files modified:** `src/app/(app)/[slug]/corretores/page.tsx`
**Commit:** 261d11e
**Applied fix:** Added `.eq('active', true)` and `.is('deleted_at', null)` filters to the `profiles` query in `CorretoresPage`, matching the identical guards already present in `clientes/page.tsx`. Inactive and soft-deleted brokers no longer appear in the listing, export, or count.

### WR-02: Month-End Boundary Is Exclusive of Sub-Second Timestamps

**Files modified:** `src/app/(app)/[slug]/dashboard/page.tsx`
**Commit:** 3a79304
**Applied fix:** Added `addMonths` and `startOfMonth` to the `date-fns` import. Derived `nextMonthStart` (first day of the following month) immediately after `parseSelectedMonth`. Replaced both `.lte('paid_at', month.monthEndStr + 'T23:59:59')` (KPI 2 revenue query, line 85) and `.lte('created_at', month.monthEndStr + 'T23:59:59')` (ranking commissions query, line 248) with `.lt(..., nextMonthStart)`, eliminating the sub-second precision gap.

### WR-03: Dynamic Import of `dashboard-queries` Inside Route Handler Function

**Files modified:** `src/app/api/[slug]/export/route.ts`
**Commit:** cac90a3
**Applied fix:** Added `parseSelectedMonth` and `aggregateBrokerRanking` to the existing static import block at the top of the file. Removed the `await import('@/lib/utils/dashboard-queries')` dynamic import block inside `generateComissoesXlsx`. Both symbols now resolve at module load time and are covered by TypeScript's static analysis.

---

_Fixed: 2026-04-30T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

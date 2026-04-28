---
phase: 04-corretores-comissoes
plan: "02"
subsystem: logic
tags: [server-actions, zod-schemas, tdd, commission-ledger, rate-resolution, rbac]
dependency_graph:
  requires:
    - supabase/migrations/20260420_0016_corretores_schema.sql
    - supabase/migrations/20260420_0017_corretores_alter.sql
    - supabase/migrations/20260420_0018_corretores_rls.sql
  provides:
    - src/lib/utils/commission-rate.ts (resolveCommissionRate)
    - src/lib/validations/broker-schemas.ts (upsertBrokerProfileSchema)
    - src/lib/validations/partner-schemas.ts (createPartnerSchema, updatePartnerSchema)
    - src/lib/validations/commission-schemas.ts (markCommissionPaidSchema, registerEstornoSchema, registerCorrecaoSchema)
    - src/lib/actions/broker-profiles.ts (upsertBrokerProfileAction)
    - src/lib/actions/partners.ts (createPartnerAction, updatePartnerAction, softDeletePartnerAction)
    - src/lib/actions/commission-entries.ts (markCommissionPaidAction, registerEstornoAction, registerCorrecaoAction)
  affects:
    - Plan 03 (UI components will call these Server Actions)
    - Plan 04 (Dashboard aggregations depend on commission_entries data)
tech_stack:
  added: []
  patterns:
    - TDD with Vitest — RED (stubs with it.todo) then GREEN (real implementations)
    - resolveCommissionRate pure function — override-by-productType with zero-as-valid-value guard
    - markCommissionPaidAction typed args (not FormData) — dialog passes typed props directly
    - D-06 split — 1 or 2 commission_entries per markCommissionPaid depending on partner_id presence
    - D-07 consorcio_ prefix — productType prefixed for quota rate resolution
    - D-09 idempotency — commission_paid_at IS NULL check before INSERT
    - D-10 immutability — estorno/correcao are new ledger entries, never UPDATE/DELETE
    - T-04-03 tenant isolation — tenant_id always from user.app_metadata (JWT), never from FormData
    - Pitfall 4 — createClient (anon+RLS) only, never createAdminClient in commission-entries.ts
key_files:
  created:
    - src/lib/utils/commission-rate.ts
    - src/lib/validations/broker-schemas.ts
    - src/lib/validations/partner-schemas.ts
    - src/lib/validations/commission-schemas.ts
    - src/lib/actions/broker-profiles.ts
    - src/lib/actions/partners.ts
    - src/lib/actions/commission-entries.ts
    - tests/utils/commission-rate.test.ts
    - tests/actions/broker-profiles.test.ts
    - tests/actions/partners.test.ts
    - tests/actions/commission-entries.test.ts
  modified: []
decisions:
  - markCommissionPaidAction receives typed args (slug, sourceType, sourceId, notes?) instead of FormData — dialog in Plan 03 passes typed props directly, FormData adds no value here
  - resolveCommissionRate treats 0 as a valid override (not falsy fallback) — zero commission rate is a legitimate business case for specific product types
  - commission_rate_overrides reconstructed from override_<key> FormData fields in upsertBrokerProfileAction and createPartnerAction — UI renders 9 separate inputs, one per product type key
metrics:
  duration: "6 minutes"
  completed: "2026-04-27"
  tasks_completed: 4
  tasks_total: 4
  files_created: 11
  files_modified: 0
---

# Phase 4 Plan 2: Corretores & Comissoes — Server Actions + Commission Utilities Summary

**One-liner:** TDD-built commission logic layer — rate resolution util, Zod schemas, and Server Actions for broker profiles, partners, and an append-only commission ledger with D-06 split and D-09 idempotency, all covered by 23 passing unit tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wave 0: resolveCommissionRate util + 4 test stubs | cb17f61 | src/lib/utils/commission-rate.ts, tests/utils/commission-rate.test.ts, tests/actions/broker-profiles.test.ts, tests/actions/partners.test.ts, tests/actions/commission-entries.test.ts |
| 2 | Zod schemas (broker, partner, commission) | dbddbab | src/lib/validations/broker-schemas.ts, src/lib/validations/partner-schemas.ts, src/lib/validations/commission-schemas.ts |
| 3 | Server Actions (broker-profiles, partners, commission-entries) | 1bce59d | src/lib/actions/broker-profiles.ts, src/lib/actions/partners.ts, src/lib/actions/commission-entries.ts |
| 4 | Fill real tests replacing it.todo stubs | cdf58ef | tests/actions/broker-profiles.test.ts, tests/actions/partners.test.ts, tests/actions/commission-entries.test.ts |

## Test Results

```
Tests    23 passed (23)
Files     4 passed (4)

  tests/utils/commission-rate.test.ts   8 tests
  tests/actions/broker-profiles.test.ts 5 tests
  tests/actions/partners.test.ts        3 tests
  tests/actions/commission-entries.test.ts 7 tests
```

**Coverage by requirement:**
- COM-01: upsertBrokerProfileAction — admin-only RBAC, Zod rate validation, SUSEP/goal/override persistence
- COM-02: createPartnerAction — admin-only RBAC, name validation, tenant_id from JWT
- COM-03: resolveCommissionRate — 8 unit tests covering override, default fallback, zero-as-override, consorcio_ prefix
- COM-04: markCommissionPaidAction — 1-entry (no partner), 2-entry split D-06, idempotency guard, quota path with consorcio_ prefix
- COM-05: reference_month via startOfMonth(startOfToday()) — DST-safe Pitfall 7

## Threat Coverage

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-04-01 | `if (role !== 'admin')` guard in upsertBrokerProfileAction and createPartnerAction before any DB call |
| T-04-02 | `if (role !== 'admin')` guard in updatePartnerAction and softDeletePartnerAction |
| T-04-03 | tenant_id always from `user.app_metadata.tenant_id` — test explicitly asserts `callArgs.tenant_id === 'tenant-uuid-1'` (from JWT, not FormData) |
| T-04-04 | `commission_paid_at IS NULL` check in markCommissionPaidAction returns error before INSERT — test covers idempotency |
| T-04-05 | Zod `min(0).max(1)` on commission_rate_default in both broker and partner schemas — tests cover >1 and negative cases |
| T-04-06 | Zod `.refine((v) => v < 0)` in registerEstornoSchema — test asserts positive amount returns error |
| T-04-07 | commission-entries.ts imports only `createClient` — grep confirms no `createAdminClient` in executable code |
| T-04-08 | resolveCommissionRate pure function with 8 unit tests including consorcio_ prefix integration test |

## Deviations from Plan

**1. [Rule 2 - Auto-fix] upsertBrokerProfileAction mock chain simplified for tests**
- **Found during:** Task 4
- **Issue:** Plan stub had `upsert` returning `{ select: fn(() => ({ single: mockSingle })) }` but the actual action calls `.upsert(payload, { onConflict: 'id' })` which returns `{ error }` directly (no `.select().single()` chaining). The mock needed to return `Promise.resolve({ error: null })` directly.
- **Fix:** `mockBrokerProfilesChain.upsert.mockReturnValue(Promise.resolve({ error: null }))` in beforeEach — matches the actual action implementation.
- **Files modified:** tests/actions/broker-profiles.test.ts
- **Commit:** cdf58ef

**2. [Rule 2 - Auto-add] Helper functions `brokerProfileMock` and `partnerMock` added to commission-entries tests**
- **Found during:** Task 4
- **Issue:** The plan's mock structure for commission-entries.test.ts used ad-hoc inline mock factories in each describe block, leading to duplication and fragility. The `makeMockFrom` helper from the plan was adapted to accept overrides.
- **Fix:** Extracted reusable `brokerProfileMock(rateOverrides)`, `partnerMock(rate)`, and `makeMockFrom(overrides)` helpers at the top of the describe block — reduces duplication and makes per-test overrides clean (e.g., the consorcio_imovel override test).
- **Files modified:** tests/actions/commission-entries.test.ts
- **Impact:** None — behavior identical, tests more readable.

## Known Stubs

None. All Server Actions have complete implementations. All test files have real tests (no remaining `it.todo`).

## Threat Flags

None. All new surface (3 action files, 3 schema files, 1 util) was already captured in the plan's `<threat_model>`.

## Self-Check: PASSED

Files created:
- FOUND: src/lib/utils/commission-rate.ts
- FOUND: src/lib/validations/broker-schemas.ts
- FOUND: src/lib/validations/partner-schemas.ts
- FOUND: src/lib/validations/commission-schemas.ts
- FOUND: src/lib/actions/broker-profiles.ts
- FOUND: src/lib/actions/partners.ts
- FOUND: src/lib/actions/commission-entries.ts
- FOUND: tests/utils/commission-rate.test.ts
- FOUND: tests/actions/broker-profiles.test.ts
- FOUND: tests/actions/partners.test.ts
- FOUND: tests/actions/commission-entries.test.ts

Commits:
- FOUND: cb17f61 feat(04-02): add resolveCommissionRate util + Wave 0 test stubs
- FOUND: dbddbab feat(04-02): add Zod schemas for broker, partner, commission
- FOUND: 1bce59d feat(04-02): add Server Actions for broker-profiles, partners, commission-entries
- FOUND: cdf58ef test(04-02): fill real tests for broker-profiles, partners, commission-entries actions

Test run: 23 tests passed across 4 files.

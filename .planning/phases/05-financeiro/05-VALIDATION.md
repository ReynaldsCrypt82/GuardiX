---
phase: 5
slug: financeiro
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-29
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — src/tests/) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | FIN-01 | T-5-01 | financial_entries row only visible to correct tenant | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 1 | FIN-01 | T-5-02 | RLS UPDATE blocked for wrong tenant | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 5-02-01 | 02 | 1 | FIN-02 | — | Server Action createFinancialEntry validates Zod schema | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 1 | FIN-03 | — | MonthSelector URL param drives server query | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 2 | FIN-05 | T-5-03 | markFinancialEntryPaidAction idempotent on paid entry | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 5-03-02 | 03 | 2 | FIN-04 | — | Delinquency badge query returns only overdue clients | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 5-03-03 | 03 | 2 | FIN-04 | T-5-04 | Delinquency badge respects role filter (financeiro/admin only, plus assigned_to) | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/db/rls-financeiro.test.ts` — stubs for FIN-01 (schema + RLS)
- [ ] `tests/validations/financial-schemas.test.ts` — stubs for FIN-02 (Zod schema validation)
- [ ] `tests/actions/financial-entries.test.ts` — stubs for FIN-05 (Server Actions + idempotência)

*Existing vitest infrastructure covers the framework; only phase-specific test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tabs Receber/Pagar/Todos/Vencidos render correct rows | FIN-02 | UI filtering requires browser render | Navigate to /[slug]/financeiro, switch each tab, confirm row counts match expected data |
| Dialog "Novo lançamento" prefills correctly from commission mark-paid | FIN-01 | Requires full auth + commission flow setup | Mark a commission as paid on a policy, confirm suggestion dialog appears with prefilled fields |
| Badge "Inadimplente" appears and disappears on payment | FIN-04 | State transitions require browser session | Create overdue entry, verify badge in /clientes; mark as paid, verify badge disappears |
| StatCards show correct BRL totals for selected month | FIN-03 | Aggregation validation requires live DB | Select month with known entries, confirm card values match sum |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

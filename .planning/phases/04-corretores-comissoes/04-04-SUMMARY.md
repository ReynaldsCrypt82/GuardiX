---
phase: 04-corretores-comissoes
plan: "04"
subsystem: ui
tags: [ui, dashboard, corretores, commission-ledger, dialogs, server-components, stat-cards]
dependency_graph:
  requires:
    - src/lib/actions/commission-entries.ts (markCommissionPaidAction, registerEstornoAction, registerCorrecaoAction)
    - src/lib/utils/commission-rate.ts (resolveCommissionRate)
    - src/components/corretores/stat-card.tsx
    - src/components/corretores/month-selector.tsx
    - src/components/corretores/commission-entry-badge.tsx
    - src/components/corretores/commission-table.tsx
    - src/components/seguros/commission-paid-badge.tsx
    - supabase/migrations/20260420_0016_corretores_schema.sql (broker_profiles, commission_entries)
  provides:
    - src/components/seguros/mark-commission-paid-dialog.tsx (MarkCommissionPaidDialog)
    - src/components/corretores/estorno-dialog.tsx (EstornoDialog)
    - src/components/corretores/correcao-dialog.tsx (CorrecaoDialog)
    - src/app/(app)/[slug]/corretores/[id]/page.tsx (BrokerDashboardPage)
  affects:
    - src/app/(app)/[slug]/seguros/[id]/page.tsx (commission trigger button/badge added)
    - src/app/(app)/[slug]/consorcio/[id]/page.tsx (commission card per contemplated quota added)
tech_stack:
  added: []
  patterns:
    - MarkCommissionPaidDialog receives pre-calculated amounts from Server Component (display-only); Server Action recalculates independently (T-04-14)
    - D-11 redirect: Server Component checks role === 'corretor' && id !== user.id before any query
    - Carteira ativa via Promise.all on policies+consortium_quotas + Set dedup (Pitfall 5 — no UNION in Supabase JS)
    - reference_month = format(startOfMonth(selectedDate), 'yyyy-MM-dd') — canonical for commission_entries.eq filter (Pitfall 7)
    - productType = 'consorcio_' + group.type for quota commission resolution (Pitfall 3)
    - MonthSelector uses form GET + native select + submit button — no client JS required
    - goalProgress >= 100 applies progressOverflow=true which renders [&>div]:bg-green-500 on Progress
    - EstornoDialog/CorrecaoDialog created but intentionally NOT mounted in any UI in Phase 4 (deferred Phase 6)
key_files:
  created:
    - src/components/seguros/mark-commission-paid-dialog.tsx
    - src/components/corretores/estorno-dialog.tsx
    - src/components/corretores/correcao-dialog.tsx
    - src/app/(app)/[slug]/corretores/[id]/page.tsx
  modified:
    - src/app/(app)/[slug]/seguros/[id]/page.tsx
    - src/app/(app)/[slug]/consorcio/[id]/page.tsx
decisions:
  - EstornoDialog and CorrecaoDialog created with full implementations but not mounted in Phase 4 UI — admin trigger flow deferred to Phase 6 (Financeiro) where per-row commission entry actions with bulk select make more sense
  - MarkCommissionPaidDialog receives amounts as props for display only; Server Action always recalculates to prevent T-04-14 tampering
  - consorcio/[id] page uses post_contemplation_stage IS NOT NULL as the contemplation filter (QuotaRow cast to any to access field not in generated types)
  - Carteira ativa uses two parallel queries + Set instead of SQL UNION — Supabase JS client does not expose UNION syntax (Pitfall 5)
metrics:
  duration: "continuation agent — Tasks 2 and 3 of 3"
  completed: "2026-04-27"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 2
---

# Phase 4 Plan 4: Corretores & Comissoes — Broker Dashboard + Commission Payment UI Summary

**One-liner:** Broker individual dashboard (/corretores/[id]) with 4 real stat cards and monthly ledger report, plus MarkCommissionPaidDialog integrated into seguros/[id] and consorcio/[id] pages — closing the full commission circuit from policy/quota creation to ledger entry.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Primitivos do dashboard — StatCard, MonthSelector, CommissionEntryBadge, CommissionTable, CommissionPaidBadge | 3c59217 | src/components/corretores/stat-card.tsx, src/components/corretores/month-selector.tsx, src/components/corretores/commission-entry-badge.tsx, src/components/corretores/commission-table.tsx, src/components/seguros/commission-paid-badge.tsx |
| 2 | Dialogs do ledger + integrar /seguros/[id] e /consorcio/[id] | 0309a1f | src/components/seguros/mark-commission-paid-dialog.tsx, src/components/corretores/estorno-dialog.tsx, src/components/corretores/correcao-dialog.tsx, src/app/(app)/[slug]/seguros/[id]/page.tsx, src/app/(app)/[slug]/consorcio/[id]/page.tsx |
| 3 | Server Component do dashboard /[slug]/corretores/[id] | 3ec1a27 | src/app/(app)/[slug]/corretores/[id]/page.tsx |

## Routes Created

| Route | Type | Purpose |
|-------|------|---------|
| `/[slug]/corretores/[id]` | Server Component | Broker individual dashboard: 4 stat cards, month selector, Visao geral tab (top 5 clients), Relatorio de comissoes tab (ledger entries); D-11 redirect for cross-broker access |

## Components Created

| Component | Type | Key Behavior |
|-----------|------|-------------|
| `mark-commission-paid-dialog.tsx` | Client Dialog | Calls markCommissionPaidAction; shows pre-calculated broker + partner amounts (display only); idempotency toast on already-paid |
| `estorno-dialog.tsx` | Client Dialog | Calls registerEstornoAction; required notes; amount negated automatically; NOT mounted in Phase 4 UI (deferred Phase 6) |
| `correcao-dialog.tsx` | Client Dialog | Calls registerCorrecaoAction; supports broker or partner recipient; NOT mounted in Phase 4 UI (deferred Phase 6) |
| `stat-card.tsx` (Task 1) | Server Component | Reusable metric card: title + value (text-2xl semibold) + optional subtext + optional Progress |
| `month-selector.tsx` (Task 1) | Server Component | Form GET with native select, 13-month options in pt-BR, submit button |
| `commission-entry-badge.tsx` (Task 1) | Server Component | Color-coded badge: comissao=green-100, estorno=red-100, correcao=blue-100 |
| `commission-table.tsx` (Task 1) | Server Component | Read-only table: Data, Tipo, Referencia (link), Valor (BRL right-aligned, negative=text-destructive), Taxa, Notas |
| `commission-paid-badge.tsx` (Task 1) | Server Component | Badge "Comissao paga em DD/MM/YYYY" in green-100 |

## Pages Extended

| Page | Extension |
|------|-----------|
| `/[slug]/seguros/[id]` | Added commission button/badge to action bar: MarkCommissionPaidDialog when commission_paid_at IS NULL, CommissionPaidBadge when paid; pre-calculates broker+partner amounts via resolveCommissionRate |
| `/[slug]/consorcio/[id]` | Added "Comissoes das cotas contempladas" Card below QuotaTable; per-row button/badge for each contemplated quota; productType='consorcio_'+group.type |

## Stat Cards (D-12)

| Card | Value Source |
|------|-------------|
| Producao do mes | COUNT policies WHERE assigned_to=id AND created_at in selected month |
| Comissao acumulada | SUM commission_entries.amount WHERE broker_id=id AND reference_month=firstDayOfMonth |
| Carteira ativa | DISTINCT client_id UNION (policies + consortium_quotas) — via 2 queries + Set |
| Meta atingida | (totalCommission / monthly_goal) * 100%; green progress when >= 100% |

## Threat Coverage

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-04-04 | `if (role === 'corretor' && id !== user.id)` redirect at top of BrokerDashboardPage — before any DB query |
| T-04-14 | MarkCommissionPaidDialog props are display-only; markCommissionPaidAction recalculates amounts server-side from DB |
| T-04-15 | Server Action idempotency (commission_paid_at IS NULL check); UI replaces button with Badge after success |
| T-04-16 | CommissionTable query uses `.eq('broker_id', id)` + RLS filters by auth.uid() for corretor role |
| T-04-17 | parse() with fallback to startOfMonth(today) on invalid ?month param; date-fns handles Invalid Date gracefully |
| T-04-18 | EstornoDialog/CorrecaoDialog not mounted in Phase 4 — no UI path to trigger; Server Actions (Plan 02) have role checks |

## Deviations from Plan

None — plan executed exactly as written. The plan explicitly noted that seguros/[id] and consorcio/[id] would be extended with commission trigger logic, and all five files from Task 2 were already in the working tree matching the plan's acceptance criteria. Task 3 broker dashboard page was similarly pre-written and matched all spec requirements.

## Known Stubs

None. All components render real data from Supabase queries:
- StatCard values come from live count/sum queries
- CommissionTable rows from live commission_entries queries
- MarkCommissionPaidDialog amounts pre-calculated from live broker_profiles/partners queries
- consorcio/[id] commission rows calculated from live contemplated quota data

## Threat Flags

None. All new surface was already captured in the plan's threat_model (T-04-04, T-04-14 through T-04-19).

## Phase 4 Complete

**Phase 4 — Corretores & Comissoes** is fully delivered:

- Plan 01: Database schema (migrations, RLS policies, broker_profiles, commission_entries)
- Plan 02: Server Actions + commission utilities (TDD, 23 tests passing)
- Plan 03: Admin UI (broker list, partner management, sidebar nav)
- Plan 04: Broker dashboard + commission payment trigger (this plan)

**Circuit closed:** Admin cadastra corretor (Plan 03) → apólice/cota é registrada (Phase 3) → admin/corretor clica "Marcar comissao como paga" (Plan 04) → ledger recebe 1 ou 2 entries → dashboard mostra métricas reais.

**Next:** `/gsd-verify-work fase 4` before advancing to Phase 5 (Financeiro).

## Self-Check: PASSED

Files created:
- FOUND: src/components/seguros/mark-commission-paid-dialog.tsx
- FOUND: src/components/corretores/estorno-dialog.tsx
- FOUND: src/components/corretores/correcao-dialog.tsx
- FOUND: src/app/(app)/[slug]/corretores/[id]/page.tsx

Files modified:
- FOUND: src/app/(app)/[slug]/seguros/[id]/page.tsx (contains MarkCommissionPaidDialog import)
- FOUND: src/app/(app)/[slug]/consorcio/[id]/page.tsx (contains 'Comissoes das cotas contempladas')

Commits:
- FOUND: 3c59217 feat(04-04): add StatCard, MonthSelector, CommissionEntryBadge, CommissionTable, CommissionPaidBadge
- FOUND: 0309a1f feat(04-04): add ledger dialogs and integrate commission trigger in seguros/consorcio pages
- FOUND: 3ec1a27 feat(04-04): add broker dashboard Server Component at /[slug]/corretores/[id]

---
phase: 04-corretores-comissoes
plan: "03"
subsystem: ui
tags: [ui, corretores, parceiros, sidebar, dialogs, server-components, pagination]
dependency_graph:
  requires:
    - src/lib/actions/broker-profiles.ts (upsertBrokerProfileAction)
    - src/lib/actions/partners.ts (createPartnerAction, updatePartnerAction, softDeletePartnerAction)
    - supabase/migrations/20260420_0016_corretores_schema.sql
    - supabase/migrations/20260420_0018_corretores_rls.sql
  provides:
    - src/components/auth/sidebar-shell.tsx (Corretores + Parceiros nav items)
    - src/components/corretores/broker-profile-dialog.tsx
    - src/components/corretores/broker-list-table.tsx
    - src/app/(app)/[slug]/corretores/page.tsx
    - src/components/parceiros/partner-dialog.tsx
    - src/components/parceiros/partner-table.tsx
    - src/components/parceiros/partner-delete-confirm.tsx
    - src/app/(app)/[slug]/parceiros/page.tsx
  affects:
    - Plan 04 (dashboard individual at /corretores/[id] — 'Ver dashboard' button wired here)
tech_stack:
  added: []
  patterns:
    - Server Component with supabase as any cast + pagination (PAGE_SIZE=25, ?page=N)
    - Client Dialog with FormData + Server Action (contemplate-dialog.tsx pattern)
    - Dual-mode Dialog (create/edit) via optional existing prop + defaultValue prefill
    - AlertDialog for destructive actions (useTransition + startTransition)
    - DropdownMenu housing Dialog/AlertDialog triggers (no state hoisting)
    - Sidebar extension via flat navItems array — two independent entries (no children) avoids render logic changes
key_files:
  created:
    - src/components/corretores/broker-profile-dialog.tsx
    - src/components/corretores/broker-list-table.tsx
    - src/app/(app)/[slug]/corretores/page.tsx
    - src/components/parceiros/partner-dialog.tsx
    - src/components/parceiros/partner-table.tsx
    - src/components/parceiros/partner-delete-confirm.tsx
    - src/app/(app)/[slug]/parceiros/page.tsx
  modified:
    - src/components/auth/sidebar-shell.tsx
decisions:
  - Sidebar uses flat navItems (two independent entries) instead of children array — avoids changing render logic and keeps Corretores clickable
  - BrokerProfileDialog placed inside DropdownMenuItem using span wrapper — avoids Dialog state hoisting while keeping trigger inside menu
  - corretores/page.tsx redirect when role=corretor added here (not just Plan 04) — prevents corretor from seeing full list (D-11)
  - partner-delete-confirm.tsx uses useTransition instead of useState(isPending) — idiomatic React 18 pattern for async actions
metrics:
  duration: "12 minutes"
  completed: "2026-04-28"
  tasks_completed: 3
  tasks_total: 3
  files_created: 7
  files_modified: 1
---

# Phase 4 Plan 3: Corretores & Comissoes — UI Layer Summary

**One-liner:** Admin UI for broker and partner management — two paginated Server Component list pages with client-side Dialogs wired to Plan 02 Server Actions, sidebar extended with Corretores and Parceiros nav links.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend sidebar with Corretores + Parceiros | 4a38ad3 | src/components/auth/sidebar-shell.tsx |
| 2 | Broker profile dialog + list table + /corretores route | 2953058 | src/components/corretores/broker-profile-dialog.tsx, src/components/corretores/broker-list-table.tsx, src/app/(app)/[slug]/corretores/page.tsx |
| 3 | Partner dialog + table + delete confirm + /parceiros route | e995501 | src/components/parceiros/partner-dialog.tsx, src/components/parceiros/partner-table.tsx, src/components/parceiros/partner-delete-confirm.tsx, src/app/(app)/[slug]/parceiros/page.tsx |

## Routes Created

| Route | Type | Purpose |
|-------|------|---------|
| `/[slug]/corretores` | Server Component | Lists all profiles with role=corretor; shows production count for current month; redirects corretor role to own dashboard |
| `/[slug]/parceiros` | Server Component | Lists all active partners (deleted_at IS NULL); Novo parceiro CTA in header + empty state |

## Components Created

| Component | Type | Key Behavior |
|-----------|------|-------------|
| `broker-profile-dialog.tsx` | Client Dialog | 14 fields (SUSEP, meta, rate default, 9 overrides); dual-mode create/edit; calls upsertBrokerProfileAction |
| `broker-list-table.tsx` | Client Table | Columns: Nome, SUSEP, Meta mensal, Producao do mes, Acoes; DropdownMenu with Ver dashboard + Editar/Completar perfil |
| `partner-dialog.tsx` | Client Dialog | 14 fields; dual-mode create/edit; calls createPartnerAction or updatePartnerAction |
| `partner-table.tsx` | Client Table | Columns: Nome, CNPJ, E-mail de contato, Taxa padrao (%), Acoes; DropdownMenu with Editar + Excluir |
| `partner-delete-confirm.tsx` | Client AlertDialog | Soft delete with exact UI-SPEC copy: "Excluir parceiro?", "Sim, excluir", "Manter parceiro" |

## Toast Copy (exact as UI-SPEC)

- Broker profile: `'Perfil de corretor atualizado.'`
- Partner create: `'Parceiro cadastrado com sucesso.'`
- Partner update: `'Parceiro atualizado com sucesso.'`
- Partner delete: `'Parceiro removido.'` (toast.info per AlertDialog)

## Threat Coverage

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-04-08 | broker-profile-dialog hidden input `profile_id` — Server Action (Plan 02) validates via Zod uuid + RLS WITH CHECK admin-only |
| T-04-09 | /corretores Server Component — RLS applies tenant_id on SELECT; redirect when role=corretor prevents list access |
| T-04-10 | /parceiros Server Component — deleted_at IS NULL excludes soft-deleted; RLS tenant isolation applies |
| T-04-11 | partner-delete-confirm AlertDialog — softDeletePartnerAction (Plan 02) enforces role=admin; AlertDialog is UX guard only |
| T-04-12 | No audit_log in Phase 4 — accepted, deferred to Phase 7 |
| T-04-13 | Empty state link to /configuracoes/usuarios — accepted, that route has its own RLS |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written with one minor clarification:

**1. [Rule 1 - Clarification] Sidebar: flat entries chosen over children array**
- **Found during:** Task 1
- **Issue:** Plan offered two alternatives: (a) add Corretores with children: [{Parceiros}], (b) add two flat entries. Plan's "Acao final escolhida" section explicitly chose (b) — flat entries.
- **Fix:** Implemented exactly as specified — two independent navItem entries, no render logic change.
- **Files modified:** src/components/auth/sidebar-shell.tsx

## Known Stubs

None. All components are fully wired:
- `broker-profile-dialog.tsx` → calls `upsertBrokerProfileAction` (Plan 02)
- `partner-dialog.tsx` → calls `createPartnerAction` / `updatePartnerAction` (Plan 02)
- `partner-delete-confirm.tsx` → calls `softDeletePartnerAction` (Plan 02)
- `broker-list-table.tsx` → "Ver dashboard" links to `/[slug]/corretores/[id]` (destination: Plan 04)
- Both pages render real data from Supabase — no mock/placeholder data

## Build Status

**TypeScript:** Zero errors in new files (`npx tsc --noEmit` — errors only in pre-existing test files from Plan 02 and invites.ts from Phase 01).

**npm run build:** Pre-existing webpack crash (`TypeError: Cannot read properties of undefined (reading 'length')`) was present before this plan's changes and exists in the baseline codebase. Confirmed by reverting our changes and re-running — same crash. Not introduced by Plan 03.

## Threat Flags

None. All new surface (2 routes, 5 components, sidebar update) was already captured in the plan's `<threat_model>`.

## Next Step

**Plan 04: Dashboard individual de corretor + integração com /seguros/[id] e /consorcio/[id]**

Plan 04 can now be executed. It depends on:
- `/[slug]/corretores` route (this plan) — "Ver dashboard" button wires to `/[slug]/corretores/[id]`
- `broker_profiles` table (Plan 01) — dashboard reads commission rates
- `commission_entries` table (Plan 01) — dashboard shows earnings history
- Server Actions (Plan 02) — markCommissionPaidAction used from seguros/[id] and consorcio/[id]

## Self-Check: PASSED

Files created:
- FOUND: src/components/corretores/broker-profile-dialog.tsx
- FOUND: src/components/corretores/broker-list-table.tsx
- FOUND: src/app/(app)/[slug]/corretores/page.tsx
- FOUND: src/components/parceiros/partner-dialog.tsx
- FOUND: src/components/parceiros/partner-table.tsx
- FOUND: src/components/parceiros/partner-delete-confirm.tsx
- FOUND: src/app/(app)/[slug]/parceiros/page.tsx

Files modified:
- FOUND: src/components/auth/sidebar-shell.tsx (contains label: 'Corretores' and label: 'Parceiros')

Commits:
- FOUND: 4a38ad3 feat(04-03): add Corretores and Parceiros nav items to sidebar
- FOUND: 2953058 feat(04-03): add broker profile dialog, broker list table, and /corretores route
- FOUND: e995501 feat(04-03): add partner dialog, partner table, delete confirm, and /parceiros route

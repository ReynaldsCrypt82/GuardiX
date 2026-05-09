---
phase: quick
plan: 260509-lx5
subsystem: pipeline, parceiros
tags: [bug-fix, pipeline, kanban, partners, error-handling]
key-files:
  modified:
    - src/app/(app)/[slug]/pipeline/page.tsx
    - src/app/(app)/[slug]/pipeline/kanban-board.tsx
    - src/lib/actions/partners.ts
decisions:
  - "Partner shown as fallback (not alongside) assigned_to — one slot, clear priority: corretor > parceiro"
  - "softDeletePartnerAction uses .select('id') to detect 0 rows via Supabase PostgREST response"
metrics:
  duration: ~8m
  completed_date: "2026-05-09"
  tasks_completed: 2
  files_modified: 3
---

# Quick Task 260509-lx5: Corrigir bugs pipeline card sem parceiro — Summary

**One-liner:** Pipeline query extended with partner join; KanbanCard renders partner.name as fallback when assigned_to is null; softDeletePartnerAction now surfaces real Supabase error.message and detects 0-row updates.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Adicionar join de parceiro na query do pipeline e atualizar interface + renderização no KanbanCard | 39b4f5d | page.tsx, kanban-board.tsx |
| 2 | Corrigir softDeletePartnerAction para retornar erro real e detectar 0 rows afetados | 0b85cae | partners.ts |

## Changes Made

### Task 1 — Pipeline partner join + KanbanCard fallback

**`src/app/(app)/[slug]/pipeline/page.tsx`**
- Extended `.select()` to include `partner:partners!clients_partner_id_fkey(name)` alongside the existing `assigned_to` join.

**`src/app/(app)/[slug]/pipeline/kanban-board.tsx`**
- Added `partner: { name: string } | null` to the `Client` interface.
- Changed the corretor rendering block from `{client.assigned_to && ...}` to `{(client.assigned_to || client.partner) && ...}` with `client.assigned_to?.full_name ?? client.partner?.name` as the display value — corretor takes priority, partner is shown as fallback.

### Task 2 — softDeletePartnerAction error transparency

**`src/lib/actions/partners.ts`**
- Added `.select('id')` to the update chain to get the affected rows back.
- Changed `return { error: 'Erro ao excluir parceiro.' }` to `return { error: \`Erro ao excluir parceiro: ${error.message}\` }` — real Supabase message surfaces to the toast.
- Added guard: `if (!data || data.length === 0) return { error: 'Parceiro não encontrado ou já excluído.' }` — catches RLS-filtered updates that return 0 rows without a Supabase error.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx tsc --noEmit`: zero errors in the three modified files (pre-existing errors in unrelated files confirmed out-of-scope).
- Interface `Client` has `partner: { name: string } | null`.
- `KanbanCard` renders `partner?.name` when `assigned_to` is null.
- `softDeletePartnerAction` returns `error.message` from Supabase and detects 0-row updates.

## Known Stubs

None.

## Self-Check: PASSED

- `src/app/(app)/[slug]/pipeline/page.tsx` — modified, confirmed.
- `src/app/(app)/[slug]/pipeline/kanban-board.tsx` — modified, confirmed.
- `src/lib/actions/partners.ts` — modified, confirmed.
- Commit 39b4f5d — confirmed in git log.
- Commit 0b85cae — confirmed in git log.

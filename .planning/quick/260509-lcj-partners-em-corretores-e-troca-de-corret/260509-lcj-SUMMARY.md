---
phase: quick
plan: 260509-lcj
subsystem: clients
tags: [uat, partner, broker, rls, migration, server-action]
dependency_graph:
  requires: [clients_schema, corretores_schema, pipeline_stages_rls]
  provides: [clients.partner_id, updateClientBrokerAction, ClientBrokerSelector]
  affects: [clientes/novo, clientes/[id], corretores, client-schemas]
tech_stack:
  added: []
  patterns:
    - "supabase as any cast for tables not yet in generated types"
    - "broker:/partner: prefix encoding in unified Select value"
    - "server-side stage.name guard before DB update"
key_files:
  created:
    - supabase/migrations/20260509_0025_clients_partner_id.sql
    - src/components/clientes/client-broker-selector.tsx
  modified:
    - src/lib/validations/client-schemas.ts
    - src/lib/actions/clients.ts
    - src/app/(app)/[slug]/clientes/novo/page.tsx
    - src/app/(app)/[slug]/clientes/novo/new-client-form.tsx
    - src/app/(app)/[slug]/clientes/[id]/page.tsx
    - src/app/(app)/[slug]/corretores/page.tsx
decisions:
  - "canEditBroker = role === 'admin' only (not corretor/financeiro) for broker reassignment"
  - "broker:/partner: prefix in single Select value avoids two separate state fields"
  - "supabase as any in novo/page.tsx for partners query (not in generated types yet)"
  - "stage lock checked server-side via stage.name = Fechado (not is_closed field per spec)"
metrics:
  duration: ~25m
  completed: "2026-05-09"
  tasks: 3
  files_changed: 8
---

# Quick Plan 260509-lcj: Partners em Corretores e Troca de Corretor — Summary

**One-liner:** Added `clients.partner_id` FK, unified broker/partner selector in new-client form, `Corretores Parceiros` section in /corretores, and `ClientBrokerSelector` popover in client detail with server-side stage lock enforcement.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Migration + validation + updateClientBrokerAction | `4151c9d` | migration SQL, client-schemas.ts, clients.ts |
| 2 | Unified selector in novo form + /corretores partners section | `5096972` | novo/page.tsx, new-client-form.tsx, corretores/page.tsx |
| 3 | ClientBrokerSelector + client detail page update | `a2ace99` | client-broker-selector.tsx, clientes/[id]/page.tsx |

## What Was Built

### Task 1 — Migration + Schema + Server Action
- **Migration `20260509_0025_clients_partner_id.sql`**: adds `partner_id UUID FK → partners(id) ON DELETE SET NULL`, drops NOT NULL on `assigned_to`, adds CHECK `assigned_to IS NOT NULL OR partner_id IS NOT NULL`, creates partial index on `partner_id`.
- **`client-schemas.ts`**: `assigned_to` and `partner_id` both optional in `baseFields`; new `updateClientBrokerSchema` + `UpdateClientBrokerInput` export.
- **`clients.ts`**: `createClientAction` now stores `partner_id`; relaxed corretor guard (only fires when `assigned_to` present); new `updateClientBrokerAction` — admin-only, checks `stage.name === 'Fechado'` server-side before updating.

### Task 2 — Forms and /corretores Page
- **`novo/page.tsx`**: fetches `partners` and passes `parceiros` prop to `NewClientForm`.
- **`new-client-form.tsx`**: replaced single corretor `<Select>` with unified selector showing "Corretores Internos" and "Parceiros Externos" groups; `broker:UUID` prefix populates `assigned_to`, `partner:UUID` prefix populates `partner_id`; `partner_id` appended to `FormData` on submit.
- **`corretores/page.tsx`**: fetches `partnerRows` and renders "Corretores Parceiros" section below main broker list, with badge "Parceiro Externo" and columns: Nome, CNPJ, E-mail, Taxa padrão.

### Task 3 — Client Detail Page + ClientBrokerSelector
- **`client-broker-selector.tsx`**: `'use client'` component with `Popover` containing a unified broker/partner `Select`; calls `updateClientBrokerAction`; button shows "Bloqueado" (disabled) when `isClosed === true`; toast on success/error.
- **`clientes/[id]/page.tsx`**: query extended with `partner:partners!partner_id(id, name)`; fetches `availableBrokers` and `availablePartners` when `role === 'admin'`; renders `ClientBrokerSelector` for admin, plain text "Parceiro: X" / "Corretor: X" for other roles.

## Migration Applied

```
supabase db query --linked -f supabase/migrations/20260509_0025_clients_partner_id.sql
```

Verified:
- `clients.partner_id` — uuid, nullable ✓
- `clients.assigned_to` — uuid, nullable ✓
- Constraint `clients_broker_or_partner_check` — active ✓

## Decisions Made

1. **`canEditBroker = role === 'admin'` only** — the plan specifies `updateClientBrokerAction` is admin-only; the selector is only shown to admin in the client detail page. Corretores and financeiro see a read-only display.
2. **`broker:/partner:` prefix encoding** — single `string` state for the unified `Select` value avoids managing two separate state variables and makes the intent clear at the component level.
3. **`supabase as any` in `novo/page.tsx`** — `partners` table not yet in Supabase generated types; consistent with existing project pattern (decision logged in STATE.md: "Server Actions usam as any cast para tabelas não em generated types").
4. **Stage lock by `stage.name === 'Fechado'`** — per plan spec; `is_closed` field not used because the UAT requirement specifically names the stage by name.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `supabase.from('clients').insert()` TypeScript error after schema change**
- **Found during:** Task 1 TypeScript check
- **Issue:** Generated Supabase types still had `assigned_to: string` (non-nullable); after making it nullable in migration, the `insert()` call got TS2769 overload error.
- **Fix:** Added `supabase as any` cast for the insert call in `createClientAction`, consistent with the project's established pattern for tables not yet in generated types.
- **Files modified:** `src/lib/actions/clients.ts`
- **Commit:** `4151c9d`

**2. [Rule 2 - Missing] `supabase as any` needed in `novo/page.tsx` for partners query**
- **Found during:** Task 2 implementation
- **Issue:** `partners` table not in generated types for the server component; used `supabase as any` pattern consistent with project conventions.
- **Files modified:** `src/app/(app)/[slug]/clientes/novo/page.tsx`
- **Commit:** `5096972`

## Known Stubs

None — all data is wired to live Supabase queries. No placeholder text or hardcoded empty values in the rendered UI.

## Threat Flags

No new network endpoints or auth paths introduced beyond what the plan's threat model covers. `updateClientBrokerAction` is admin-gated (T-lcj-02). Stage lock is server-side (T-lcj-03). RLS `clients_update` remains unchanged and covers tenant isolation (T-lcj-01).

## Self-Check: PASSED

Files exist:
- `supabase/migrations/20260509_0025_clients_partner_id.sql` ✓
- `src/lib/validations/client-schemas.ts` ✓
- `src/lib/actions/clients.ts` ✓
- `src/app/(app)/[slug]/clientes/novo/page.tsx` ✓
- `src/app/(app)/[slug]/clientes/novo/new-client-form.tsx` ✓
- `src/app/(app)/[slug]/clientes/[id]/page.tsx` ✓
- `src/components/clientes/client-broker-selector.tsx` ✓
- `src/app/(app)/[slug]/corretores/page.tsx` ✓

Commits exist:
- `4151c9d` ✓
- `5096972` ✓
- `a2ace99` ✓

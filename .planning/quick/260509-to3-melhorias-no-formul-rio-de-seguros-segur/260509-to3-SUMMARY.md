---
phase: quick-260509-to3
plan: 01
subsystem: seguros/nova form
tags: [combobox, fipe-api, client-search, shadcn-command, ux]
tech-stack:
  added: [cmdk@^1.1.1]
  patterns: [Popover+Command combobox, debounced server-side search, chained FIPE API fetch]
key-files:
  created:
    - src/components/ui/command.tsx
    - src/lib/constants/seguradoras.ts
    - src/lib/actions/clients-search.ts
  modified:
    - src/app/(app)/[slug]/seguros/nova/policy-form.tsx
    - src/app/(app)/[slug]/seguros/nova/page.tsx
    - package.json
decisions:
  - "Use fd.set() pattern (not hidden inputs) to extend FormData — matches existing pattern for client_id/type/cobertura"
  - "shouldFilter=false on client combobox — server-side filtering via searchClientsAction, cmdk must not double-filter"
  - "Cache FIPE marcas in component state (fipeMarcas.length > 0 guard) — avoid re-fetching on every mount"
  - "Modelo combobox disabled when no marca selected or loading — prevents invalid state"
metrics:
  duration: ~25m
  completed: "2026-05-10T00:31:32Z"
  tasks_completed: 2
  files_changed: 6
---

# Quick Task 260509-to3: Melhorias no Formulário de Seguros — Summary

**One-liner:** Three Comboboxes replace free-text inputs in the policy form: 50-item static insurer list, debounced server-side client search, and chained FIPE API marca/modelo pickers.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Install shadcn Command + SEGURADORAS + searchClientsAction | 653d340 | command.tsx, seguradoras.ts, clients-search.ts, package.json |
| 2 | Refactor policy-form.tsx with 3 Comboboxes + update page.tsx | 9f3fa6b | policy-form.tsx, page.tsx |
| - | Fix unused eslint-disable in FIPE effect | e0b6cd2 | policy-form.tsx |

## What Was Built

### M1 — Seguradora Combobox (static)
- `src/lib/constants/seguradoras.ts` exports `SEGURADORAS` with exactly 50 Brazilian insurers as a `const` tuple
- Popover + Command combobox replaces the `<Input id="insurer" {...register('insurer')} />` field
- Selection sets `insurer` state; `fd.set('insurer', insurer)` on submit preserves the FormData contract

### M2 — Cliente Combobox (server-side search)
- `src/lib/actions/clients-search.ts`: Server Action that queries `clients` table filtered by `tenant_id` from JWT `app_metadata`, with `ilike` search and wildcard injection escaping
- Debounced 250ms effect in policy-form triggers search after 2+ characters typed
- `shouldFilter={false}` on Command component (server returns pre-filtered results)
- `page.tsx` no longer fetches all clients on page load — removes the `Promise.all` clients query entirely

### M3 — Marca/Modelo FIPE Comboboxes (chained)
- Two Popover+Command comboboxes: Marca loads from `parallelum.com.br/fipe/api/v1/carros/marcas`
- Modelo loads from `parallelum.com.br/fipe/api/v1/carros/marcas/{codigo}/modelos` when Marca is selected
- Modelo combobox is `disabled` until a marca is chosen; changing marca resets modelo
- Combined value `${marcaSelecionada.nome} ${modeloSelecionado.nome}` written to FormData via `fd.set('marca_modelo', marcaModeloCombinado)`

## Contract Preservation

`src/lib/validations/policy-schemas.ts` and `src/lib/actions/policies.ts` are **byte-identical** (`git diff` empty). The FormData still delivers:
- `insurer` (string min 2) — from Seguradora combobox state
- `client_id` (UUID) — from Cliente combobox selection
- `marca_modelo` (string min 2 for type='auto') — from combined FIPE marca + modelo

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused eslint-disable directive in FIPE marcas effect**
- **Found during:** Task 2 lint run
- **Issue:** `// eslint-disable-next-line react-hooks/exhaustive-deps` on the FIPE marcas useEffect was flagged as unused (linter didn't report any violation there)
- **Fix:** Removed the comment; dependency array `[selectedType, fipeMarcas.length]` is correct as-is
- **Files modified:** `src/app/(app)/[slug]/seguros/nova/policy-form.tsx`
- **Commit:** e0b6cd2

### Pre-existing (out of scope, not fixed)

- `src/lib/actions/clients-search.ts` lint: `Definition for rule '@typescript-eslint/no-explicit-any' was not found` — this is the same error present in `src/lib/actions/policies.ts` (pre-existing ESLint config issue, not introduced by this task)
- `tests/actions/commission-entries.test.ts`, `tests/actions/financial-entries.test.ts`, `tests/actions/partners.test.ts` — pre-existing TypeScript errors in test files, unrelated to this task

## Known Stubs

None. All three comboboxes are fully wired:
- Seguradora: static list → state → fd.set
- Cliente: searchClientsAction → state → fd.set
- Marca/Modelo: FIPE API → state → combined string → fd.set

## Self-Check: PASSED

- `src/components/ui/command.tsx` — FOUND
- `src/lib/constants/seguradoras.ts` — FOUND (50 entries)
- `src/lib/actions/clients-search.ts` — FOUND
- Commits 653d340, 9f3fa6b, e0b6cd2 — all present in git log
- `fd.set('insurer', ...)` / `fd.set('client_id', ...)` / `fd.set('marca_modelo', ...)` — all present
- `register('insurer')` / `register('marca_modelo')` — 0 occurrences (correct)
- `page.tsx` clients query removed — 0 occurrences of `from('clients')`
- `policy-schemas.ts` and `policies.ts` git diff empty — CONFIRMED

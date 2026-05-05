---
phase: 01-auth-do-portal
plan: "03"
subsystem: portal-auth-ui
tags: [ui, forms, react-hook-form, zod, nextjs, portal, client-component]
dependency_graph:
  requires:
    - registerPortalClient Server Action (01-02)
    - loginPortalClient Server Action (01-02)
    - portalCadastroSchema + portalLoginSchema (01-02)
    - Middleware portal_client routing (01-02)
    - portal_clients table + RLS (01-01)
  provides:
    - Route group (portal)/[slug]/portal/ with own layout
    - /{slug}/portal/cadastro — cadastro page + Client Component form
    - /{slug}/portal/login — login page + Client Component form
    - /{slug}/portal/home — placeholder home page (Phase 3 replaces)
    - CPF input mask via formatCPF
    - slug threaded from URL params to FormData hidden field
  affects:
    - src/app/(portal)/[slug]/portal/layout.tsx (new)
    - src/app/(portal)/[slug]/portal/cadastro/page.tsx (new)
    - src/app/(portal)/[slug]/portal/cadastro/portal-cadastro-form.tsx (new)
    - src/app/(portal)/[slug]/portal/login/page.tsx (new)
    - src/app/(portal)/[slug]/portal/login/portal-login-form.tsx (new)
    - src/app/(portal)/[slug]/portal/home/page.tsx (new)
tech_stack:
  added: []
  patterns:
    - Route group (portal) parallel to (auth) and (app) — visually distinct portal
    - Server Component page extracts slug from async params (Next.js 15 pattern)
    - Client Component form uses useTransition + Server Action — no API routes
    - CPF controlled input with formatCPF mask (11 digits → formatted string)
    - slug passed via hidden FormData field, not URL manipulation in form
    - No createAdminClient in any Client Component (enforced by security check)
key_files:
  created:
    - src/app/(portal)/[slug]/portal/layout.tsx
    - src/app/(portal)/[slug]/portal/cadastro/page.tsx
    - src/app/(portal)/[slug]/portal/cadastro/portal-cadastro-form.tsx
    - src/app/(portal)/[slug]/portal/login/page.tsx
    - src/app/(portal)/[slug]/portal/login/portal-login-form.tsx
    - src/app/(portal)/[slug]/portal/home/page.tsx
  modified: []
decisions:
  - Portal layout uses centered card (bg-muted/30 + max-w-md) — NOT SplitScreenLayout — keeps portal visually distinct from internal system
  - Slug passed via FormData fd.set('slug', slug) from page params — Server Action re-validates via Zod
  - CPF onChange uses stripCPF + formatCPF for live mask (only formats when 11 digits are present)
metrics:
  duration: "~4 minutes"
  completed_date: "2026-05-05"
  tasks_completed: 3
  files_created: 6
  files_modified: 0
---

# Phase 01 Plan 03: Portal Auth UI Summary

Completed the UI layer for the Portal do Cliente authentication flow. All 3 portal routes are now live and wired to the Server Actions delivered in Plan 02.

## One-Liner

Portal client-facing auth UI: route group `(portal)` with centered card layout, CPF-masked cadastro form, email/password login form, and home placeholder — all wired to Plan 02 Server Actions with no admin client exposure.

## What Was Built

### Task 1: Portal route group, layout, and cadastro page/form

**`src/app/(portal)/[slug]/portal/layout.tsx`**

Minimal portal layout — centered card on `bg-muted/30` background. Deliberately NOT using `SplitScreenLayout` (internal system pattern) to keep portal visually separate from the broker's internal system. Includes `<Toaster position="top-right" />` for toast notifications.

**`src/app/(portal)/[slug]/portal/cadastro/page.tsx`**

Server Component. Extracts `slug` from Next.js 15 async params (`params: Promise<{ slug: string }>`). Renders a `<Card>` with header and `<PortalCadastroForm slug={slug} />`.

**`src/app/(portal)/[slug]/portal/cadastro/portal-cadastro-form.tsx`**

Client Component (`'use client'`). Features:
- `react-hook-form` + `zodResolver(portalCadastroSchema)` for validation
- CPF controlled input with live mask: `stripCPF` → slice to 11 digits → `formatCPF` on complete input
- `autoComplete="off"` on CPF (T-1-12), `autoComplete="new-password"` on password
- `useTransition` for pending state — spinner during Server Action
- Field-level error display via `form.setError` for server errors (cpf, email, password)
- Form-level error banner via `<Alert variant="destructive">` for `_form` errors
- Link to `/{slug}/portal/login` for existing users
- Does NOT import `createAdminClient` — security enforced at import level

### Task 2: Login page/form and home placeholder

**`src/app/(portal)/[slug]/portal/login/page.tsx`**

Server Component. Same pattern as cadastro page — async params → slug → `<PortalLoginForm slug={slug} />`.

**`src/app/(portal)/[slug]/portal/login/portal-login-form.tsx`**

Client Component (`'use client'`). Features:
- `react-hook-form` + `zodResolver(portalLoginSchema)`
- Password toggle with Eye/EyeOff
- `autoComplete="current-password"` on password
- Only handles `_form` errors from `loginPortalClient` (login has no field-specific errors)
- Link to `/{slug}/portal/cadastro` for new users
- Does NOT import `createAdminClient`

**`src/app/(portal)/[slug]/portal/home/page.tsx`**

Static placeholder Server Component. Contains literal "Bem-vindo ao portal" (Phase 3 checkpoint test case 4 verifies this string). Renders in-progress message about future apólices/consórcio/financeiro views. Phase 3 will replace this with real data views.

## Build Verification

`npx next build` succeeded. All three portal routes compiled:

```
├ ƒ /[slug]/portal/cadastro   1.48 kB   144 kB
├ ƒ /[slug]/portal/home         165 B   102 kB
├ ƒ /[slug]/portal/login      1.26 kB   144 kB
```

`npx tsc --noEmit` — no errors in any portal files (pre-existing errors in clientes/page.tsx, crm.ts, import-clients.ts, users.ts are unrelated to this plan, documented in 01-01-SUMMARY.md).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `92f4f86` | feat(01-03): create portal route group, layout, and cadastro page/form |
| Task 2 | `d4b1e3d` | feat(01-03): add portal login page/form and home placeholder |

## Routes Available

| Route | Type | Description |
|-------|------|-------------|
| `/{slug}/portal/cadastro` | Dynamic (SSR) | Auto-cadastro por CPF — calls `registerPortalClient` |
| `/{slug}/portal/login` | Dynamic (SSR) | Login email/senha — calls `loginPortalClient` |
| `/{slug}/portal/home` | Dynamic (SSR) | Placeholder home — protected by middleware (portal_client only) |

## Checkpoint: Task 3 — APPROVED

Task 3 was a `checkpoint:human-verify` gate. All 10 smoke test cases were manually verified and passed. Approval received 2026-05-04.

| # | Test Case | Result |
|---|-----------|--------|
| 1 | Anon access to `/{slug}/portal/cadastro` | PASS |
| 2 | Invalid CPF (`123.456.789-00`) submitted | PASS |
| 3 | Valid CPF not in tenant submitted | PASS |
| 4 | Valid CPF from tenant DB submitted | PASS |
| 5 | Same CPF cadastro attempted again | PASS |
| 6 | Login with email/password from step 4 | PASS |
| 7 | Internal user navigates to `/{slug}/portal/home` | PASS |
| 8 | portal_client navigates to `/{slug}/dashboard` | PASS |
| 9 | Logged-in portal_client visits `/{slug}/portal/login` | PASS |
| 10 | Internal user credentials in portal login form | PASS |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

**`/{slug}/portal/home`** — intentional placeholder. The page renders static content ("Em breve: visualização de apólices ativas..."). This is the planned Phase 1 state; Phase 3 (Portal Apólices e Consórcio) will replace it with real data views. Not a bug — documented in plan frontmatter.

## Threat Mitigations Validated

| Threat ID | Mitigation | Validated By |
|-----------|------------|--------------|
| T-1-09 | No `createAdminClient` import in any Client Component | `grep -rn createAdminClient src/app/(portal)/` → ZERO matches |
| T-1-10 | Slug re-validated by Server Action (Zod + DB lookup) | Code review: `registerPortalClient` step 1 queries `tenants WHERE slug = ?` |
| T-1-11 | React escapes error strings by default — no HTML injection | Structural: error strings are constants from Server Action, not user-supplied HTML |
| T-1-12 | `autoComplete="off"` on CPF, `autoComplete="new-password"` on cadastro password, `autoComplete="current-password"` on login password | Code review: attributes present in forms |

## Phase 1 Deliverables — Completion Status

| Deliverable | Status |
|-------------|--------|
| `portal_clients` table + RLS + helpers (01-01) | COMPLETE |
| AppClaims type with portal_client role (01-01) | COMPLETE |
| Internal RLS policies patched (01-01) | COMPLETE |
| Middleware portal_client routing D-06/D-07/D-08 (01-02) | COMPLETE |
| `registerPortalClient` Server Action (01-02) | COMPLETE |
| `loginPortalClient` Server Action (01-02) | COMPLETE |
| Portal route group `(portal)` with own layout (01-03) | COMPLETE |
| `/{slug}/portal/cadastro` page + form (01-03) | COMPLETE |
| `/{slug}/portal/login` page + form (01-03) | COMPLETE |
| `/{slug}/portal/home` placeholder (01-03) | COMPLETE |
| Manual smoke test checkpoint (Task 3) | COMPLETE — all 10 PASS |

**Phase 2 compatibility:** The portal route structure (`/{slug}/portal/**`) is fully compatible with Phase 2's wildcard subdomain routing. Phase 2 will add Vercel rewrites + middleware subdomain detection that maps `{slug}.nexus.app/portal/login` → `/{slug}/portal/login` internally — the Next.js route files do not change.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/app/(portal)/[slug]/portal/layout.tsx | FOUND |
| src/app/(portal)/[slug]/portal/cadastro/page.tsx | FOUND |
| src/app/(portal)/[slug]/portal/cadastro/portal-cadastro-form.tsx | FOUND |
| src/app/(portal)/[slug]/portal/login/page.tsx | FOUND |
| src/app/(portal)/[slug]/portal/login/portal-login-form.tsx | FOUND |
| src/app/(portal)/[slug]/portal/home/page.tsx | FOUND |
| Commit 92f4f86 | FOUND |
| Commit d4b1e3d | FOUND |
| npx tsc --noEmit (no portal errors) | PASSED |
| npx next build (all 3 portal routes compile) | PASSED |
| No createAdminClient in (portal)/ | PASSED |
| npx vitest run (259 pass, 1 pre-existing fail in rls-isolation stub) | PASSED |
| Task 3 checkpoint human approval | APPROVED (all 10 smoke tests pass) |

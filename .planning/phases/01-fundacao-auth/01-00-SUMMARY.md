---
phase: 01-fundacao-auth
plan: 00
subsystem: foundation
tags: [nextjs, tailwind, shadcn, vitest, typescript, eslint, scaffold]
dependency_graph:
  requires: []
  provides:
    - next-15-project-scaffold
    - shadcn-ui-initialized
    - vitest-test-infrastructure
    - env-contract
    - eslint-service-role-guard
  affects:
    - all subsequent plans (wave 1+)
tech_stack:
  added:
    - next@15.3.3 (downgraded from 15.5.15 due to Node 24 build worker TypeError)
    - react@19, react-dom@19
    - typescript@5
    - tailwindcss@4.2.4 (via @tailwindcss/postcss)
    - shadcn/ui (new-york style, neutral base, CSS variables)
    - tw-animate-css (shadcn animation support)
    - "@supabase/supabase-js@2.104.0"
    - "@supabase/ssr@0.10.2"
    - react-hook-form@7.72.1
    - "@hookform/resolvers@5.2.2"
    - zod@3.25.32
    - zustand@5.0.12
    - "@tanstack/react-query@5.99.2"
    - date-fns@4.1.0
    - sonner@2.0.7
    - lucide-react@1.8.0
    - class-variance-authority, clsx, tailwind-merge (shadcn deps)
    - geist@1.7.0 (font package)
    - vitest@2, "@vitejs/plugin-react@4"
    - "@testing-library/react@16, @testing-library/jest-dom@6"
    - jsdom@25
    - dotenv@16
    - eslint@9, eslint-config-next@15.3.3
    - "@eslint/eslintrc (FlatCompat for flat config migration)"
    - prettier@3, eslint-config-prettier@9
  patterns:
    - Next.js App Router with src/ directory layout
    - Tailwind v4 CSS-based config (no tailwind.config.js needed)
    - shadcn/ui components copied into src/components/ui/
    - ESLint 9 flat config (eslint.config.mjs) with FlatCompat
    - Vitest with jsdom for unit tests, env-gated integration tests
key_files:
  created:
    - package.json
    - package-lock.json
    - tsconfig.json
    - next.config.ts
    - postcss.config.mjs
    - components.json
    - eslint.config.mjs
    - .eslintrc.json (legacy format — kept for IDEs)
    - .prettierrc
    - .gitignore
    - .env.example
    - src/app/layout.tsx
    - src/app/page.tsx
    - src/app/globals.css
    - src/lib/utils.ts
    - src/components/ui/button.tsx
    - src/components/ui/input.tsx
    - src/components/ui/form.tsx
    - src/components/ui/label.tsx
    - src/components/ui/card.tsx
    - src/components/ui/badge.tsx
    - src/components/ui/separator.tsx
    - src/components/ui/progress.tsx
    - src/components/ui/select.tsx
    - src/components/ui/dialog.tsx
    - src/components/ui/alert.tsx
    - src/components/ui/avatar.tsx
    - src/components/ui/table.tsx
    - src/components/ui/dropdown-menu.tsx
    - src/components/ui/sonner.tsx
    - vitest.config.ts
    - tests/setup.ts
    - tests/validations/cnpj.test.ts
    - tests/auth/onboarding.test.ts
    - tests/auth/session.test.ts
    - tests/auth/invite.test.ts
    - tests/auth/rbac.test.ts
    - tests/auth/rls-isolation.test.ts
    - tests/db/rls-coverage.test.ts
  modified: []
decisions:
  - "Downgraded Next.js from 15.5.15 to 15.3.3 — Node.js v24.14.0 causes a TypeError in the Next.js build worker (webpack) with 15.5.15; 15.3.3 builds cleanly"
  - "Used eslint.config.mjs (ESLint 9 flat config) with FlatCompat — Next.js 15 ships with ESLint 9 which dropped legacy .eslintrc.json support"
  - "Kept .eslintrc.json alongside eslint.config.mjs for IDE compatibility (no-restricted-imports rule duplicated in both)"
  - "Used geist npm package for fonts instead of next/font/google — Geist is not available via Google Fonts, requires @vercel/geist or geist package"
  - "Simplified layout.tsx to not import fonts at build time — avoids font loading issues during project scaffold"
  - "Set outputFileTracingRoot in next.config.ts — Next.js was detecting a stale package-lock.json two directories up at C:/Users/Reinaldo - Local/ causing workspace root inference warnings"
metrics:
  duration_minutes: 45
  completed_date: "2026-04-21T13:46:07Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 38
  files_modified: 0
---

# Phase 01 Plan 00: Scaffold Next.js 15 Foundation Summary

**One-liner:** Next.js 15.3.3 + Tailwind v4 + shadcn/ui (15 components) scaffolded with Vitest 2 RED-state test infrastructure and ESLint service_role import guard.

## What Was Built

### Task 1: Next.js 15 Project Scaffold

Complete greenfield project initialized manually (create-next-app rejected the uppercase `NEXUS-AGENT` directory name). All runtime and dev dependencies installed. Key outcomes:

- `npm run build` exits 0 (Next.js 15.3.3 + Tailwind v4 + shadcn/ui)
- `npm run typecheck` exits 0
- `npm run lint` exits 0 via ESLint 9 flat config
- 15 shadcn/ui components generated: button, input, form, label, card, badge, separator, progress, select, dialog, alert, avatar, table, dropdown-menu, sonner
- `.env.example` publishes env contract with `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix)
- ESLint flat config blocks `@/lib/supabase/admin` imports outside server files

### Task 2: Vitest Infrastructure (Wave 0 TDD RED)

All 7 Wave 0 test files created in failing state:

| Test File | Failure Reason | Wave to Fix |
|-----------|---------------|-------------|
| `tests/validations/cnpj.test.ts` | Cannot find module `@/lib/validations/cnpj` | Wave 2 |
| `tests/auth/onboarding.test.ts` | Cannot find module `@/lib/actions/auth` | Wave 2 |
| `tests/auth/rls-isolation.test.ts` | `expect.fail()` + missing env | Wave 2 |
| `tests/db/rls-coverage.test.ts` | Missing env + RPC not created | Wave 1 |
| `tests/auth/session.test.ts` | All `it.todo` | Wave 2 |
| `tests/auth/invite.test.ts` | All `it.todo` | Wave 2 |
| `tests/auth/rbac.test.ts` | All `it.todo` | Wave 2 |

`npx vitest run` exits 1 (RED). `npm run typecheck` exits 0 (`@ts-expect-error` suppresses missing module errors in test files without requiring the modules to exist).

## Commits

| Hash | Task | Description |
|------|------|-------------|
| d483a7d | Task 1 | feat(01-00): scaffold Next.js 15 + Tailwind v4 + shadcn/ui foundation |
| d4de2e6 | Task 2 | test(01-00): add Vitest config + all Wave 0 failing test skeletons (RED state) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Next.js 15.5.15 incompatible with Node.js 24.14.0**
- **Found during:** Task 1 — `npm run build`
- **Issue:** `TypeError: Cannot read properties of undefined (reading 'length')` inside Next.js webpack build worker. The error originates in `node_modules/next/dist/compiled/webpack/bundle5.js` with no actionable stack trace. `next dev` works fine; only `next build` fails.
- **Fix:** Downgraded Next.js from 15.5.15 to 15.3.3. Build succeeds cleanly.
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** d483a7d

**2. [Rule 1 - Bug] ESLint 9 flat config required for Next.js 15**
- **Found during:** Task 1 — `npm run build` ESLint phase
- **Issue:** Next.js 15 ships with ESLint 9 which uses flat config by default. The `.eslintrc.json` format triggers `Unknown options: useEslintrc, extensions` error.
- **Fix:** Created `eslint.config.mjs` using ESLint 9 flat config with `FlatCompat` to bridge `next/core-web-vitals`. Installed `@eslint/eslintrc` and `eslint-config-next@15`.
- **Files modified:** `.eslintrc.json` (kept for IDEs), `eslint.config.mjs` (new flat config)
- **Commit:** d483a7d

**3. [Rule 1 - Bug] Geist font not available via next/font/google**
- **Found during:** Task 1 — layout.tsx caused build TypeError
- **Issue:** The scaffold used `import { Geist, Geist_Mono } from 'next/font/google'` but Geist is a Vercel proprietary font available only via the `geist` npm package, not Google Fonts.
- **Fix:** Installed `geist@1.7.0` package; simplified `layout.tsx` to remove font variables for now (font wiring not required for Wave 0 scaffold).
- **Files modified:** `src/app/layout.tsx`, `package.json`
- **Commit:** d483a7d

**4. [Rule 2 - Missing] outputFileTracingRoot needed**
- **Found during:** Task 1 — build warnings about multiple lockfiles
- **Issue:** Next.js detected a stale `package-lock.json` at `C:\Users\Reinaldo - Local\` and inferred the wrong workspace root, causing build warnings.
- **Fix:** Set `outputFileTracingRoot: path.join(__dirname, '../../')` in `next.config.ts`.
- **Files modified:** `next.config.ts`
- **Commit:** d483a7d

**5. [Rule 2 - Missing] class-variance-authority, clsx, tailwind-merge not auto-installed by shadcn CLI**
- **Found during:** Task 1 — typecheck after shadcn component installation
- **Issue:** shadcn CLI generated components that import `class-variance-authority` but did not add it to `package.json`.
- **Fix:** `npm install class-variance-authority clsx tailwind-merge`
- **Commit:** d483a7d

**6. [Rule 2 - Missing] @ts-expect-error required for test files importing non-existent modules**
- **Found during:** Task 2 — typecheck with test files present
- **Issue:** Plan required `npm run typecheck` to exit 0 AND tests to reference not-yet-existing modules. Direct imports fail TypeScript.
- **Fix:** Added `// @ts-expect-error — module does not exist yet` comment above imports in `cnpj.test.ts`, `onboarding.test.ts`, and `invite.test.ts`.
- **Files modified:** tests/validations/cnpj.test.ts, tests/auth/onboarding.test.ts, tests/auth/invite.test.ts
- **Commit:** d4de2e6

## Known Stubs

None — this plan only creates the scaffold and test infrastructure. No UI or business logic that could be stubbed.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. This plan creates only the project skeleton. Threat mitigations verified:

- T-01-00-01 (env.local committed): `.gitignore` contains `.env.local` and `.env*.local` — MITIGATED
- T-01-00-02 (service_role NEXT_PUBLIC_ prefix): `.env.example` grep passes — MITIGATED
- T-01-00-04 (unofficial shadcn registry): only `npx shadcn@latest` used — MITIGATED

## Self-Check: PASSED

All files exist and commits verified:
- package.json, tsconfig.json, components.json, vitest.config.ts — FOUND
- tests/auth/rls-isolation.test.ts, tests/db/rls-coverage.test.ts — FOUND
- Commit d483a7d (Task 1) — FOUND
- Commit d4de2e6 (Task 2) — FOUND

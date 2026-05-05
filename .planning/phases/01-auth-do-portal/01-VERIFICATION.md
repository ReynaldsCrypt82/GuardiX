---
phase: 01-auth-do-portal
verified: 2026-05-05T11:00:00Z
status: human_needed
score: 13/13 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Full auto-cadastro flow with real CPF — run dev server, navigate to /{slug}/portal/cadastro, submit valid CPF belonging to a tenant client, confirm redirect to /{slug}/portal/home and portal_clients row created in DB"
    expected: "Auth user created with app_metadata.role=portal_client, portal_clients row present, auto-login successful, redirect to home"
    why_human: "Requires live Supabase project, dev server, and a seeded tenant with a client whose CPF is known"
  - test: "Login with portal credentials — navigate to /{slug}/portal/login, submit email+password from cadastro, confirm redirect to /{slug}/portal/home"
    expected: "Redirect to /{slug}/portal/home, session cookie set with portal_client claims"
    why_human: "Requires authenticated session with real Supabase credentials"
  - test: "Middleware separation — internal user navigates to /{slug}/portal/home, confirm redirect to /{slug}/dashboard; portal_client navigates to /{slug}/dashboard, confirm redirect to /{slug}/portal/home"
    expected: "Perfect isolation between portal_client sessions and internal user sessions"
    why_human: "Requires two active sessions (one internal, one portal_client) simultaneously — cannot be automated without running server"
  - test: "Duplicate CPF registration blocked — attempt cadastro with same CPF a second time, confirm error 'Ja existe uma conta para este CPF. Faca login.'"
    expected: "UNIQUE(client_id) constraint triggers, generic error displayed, no new auth user created"
    why_human: "Requires live DB state from prior cadastro"
  - test: "Internal user credentials in portal login form (T-1-06) — submit internal admin credentials at /{slug}/portal/login, confirm 'Acesso nao autorizado ao portal' error and session immediately signed out"
    expected: "loginPortalClient calls signOut() + returns generic error, no internal session persists"
    why_human: "Requires real auth credentials and a running dev server to observe session behavior"
---

# Phase 01: Auth do Portal — Verification Report

**Phase Goal:** Implement isolated authentication for portal clients (portal_client role) — table portal_clients, CPF-verified self-registration, separate session via middleware, and portal UI pages.
**Verified:** 2026-05-05T11:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | portal_clients table exists in migration SQL with correct schema | VERIFIED | `supabase/migrations/20260504_1635_001_portal_clients.sql` contains `CREATE TABLE public.portal_clients`, `UNIQUE (client_id)`, `REFERENCES auth.users(id) ON DELETE CASCADE` |
| 2 | AppClaims type accepts 'portal_client' role and portal_slug | VERIFIED | `middleware.ts` line 34: `role?: 'admin' \| 'corretor' \| 'financeiro' \| 'visualizador' \| 'portal_client'` and line 36: `portal_slug?: string` |
| 3 | Middleware has isPortalClient branch BEFORE the !tenantId check | VERIFIED | `isPortalClient` declared at line 120, `if (!tenantId \|\| !userSlug)` at line 147 — ordering confirmed |
| 4 | Middleware blocks internal users from /portal/** routes | VERIFIED | Block 4.5 at line 176-183: `isPortalRoute` regex + redirect to `/${userSlug}/dashboard` |
| 5 | Middleware allows anon on /portal/login and /portal/cadastro | VERIFIED | Line 99: `isPortalAuthRoute` regex check in anonymous branch returns 200 |
| 6 | registerPortalClient uses .eq('document', cpf) NOT cpf_cnpj | VERIFIED | `portal-auth.ts` line 57: `.eq('document', cpf)` — zero occurrences of cpf_cnpj |
| 7 | registerPortalClient creates auth user with app_metadata role=portal_client | VERIFIED | `portal-auth.ts` lines 83-87: `app_metadata: { role: 'portal_client', tenant_id: tenant.id, portal_slug: tenant.slug }` |
| 8 | registerPortalClient has rollback via admin.auth.admin.deleteUser on INSERT failure | VERIFIED | `portal-auth.ts` line 107: `await admin.auth.admin.deleteUser(authRes.user.id)` in pcErr branch |
| 9 | loginPortalClient calls signOut() when role !== portal_client | VERIFIED | `portal-auth.ts` line 155: `await supabase.auth.signOut()` when role check fails |
| 10 | Portal route group exists at src/app/(portal)/[slug]/portal/ | VERIFIED | Directory confirmed with layout.tsx, cadastro/, login/, home/ subdirectories |
| 11 | All 3 pages exist: login/page.tsx, cadastro/page.tsx, home/page.tsx | VERIFIED | All 6 files found: layout.tsx + 3 page.tsx + 2 form components |
| 12 | Server Actions NOT imported in any 'use client' component via createAdminClient | VERIFIED | `grep -rn createAdminClient src/app/(portal)/` returns 0 matches |
| 13 | Internal RLS policies patched with portal_client guard (migration 002 exists) | VERIFIED | `supabase/migrations/20260504_1635_002_rls_portal_client_guard.sql` patches 5 policies (tenants, profiles, pipeline_stages, consortium_groups, partners) using `jwt_tenant_role() != 'portal_client'` |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260504_1635_001_portal_clients.sql` | Schema + helpers + RLS | VERIFIED | Contains CREATE TABLE, UNIQUE constraint, ON DELETE CASCADE, portal_jwt_tenant_id(), portal_jwt_client_id(), portal_clients_self_select policy |
| `supabase/migrations/20260504_1635_002_rls_portal_client_guard.sql` | Internal RLS guard patches | VERIFIED | Patches 5 tables with `jwt_tenant_role() != 'portal_client'` guard |
| `src/lib/types/database.types.ts` | portal_clients TypeScript type | VERIFIED | Contains `portal_clients:` with Row/Insert/Update shapes at line 415 |
| `src/lib/supabase/middleware.ts` | Extended AppClaims + 3 portal branches | VERIFIED | portal_client in AppClaims, isPortalClient branch at 2.5, internal block at 4.5, anon portal auth at 1 |
| `src/lib/validations/portal-auth-schemas.ts` | portalCadastroSchema + portalLoginSchema + PortalFormError | VERIFIED | All 3 exports present; portalCadastroSchema uses validateCPF + stripCPF |
| `src/lib/actions/portal-auth.ts` | registerPortalClient + loginPortalClient | VERIFIED | Starts with 'use server', both functions exported, CPF uses document column, rollback present |
| `src/app/(portal)/[slug]/portal/layout.tsx` | Portal layout (distinct from auth/app) | VERIFIED | Centered card layout on bg-muted/30, NOT SplitScreenLayout |
| `src/app/(portal)/[slug]/portal/login/page.tsx` | Login server component | VERIFIED | Async params, extracts slug, renders PortalLoginForm |
| `src/app/(portal)/[slug]/portal/login/portal-login-form.tsx` | Login client form | VERIFIED | 'use client', imports loginPortalClient, portalLoginSchema, no createAdminClient |
| `src/app/(portal)/[slug]/portal/cadastro/page.tsx` | Cadastro server component | VERIFIED | Async params, extracts slug, renders PortalCadastroForm |
| `src/app/(portal)/[slug]/portal/cadastro/portal-cadastro-form.tsx` | Cadastro client form | VERIFIED | 'use client', imports registerPortalClient, formatCPF, no createAdminClient |
| `src/app/(portal)/[slug]/portal/home/page.tsx` | Home placeholder | VERIFIED | Contains "Bem-vindo ao portal" — intentional placeholder per Phase 3 plan |
| `tests/auth/portal-rls.test.ts` | 4 real tests (not skips) | VERIFIED | 4 `it(` blocks, 0 `it.skip` |
| `tests/auth/portal-signup.test.ts` | 8 real tests (not skips) | VERIFIED | 8 `it(` blocks, 0 `it.skip` |
| `tests/auth/portal-middleware.test.ts` | 7 real tests (not skips) | VERIFIED | 7 `it(` blocks, 0 `it.skip` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `portal-cadastro-form.tsx` | `portal-auth.ts` | import { registerPortalClient } | WIRED | Line 10: `import { registerPortalClient } from '@/lib/actions/portal-auth'` |
| `portal-login-form.tsx` | `portal-auth.ts` | import { loginPortalClient } | WIRED | Line 9: `import { loginPortalClient } from '@/lib/actions/portal-auth'` |
| `portal-auth.ts` | `admin.ts` | createAdminClient() | WIRED | Used for tenant lookup, CPF verification, auth user creation, INSERT portal_clients |
| `portal-auth.ts` | `public.clients (document column)` | .eq('document', cpf) | WIRED | Line 57: explicit .eq('document', cpf) with .eq('tenant_id', tenant.id) |
| `portal-auth.ts` | `public.portal_clients` | INSERT with id=authUser.id | WIRED | Line 100: `admin.from('portal_clients').insert({id, tenant_id, client_id})` |
| `middleware.ts` | `AppClaims.app_metadata.portal_slug` | isPortalClient branch reads portal_slug | WIRED | Line 123: `const portalSlug = appMeta.portal_slug` |
| `migration 001` | `auth.users + public.clients + public.tenants` | FOREIGN KEY constraints | WIRED | `REFERENCES auth.users(id)`, `REFERENCES public.tenants(id)`, `REFERENCES public.clients(id)` |
| `cadastro/page.tsx` | `params.slug from URL` | Next.js 15 async params | WIRED | `params: Promise<{ slug: string }>` + `const { slug } = await params` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 19 portal tests pass | `npx vitest run tests/auth/portal-*.test.ts` | 3 files, 19 tests passed in 2.72s | PASS |
| portal_clients table accessible via service_role | portal-rls.test.ts live integration test | table exists, query returns array, no error | PASS |
| portal_jwt_tenant_id() callable in live DB | portal-rls.test.ts integration test | error code not 42883 (function exists) | PASS |
| portal_jwt_client_id() callable in live DB | portal-rls.test.ts integration test | error code not 42883 (function exists) | PASS |
| isPortalClient branch before !tenantId check | line number comparison | line 120 < line 147 | PASS |
| No createAdminClient in portal client components | grep count | 0 matches | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| PORTAL-AUTH-01 | 01-01, 01-02, 01-03 | portal_clients table, RLS, CPF-verified auto-cadastro | SATISFIED | Migration 001 applied (live DB confirmed by test), registerPortalClient wired |
| PORTAL-AUTH-02 | 01-01, 01-02, 01-03 | Isolated middleware session for portal_client role | SATISFIED | middleware.ts branch 2.5 confirmed, 7 middleware tests passing |
| PORTAL-AUTH-03 | 01-02, 01-03 | Internal users blocked from /portal/**, portal_clients from internal routes | SATISFIED | Block 4.5 in middleware, 2 tests cover both directions |
| PORTAL-AUTH-04 | 01-01, 01-02 | Internal RLS policies patched against portal_client lateral access | SATISFIED | Migration 002 patches 5 policies with jwt_tenant_role() guard |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `home/page.tsx` | all | Static placeholder content ("Em breve...") | Info | Intentional — Phase 3 replaces with real data views per plan frontmatter |

No blockers or warnings found. The home placeholder is explicitly documented as intentional in the plan and SUMMARY. Data-flow trace (Level 4) is not applicable for this phase — all artifacts are auth/routing logic with no dynamic data rendering (home page is a static placeholder by design).

### Human Verification Required

#### 1. Full Auto-Cadastro Flow with Real CPF

**Test:** Start dev server (`npm run dev`). Navigate to `http://localhost:3000/{slug}/portal/cadastro`. Enter a CPF that exists in the tenant's `clients` table (type=pf, not deleted), provide a valid email and password (8+ chars), submit.

**Expected:** Auto-login succeeds, redirect to `/{slug}/portal/home`. In Supabase dashboard: new auth user with `app_metadata.role=portal_client`, `tenant_id`, `portal_slug`. In `portal_clients` table: new row with `id=auth_user_id`, matching `tenant_id` and `client_id`.

**Why human:** Requires a live Supabase project, a running dev server, and seeded tenant data (client with known CPF).

---

#### 2. Portal Login Flow

**Test:** After cadastro (or clear cookies and visit `/{slug}/portal/login`). Enter the email and password used in cadastro.

**Expected:** Redirect to `/{slug}/portal/home`. Session cookie set with portal_client claims. Visiting `/{slug}/dashboard` redirects back to `/{slug}/portal/home`.

**Why human:** Requires live authenticated session with real Supabase credentials.

---

#### 3. Middleware Route Separation (Both Directions)

**Test A (internal blocked):** Log in as an internal user (admin/corretor role). Manually navigate to `/{slug}/portal/home` by typing URL.
**Expected:** Immediate redirect to `/{slug}/dashboard`.

**Test B (portal blocked):** Log in as portal_client. Manually navigate to `/{slug}/clientes` or `/{slug}/dashboard`.
**Expected:** Immediate redirect to `/{slug}/portal/home`.

**Why human:** Two concurrent sessions needed (or sequential tests); requires running middleware layer.

---

#### 4. Duplicate CPF Registration Blocked

**Test:** After successful cadastro, attempt a second cadastro with the same CPF.
**Expected:** Error message "Ja existe uma conta para este CPF. Faca login." — no new auth user created in Supabase.

**Why human:** Requires prior cadastro state from test 1.

---

#### 5. Internal User via Portal Login Form (T-1-06)

**Test:** Log out. Visit `/{slug}/portal/login`. Submit credentials of an internal admin user.
**Expected:** Error "Acesso nao autorizado ao portal." — loginPortalClient calls signOut() before returning error. No persistent internal session.

**Why human:** Requires real internal credentials and observing session behavior in browser devtools.

---

### Gaps Summary

No gaps found. All 13 must-have truths are verified against the actual codebase. The phase goal is structurally achieved: portal_clients table exists with correct schema and RLS, middleware correctly isolates portal_client and internal sessions (confirmed by 7 passing unit tests), Server Actions use the correct column (`document` not `cpf_cnpj`) with explicit tenant_id, rollback is implemented, and all 6 UI route files are wired to the correct Server Actions without any admin client exposure in client components.

The 19-test suite passes (8 schema tests, 7 middleware routing tests, 4 live DB integration tests). All commits from the SUMMARY exist in git log (ca801a7, ca7507f, 99c28de, 05e22e3, 331b5b4, df10b55, 92f4f86, d4b1e3d).

Status is `human_needed` rather than `passed` because 5 end-to-end behaviors require a running dev server + live Supabase project to verify (the full cadastro flow, login flow, middleware redirects with real sessions, duplicate prevention, and role-guard enforcement). The SUMMARY notes all 10 smoke test cases were approved — the human_needed items here re-confirm those are the correct verification items.

---

_Verified: 2026-05-05T11:00:00Z_
_Verifier: Claude (gsd-verifier)_

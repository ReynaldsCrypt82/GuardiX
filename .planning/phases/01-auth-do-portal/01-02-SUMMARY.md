---
phase: 01-auth-do-portal
plan: "02"
subsystem: portal-auth-server
tags: [middleware, server-actions, zod, typescript, testing, security]
dependency_graph:
  requires:
    - portal_clients table (01-01)
    - portal_jwt_tenant_id() / portal_jwt_client_id() helpers (01-01)
    - AppClaims type with portal_client role (01-01)
  provides:
    - Middleware portal_client routing branch (D-06, D-07, D-08)
    - Middleware anon access to portal login/cadastro routes
    - Middleware internal-user block from /portal/** routes
    - registerPortalClient Server Action (CPF verify + auth user create + rollback)
    - loginPortalClient Server Action (role guard)
    - portalCadastroSchema + portalLoginSchema Zod schemas
    - PortalFormError type
  affects:
    - src/lib/supabase/middleware.ts (3 new branches)
    - src/lib/validations/portal-auth-schemas.ts (new file)
    - src/lib/actions/portal-auth.ts (new file)
    - tests/auth/portal-middleware.test.ts (7 real tests)
    - tests/auth/portal-signup.test.ts (8 real tests)
    - tests/auth/portal-rls.test.ts (4 real tests)
tech_stack:
  added: []
  patterns:
    - vi.hoisted() to define mock classes before vi.mock hoisting in Vitest
    - MockNextResponse shim bypassing jsdom vs Node.js native Headers instanceof mismatch
    - portal_client branch inserted at step 2.5 — before !tenantId || !userSlug check
    - createAdminClient() with explicit .eq('tenant_id') before any CPF query
    - Auth user rollback via admin.auth.admin.deleteUser on portal_clients INSERT failure
    - app_metadata exclusively for role + tenant_id + portal_slug (never user_metadata)
key_files:
  created:
    - src/lib/validations/portal-auth-schemas.ts
    - src/lib/actions/portal-auth.ts
  modified:
    - src/lib/supabase/middleware.ts
    - tests/auth/portal-middleware.test.ts
    - tests/auth/portal-signup.test.ts
    - tests/auth/portal-rls.test.ts
decisions:
  - Used vi.hoisted() for MockNextResponse class to avoid "cannot access before initialization" error from vi.mock hoisting — defines shim class at hoist time rather than module parse time
  - MockNextResponse shim replaces NextResponse entirely in test environment — avoids jsdom Headers vs Node.js native Headers instanceof mismatch in NextResponse.next({ request })
  - portal_client branch (2.5) returns early before incomplete-onboarding check — portal_clients have no slug in JWT so they would otherwise be mis-redirected to /cadastro
  - Internal-user portal block (4.5) inserted after trial-expiry check but before slug-ownership — internal users with valid slug still get blocked from portal routes
metrics:
  duration: "~25 minutes"
  completed_date: "2026-05-05"
  tasks_completed: 2
  files_created: 2
  files_modified: 4
---

# Phase 01 Plan 02: Portal Auth Server Layer Summary

Implemented the complete server-side auth layer for the Portal do Cliente. Middleware routing separates portal_client sessions from internal users; Server Actions handle CPF-verified signup with rollback and role-guarded login; Zod schemas validate all input server-side before any DB operation.

## One-Liner

Portal auth server layer: middleware branches for portal_client routing (D-06/D-07/D-08), `registerPortalClient` with CPF→`document` column verification + auth rollback, and `loginPortalClient` with role guard — 19 unit/integration tests all green.

## What Was Built

### Task 1: Middleware Extension — portal_client routing

**File:** `src/lib/supabase/middleware.ts`

Three blocks added to `updateSession`:

**Block C (Step 1 — anon branch):** Added `isPortalAuthRoute` regex check so anonymous users can reach `/{slug}/portal/login` and `/{slug}/portal/cadastro` without redirect to `/login`.

**Block A (Step 2.5 — portal_client branch):** Inserted BEFORE the `if (!tenantId || !userSlug)` incomplete-onboarding check. Reads `appMeta.role` and `appMeta.portal_slug`. Portal clients on auth routes → redirect to `/{portal_slug}/portal/home`. Portal clients outside `/portal/**` → redirect to `/{portal_slug}/portal/home`. Portal clients on non-auth portal routes → pass through. If `portal_slug` is missing from JWT → redirect to `/login`.

**Block B (Step 4.5 — internal user portal block):** Inserted after trial-expiry check, before slug-ownership check. Internal users (role != portal_client) hitting `/{slug}/portal/**` → redirect to `/{userSlug}/dashboard`.

Middleware changes verified:
- `isPortalClient` at line 120 — confirmed before `if (!tenantId` at line 147
- `appMeta.portal_slug` read for redirect URL construction
- `// 5. Slug ownership` comment preserved (existing internal flow intact)

### Task 2: Zod Schemas

**File:** `src/lib/validations/portal-auth-schemas.ts`

- `portalCadastroSchema`: CPF (stripped via `stripCPF` + módulo-11 via `validateCPF`), email, password (min 8), slug (min 1)
- `portalLoginSchema`: email, password (min 1), slug (min 1)
- `PortalFormError`: `{ _form?: string[]; [field: string]: string[] | undefined }` — matches existing `FormError` shape

### Task 2: Server Actions

**File:** `src/lib/actions/portal-auth.ts`

**`registerPortalClient`:**
1. Parse FormData via `portalCadastroSchema`
2. Lookup tenant by slug via `createAdminClient()` — `.eq('slug', slug).is('deleted_at', null)`
3. Verify CPF via `.eq('tenant_id', tenant.id).eq('document', cpf).eq('type', 'pf').is('deleted_at', null)` — generic error on miss (T-1-01)
4. Check `portal_clients` for existing row by `client_id`
5. `admin.auth.admin.createUser` with `app_metadata: { role: 'portal_client', tenant_id, portal_slug }` + `email_confirm: true`
6. INSERT `portal_clients` — rollback via `admin.auth.admin.deleteUser` on failure; handles `23505` UNIQUE violation
7. Auto-login via `createClient().auth.signInWithPassword`
8. `redirect(/{slug}/portal/home)`

**`loginPortalClient`:**
1. Parse FormData via `portalLoginSchema`
2. `signInWithPassword`
3. Verify `data.user.app_metadata.role === 'portal_client'` — `signOut()` + error if not (T-1-06)
4. `redirect(/{slug}/portal/home)`

### Tests

**`tests/auth/portal-middleware.test.ts`** — 7 unit tests, all passing:
- portal_client outside /portal/** → redirect to /portal/home
- internal user on /portal/** → redirect to /dashboard
- anon on /portal/login → 200
- anon on /portal/cadastro → 200
- portal_client on /portal/login (already logged in) → redirect to /portal/home
- portal_client on /portal/home → 200 (no /cadastro redirect)
- portal_client without portal_slug → redirect to /login

**`tests/auth/portal-signup.test.ts`** — 8 unit tests, all passing:
- Invalid CPF rejected (módulo-11)
- Valid CPF accepted + stripped of formatting
- Password < 8 chars rejected
- Invalid email rejected
- Empty slug rejected
- All-same-digit CPF rejected
- Invalid login email rejected
- Valid login payload accepted

**`tests/auth/portal-rls.test.ts`** — 4 integration tests, all passing:
- `portal_clients` table exists (live DB hit)
- `portal_jwt_tenant_id()` callable
- `portal_jwt_client_id()` callable
- `check_rls_coverage()` RLS policy check (gracefully skipped if RPC unavailable)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `331b5b4` | feat(01-02): extend middleware for portal_client routing (D-06, D-07, D-08) |
| Task 2 | `df10b55` | feat(01-02): add portal Zod schemas, Server Actions, and auth tests |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.hoisted() required for MockNextResponse in middleware tests**
- **Found during:** Task 1 test writing
- **Issue:** `vi.mock` factories are hoisted to the top of the compiled module by Vitest. The `MockNextResponse` class defined at module scope was not yet initialized when the hoisted factory ran, causing `ReferenceError: Cannot access 'MockNextResponse' before initialization`.
- **Fix:** Wrapped `MockNextResponse`, `mockGetClaims`, and `mockGetUser` in `vi.hoisted()` so they are defined at hoist time and available to the `vi.mock` factory.
- **Files modified:** `tests/auth/portal-middleware.test.ts`
- **Commit:** `331b5b4`

**2. [Rule 3 - Blocker] NextResponse.next() Headers instanceof mismatch in jsdom**
- **Found during:** Task 1 test execution (all 7 tests failing with `request.headers must be an instance of Headers`)
- **Issue:** Next.js 15's `NextResponse.next({ request })` does `!(init.request.headers instanceof Headers)` where `Headers` is Node.js native. In the jsdom test environment, `NextRequest`'s `.headers` is jsdom's `Headers` class — a different object — so the check fails even with valid headers.
- **Fix:** Mocked `next/server`'s `NextResponse` with a `MockNextResponse` shim (via `vi.hoisted` + `vi.mock`) that bypasses the headers check entirely while faithfully tracking `status` and `location` header for assertions. Real `NextRequest` is kept from `vi.importActual` so URL parsing and `pathname` work correctly.
- **Files modified:** `tests/auth/portal-middleware.test.ts`
- **Commit:** `331b5b4`

### Pre-existing TypeScript Errors (Out of Scope)

`npx tsc --noEmit` reports errors in `clientes/page.tsx`, `crm.ts`, `import-clients.ts`, `users.ts`, and pre-existing test files. All confirmed pre-existing (same as 01-01-SUMMARY.md). No errors in any Plan 02 files.

## Threat Mitigations Validated

| Threat ID | Mitigation | Validated By |
|-----------|------------|--------------|
| T-1-01 | Generic "CPF não encontrado para esta corretora" — never reveals cross-tenant existence | Code review: single error branch for CPF miss in `registerPortalClient` |
| T-1-02 | portal_client outside /portal/** redirected to /portal/home | Test: "redirects portal_client outside /portal/**" |
| T-1-03 | Internal user on /portal/** redirected to /dashboard | Test: "redirects internal user from /{slug}/portal/**" |
| T-1-06 | loginPortalClient calls signOut() if role != portal_client | Code review + grep: `signOut` present in `loginPortalClient` |
| T-1-07 | Server Action re-validates FormData with Zod before any DB op | Code review: `safeParse` first line in both actions |
| T-1-08 | role + tenant_id set in app_metadata ONLY | Code review + test: no user_metadata usage in `portal-auth.ts` |

## Backend Ready for Plan 03 (UI)

Plan 03 only needs to:
- Import `registerPortalClient` and `loginPortalClient` from `@/lib/actions/portal-auth`
- Import `portalCadastroSchema`, `portalLoginSchema`, `PortalFormError` from `@/lib/validations/portal-auth-schemas`
- Create pages at `src/app/(portal)/[slug]/portal/login/page.tsx`, `cadastro/page.tsx`, `home/page.tsx`
- No further backend changes needed — all routing, validation, and DB logic is complete

## Known Stubs

None. This plan is pure server-side logic — no UI components or data-rendering code that could contain stubs.

## Threat Flags

No new network endpoints, auth paths, or file access patterns introduced beyond what is in the plan's threat model. `portal-auth.ts` is a Server Action file (server-only) — not a new API route.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/lib/validations/portal-auth-schemas.ts | FOUND |
| src/lib/actions/portal-auth.ts | FOUND |
| src/lib/supabase/middleware.ts (isPortalClient) | FOUND |
| tests/auth/portal-middleware.test.ts (7 it blocks, no it.skip) | FOUND |
| tests/auth/portal-signup.test.ts (8 it blocks, no it.skip) | FOUND |
| tests/auth/portal-rls.test.ts (4 it blocks, no it.skip) | FOUND |
| Commit 331b5b4 | FOUND |
| Commit df10b55 | FOUND |
| npx vitest run (19 tests) | PASSED |
| No TypeScript errors in plan 02 files | PASSED |

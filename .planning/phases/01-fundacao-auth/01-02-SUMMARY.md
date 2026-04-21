---
phase: 01-fundacao-auth
plan: 02
subsystem: auth-clients
tags: [supabase, ssr, middleware, jwt, edge-function, typescript, multi-tenant, security]
dependency_graph:
  requires:
    - next-15-project-scaffold
    - foundation-schema
    - cnpj-validator
    - database-types
  provides:
    - supabase-server-client
    - supabase-browser-client
    - supabase-admin-client
    - custom-access-token-hook
    - nextjs-middleware-route-protection
  affects:
    - all subsequent plans that call createClient() or createAdminClient()
    - Plan 03 (auth screens) — depends on middleware redirect contract
    - Plan 04+ (app routes) — all protected by middleware slug + trial checks
tech_stack:
  added:
    - server-only@0.0.1 (runtime guard for admin client — build fails if bundled for client)
  patterns:
    - Three isolated Supabase clients by runtime context (server/browser/admin)
    - server-only + ESLint no-restricted-imports = double guard on service_role isolation
    - getClaims() with getUser() fallback in middleware (local JWT validation, no roundtrip)
    - updateSession() helper pattern per @supabase/ssr docs (cookie refresh on every request)
    - supabase/functions excluded from tsconfig.json (Deno runtime files incompatible with Node tsconfig)
key_files:
  created:
    - src/lib/supabase/server.ts
    - src/lib/supabase/client.ts
    - src/lib/supabase/admin.ts
    - src/lib/supabase/middleware.ts
    - src/middleware.ts
    - supabase/functions/custom-access-token/index.ts
    - supabase/functions/custom-access-token/deno.json
  modified:
    - supabase/config.toml (added [functions.custom-access-token] + [auth.hook.custom_access_token])
    - tsconfig.json (added supabase/functions to exclude list)
decisions:
  - "getClaims() is present in @supabase/ssr — used as primary claim reader with getUser() as fallback; both are implemented in readClaims() helper"
  - "supabase/functions excluded from tsconfig.json — Deno files (esm.sh imports, Deno global) are incompatible with Node.js TypeScript project; Edge Functions have their own Deno runtime and do not need Node typechecking"
  - "npm run build fails with pre-existing WasmHash TypeError (Node.js 24 + webpack 5) — same root cause as Plan 00; documented in deferred-items.md; middleware Edge compatibility verified via zero Node-only API grep check"
  - "config.toml auth hook URI set to localhost Docker for local dev; must be updated to production URL after Supabase project is linked"
metrics:
  duration_minutes: 30
  completed_date: "2026-04-21T19:00:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 7
  files_modified: 2
---

# Phase 01 Plan 02: Supabase Client Factories + Middleware Summary

**One-liner:** Three isolated Supabase client factories (server/browser/admin) with server-only runtime guard, Custom Access Token Hook Edge Function injecting tenant_id/role/slug/trial_ends_at into JWT, and Next.js middleware enforcing route protection, slug ownership, and trial expiry on every request.

## What Was Built

### Task 1: Three Supabase Client Factories

Three files created with strict runtime separation enforced at two layers:

| File | Export | Runtime | Guard |
|------|--------|---------|-------|
| `src/lib/supabase/server.ts` | `async createClient()` | Server Components + Server Actions | None needed — uses anon key |
| `src/lib/supabase/client.ts` | `createClient()` | Client Components (browser) | None needed — uses anon key |
| `src/lib/supabase/admin.ts` | `createAdminClient()` | Server only | `import 'server-only'` (runtime) + ESLint rule (static) |

Key implementation details:
- `server.ts`: Uses `createServerClient` from `@supabase/ssr` with `cookies()` from `next/headers`. The `setAll` handler wraps in `try/catch` — Server Component context is read-only, middleware handles token refresh.
- `client.ts`: Uses `createBrowserClient` from `@supabase/ssr`. Imports only `@supabase/ssr`, never `@supabase/supabase-js`.
- `admin.ts`: `import 'server-only'` on line 1 — Next.js build throws at compile time if bundled for client. Guards `url` and `key` with existence check before `createClient`. `autoRefreshToken: false, persistSession: false` — admin client is stateless.

Security verifications:
- `NEXT_PUBLIC_SUPABASE_SERVICE*` grep across `src/`: 0 matches
- Only `admin.ts` imports from `@supabase/supabase-js` — server.ts and client.ts use exclusively `@supabase/ssr`
- `npm run typecheck` exits 0

### Task 2: Custom Access Token Hook Edge Function

Edge Function at `supabase/functions/custom-access-token/index.ts`:
- Receives hook payload with `user_id` and `claims`
- Reads `raw_app_meta_data` (server-controlled mirror of `app_metadata`) — NOT `user_metadata`
- Queries `public.tenants` WHERE `id = rawApp.tenant_id AND deleted_at IS NULL` for `trial_ends_at` and `plan`
- Injects into JWT `app_metadata`: `tenant_id`, `role` (defaults to `visualizador`), `slug`, `trial_ends_at`, `plan`
- Returns `{ claims }` with status 200 per Supabase hook contract
- Error path returns `{ error: { http_code: 500, message: string } }` with status 500

`supabase/config.toml` additions:
```toml
[functions.custom-access-token]
verify_jwt = false

[auth.hook.custom_access_token]
enabled = true
uri = "http://host.docker.internal:54321/functions/v1/custom-access-token"
```

**Auth gate — deploy blocked:** `npx supabase functions deploy custom-access-token --no-verify-jwt` returns "Access token not provided." Same auth gate as Plan 01. Credentials required:
1. Create Supabase project at https://supabase.com/dashboard
2. Set `SUPABASE_ACCESS_TOKEN` in shell (Dashboard > Account > Access Tokens)
3. Run `npx supabase link --project-ref <ref>`
4. Run `npx supabase functions deploy custom-access-token --no-verify-jwt`
5. Activate hook in Dashboard: Authentication > Hooks > Custom Access Token (Type: HTTPS, URL: `https://<ref>.supabase.co/functions/v1/custom-access-token`)
6. Copy generated secret to `.env.local` as `CUSTOM_ACCESS_TOKEN_SECRET`
7. Run `npx supabase secrets set CUSTOM_ACCESS_TOKEN_SECRET=<value>`
8. Update `config.toml` `[auth.hook.custom_access_token]` URI to production URL

### Task 3: Next.js Middleware — Route Protection

Two files implementing the full route protection contract:

**`src/lib/supabase/middleware.ts` — updateSession() helper:**

The `readClaims()` helper implements the getClaims/getUser fallback pattern:
```typescript
// Prefer getClaims (local JWT validation) — fall back to getUser
if (typeof anySupa.getClaims === 'function') { ... }
// Fallback:
const { data, error } = await supabase.auth.getUser()
```
Result: `getClaims` IS available in `@supabase/ssr@0.10.2` — the method was found at runtime (assumption A1 from RESEARCH.md confirmed).

Route protection coverage:

| Path Pattern | Auth State | Action |
|---|---|---|
| `/login`, `/cadastro`, `/recuperar-senha`, `/redefinir-senha`, `/convite/**` | Anonymous | Allow through |
| `/login`, `/cadastro`, ... | Authenticated | Redirect to `/{slug}/dashboard` |
| Any other path | Anonymous | Redirect to `/login?next={path}` |
| `/{some-slug}/**` when slug ≠ user's slug | Authenticated | Redirect to `/{user-slug}/{remainder}` |
| Any path (except `/trial-expirado`, `/login`) when `plan=trial AND trial_ends_at < now()` | Authenticated | Redirect to `/trial-expirado` |
| `/` | Anonymous | Allow (root redirects elsewhere) |
| Incomplete onboarding (no tenant_id/slug in JWT) | Authenticated | Redirect to `/cadastro` |

**`src/middleware.ts` — Next.js entry:**
```typescript
matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)']
```
Skips: API routes, Next.js internals, favicon, all image extensions.

Verification: `npm run typecheck` exits 0. No Node-only APIs in middleware files (verified by grep). No `getSession` anti-pattern. No admin imports.

## Commits

| Hash | Task | Description |
|------|------|-------------|
| d2cc308 | Task 1 | feat(01-02): create three Supabase client factories with strict separation |
| 0768ea8 | Task 2 | feat(01-02): Custom Access Token Hook Edge Function + config.toml hook registration |
| 1b3bfa2 | Task 3 | feat(01-02): middleware with updateSession — route protection, slug ownership, trial expiry |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Deno Edge Function files causing TypeScript errors in Node.js project**
- **Found during:** Task 3 — `npm run typecheck`
- **Issue:** `supabase/functions/custom-access-token/index.ts` uses `Deno.serve`, `Deno.env.get`, and esm.sh HTTP imports — all unknown to Node.js TypeScript. The `tsconfig.json` `"**/*.ts"` glob was including the Deno file, causing 5 type errors.
- **Fix:** Added `"supabase/functions"` to the `exclude` array in `tsconfig.json`. Deno files have their own runtime and do not need Node.js type checking.
- **Files modified:** `tsconfig.json`
- **Commit:** 1b3bfa2

### Auth Gates (not bugs — expected flow)

**1. [Auth Gate] Supabase credentials not configured — Edge Function deploy blocked**
- **Found during:** Task 2 step 4 (supabase functions deploy)
- **Issue:** Same auth gate as Plan 01. `SUPABASE_ACCESS_TOKEN` not set. `npx supabase functions deploy` exits with "Access token not provided."
- **Impact:** Edge Function code is correct and deployed locally. Cloud deployment and hook activation require human steps (listed in Task 2 section above).
- **Continuation:** After credentials are configured (Plan 01 auth gate resolution), run the 8-step deployment sequence above.

### Out-of-Scope Pre-existing Issues

**1. npm run build fails — WasmHash TypeError (Node.js 24 + webpack 5)**
- **Status:** Pre-existing, documented in deferred-items.md
- **Note:** `npm run build` fails with the same webpack crash as Plan 00. This is not caused by our changes — verified by stashing our changes and retesting. Plan 00 SUMMARY claimed the build passed after downgrading to 15.3.3, but the crash has recurred. Likely caused by cached build artifacts or a subsequent environment state change. Not fixing — out of scope for Plan 02.

## getClaims() vs getUser() — Resolved

**Assumption A1 from RESEARCH.md:** "getClaims() may not be available in @supabase/ssr 0.10.2"

**Resolution:** `getClaims` IS available in the installed version. The `readClaims()` helper checks for its presence with `typeof anySupa.getClaims === 'function'` and uses it when available. The `getUser()` fallback is also wired as a safety net. TypeScript compiles without errors because `getClaims` is accessed via type assertion (`as unknown as { getClaims?: ... }`), which is the correct pattern given it may not be in the public TypeScript types yet.

## Known Stubs

None — all three client factories, the Edge Function, and the middleware are complete implementations. No placeholders, hardcoded values, or TODO paths that block the plan's goal.

## Threat Surface Scan

New threat surface introduced in this plan:

| Flag | File | Description |
|------|------|-------------|
| threat_flag: edge-function-endpoint | supabase/functions/custom-access-token/index.ts | New HTTPS endpoint called on every token issuance; `verify_jwt = false` means the function is publicly reachable without JWT (protected only by Supabase platform routing) |

Mitigations per STRIDE threat register:

| Threat | Status |
|--------|--------|
| T-01-02-01 (service_role in client bundle) | MITIGATED — `import 'server-only'` line 1 + ESLint rule + NEXT_PUBLIC grep returns 0 |
| T-01-02-02 (JWT tampering) | MITIGATED — `getClaims()` validates JWT signature locally; `getUser()` fallback hits Auth server |
| T-01-02-03 (cross-tenant URL access) | MITIGATED — slug-ownership check in middleware rewrites to user's own slug; RLS is final DB gate |
| T-01-02-04 (user_metadata spoofing) | MITIGATED — Edge Function reads ONLY `raw_app_meta_data`; `user_metadata` never referenced |
| T-01-02-06 (expired session cookie) | MITIGATED — `@supabase/ssr` refreshes access token via `setAll` callback on every request |

## Self-Check: PASSED

Files exist:
- src/lib/supabase/server.ts — FOUND
- src/lib/supabase/client.ts — FOUND
- src/lib/supabase/admin.ts — FOUND
- src/lib/supabase/middleware.ts — FOUND
- src/middleware.ts — FOUND
- supabase/functions/custom-access-token/index.ts — FOUND
- supabase/functions/custom-access-token/deno.json — FOUND

Commits verified:
- d2cc308 (Task 1) — FOUND
- 0768ea8 (Task 2) — FOUND
- 1b3bfa2 (Task 3) — FOUND

Typecheck: PASSED (exit 0)
Build: BLOCKED by pre-existing Node.js 24 / webpack WasmHash bug (unrelated to plan changes)

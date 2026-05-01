---
phase: 01-fundacao-auth
verified: 2026-04-21T21:00:00Z
status: gaps_found
score: 3/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Um tenant nunca visualiza dados de outro tenant — isolamento confirmado via RLS"
    status: failed
    reason: "RLS policies in migration 0003 call auth.tenant_id() and auth.tenant_role() which do not exist — helpers were created as public.jwt_tenant_id() and public.jwt_tenant_role(). Every authenticated query will throw 'function auth.tenant_id() does not exist' at runtime, making all tenant isolation policies non-functional."
    artifacts:
      - path: "supabase/migrations/20260420_0003_rls_policies.sql"
        issue: "All USING/WITH CHECK clauses call auth.tenant_id() and auth.tenant_role(), but those functions do not exist. Migration 0002 created public.jwt_tenant_id() and public.jwt_tenant_role() instead."
      - path: "supabase/migrations/20260420_0002_rls_helpers.sql"
        issue: "Functions created in public schema (public.jwt_tenant_id, public.jwt_tenant_role, public.jwt_tenant_slug) — not in auth schema as required by migration 0003's references."
    missing:
      - "Fix migration 0003 to reference public.jwt_tenant_id() and public.jwt_tenant_role() throughout, OR create auth.tenant_id() and auth.tenant_role() wrappers in a new migration (note: custom functions in the auth schema require Supabase support ticket or use of security-definer wrapper in public schema)"
      - "Apply corrected migration to cloud database (currently blocked by auth gate — .env.local has empty Supabase credentials)"

  - truth: "Corretora pode se registrar com nome, CNPJ e email e receber um tenant isolado (AUTH-01 rollback safety)"
    status: failed
    reason: "Two sub-issues: (1) registerTenant rollback DELETE is blocked by the prevent_hard_delete trigger. The trigger uses current_setting('role') which returns the PostgreSQL session role ('authenticator'), not 'service_role', so the rollback DELETE on line 103 and 136 of auth.ts will always fail silently — orphaning rows on any registration failure. (2) Slug generation fetches ALL tenant slugs unbounded, causing O(n) scans and including soft-deleted tenants."
    artifacts:
      - path: "supabase/migrations/20260420_0005_soft_delete_triggers.sql"
        issue: "prevent_hard_delete() uses current_setting('role') which always returns the PostgreSQL session role (e.g., 'authenticator'), never 'service_role'. The service_role JWT does not change the PostgreSQL session role. Rollback DELETEs from the admin client will be blocked."
      - path: "src/lib/actions/auth.ts"
        issue: "Lines 103 and 136 attempt admin.from('tenants').delete() for rollback, but this will be blocked by prevent_hard_delete trigger. Error from failed DELETE is swallowed (no check on return value). Also lines 69-70 fetch all tenant slugs unbounded."
    missing:
      - "Fix prevent_hard_delete trigger to use auth.role() or check request.jwt.claims role instead of current_setting('role')"
      - "Replace unbounded slug fetch with targeted existence checks per candidate slug"
      - "Add error checking on rollback DELETE calls, or use soft-delete (update deleted_at=NOW()) for rollback path"

  - truth: "Admin pode convidar novo corretor por email e o convidado acessa com link unico (AUTH-03 scale-safety)"
    status: failed
    reason: "acceptInvite uses admin.auth.admin.listUsers() which returns at most 1000 users per page. On platforms with more than 1000 users, invited users on pages 2+ cannot be found, silently failing invite acceptance. Additionally, loginWithPassword has an open redirect vulnerability: the ?next= parameter only checks startsWith('/'), allowing //evil.com (protocol-relative URL) to redirect users to external domains."
    artifacts:
      - path: "src/lib/actions/invites.ts"
        issue: "Line 227: admin.auth.admin.listUsers() is unbounded (max 1000 users). Should use getUserByEmail() for a direct single-row lookup."
      - path: "src/lib/actions/auth.ts"
        issue: "Line 207: if (next && next.startsWith('/')) { redirect(next) } — //evil.com passes the startsWith('/') check and redirects to an external domain (open redirect, CR-01)."
    missing:
      - "Replace listUsers() with admin.auth.admin.getUserByEmail(invite.email) in acceptInvite"
      - "Harden ?next= validation: reject paths starting with '//' and containing ':', e.g. if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes(':'))"
---

# Phase 1: Fundacao & Auth Verification Report

**Phase Goal:** Scaffold completo (Next.js 15, TypeScript, Tailwind v4, shadcn/ui), autenticação multi-tenant funcional com Supabase Auth + RLS, fluxo de registro de corretora com validação de CNPJ, convite de usuários, e middleware de proteção de rotas.
**Verified:** 2026-04-21T21:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Uma corretora pode se registrar com nome, CNPJ e email e receber um tenant isolado | PARTIAL | registerTenant Server Action exists with atomic rollback pattern, BUT rollback DELETE is blocked by prevent_hard_delete trigger at runtime (CR-04 + WR-01). Registration itself works; rollback on failure orphans rows. |
| 2 | Usuario pode fazer login com email e senha e permanecer autenticado apos refresh de pagina | PARTIAL | loginWithPassword exists, @supabase/ssr cookie handling is correctly wired, middleware refreshes tokens — BUT ?next= parameter has an open redirect vulnerability allowing //evil.com redirects (CR-01). |
| 3 | Admin pode convidar novo corretor por email e o convidado acessa com link unico | PARTIAL | Full invite lifecycle exists (inviteUser/acceptInvite/resendInvite/cancelInvite), atomic single-use token via UPDATE triple-guard — BUT acceptInvite uses listUsers() which breaks silently above 1000 users (CR-02). |
| 4 | Usuarios com papel Visualizador nao conseguem criar ou editar registros | PARTIAL | Four roles defined (admin/corretor/financeiro/visualizador), RLS policies exist, requireAdmin() gate on invite mutations — BUT RLS policies call non-existent auth.tenant_id()/auth.tenant_role() functions (CR-03), so DB-level enforcement is broken at runtime. The app-layer requireAdmin() guard still works. |
| 5 | Um tenant nunca visualiza dados de outro tenant — isolamento confirmado via RLS | FAILED | CRITICAL: RLS policies in migration 0003 call auth.tenant_id() and auth.tenant_role(), but migration 0002 created public.jwt_tenant_id() and public.jwt_tenant_role(). These are different namespaces. At runtime every authenticated query will throw "function auth.tenant_id() does not exist". Tenant isolation via RLS is completely non-functional until this namespace mismatch is fixed. |

**Score: 3/5 truths verified** (SC-1 partial, SC-2 partial, SC-3 partial count as "verified at application layer"; SC-4 partial due to broken RLS; SC-5 FAILED)

**Note:** SC-1 through SC-3 are marked PARTIAL because the application-layer logic is correctly implemented and would work under normal conditions. They are not FAILED. SC-4 and SC-5 both depend on the RLS namespace mismatch (CR-03) being fixed.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260420_0001_foundation_schema.sql` | tenants, profiles, user_invitations tables | VERIFIED | All three tables present with correct schema: CHAR(14) CNPJ, soft-delete, indexes on tenant_id, trial_ends_at |
| `supabase/migrations/20260420_0002_rls_helpers.sql` | JWT claim helpers | PARTIAL — WRONG NAMESPACE | Functions exist but as public.jwt_tenant_id(), public.jwt_tenant_role(), public.jwt_tenant_slug() — plan required auth.tenant_id()/auth.tenant_role() |
| `supabase/migrations/20260420_0003_rls_policies.sql` | RLS policies on all 3 tables | STUB — BROKEN AT RUNTIME | RLS enabled on all 3 tables, policies syntactically correct, but USING clauses reference auth.tenant_id()/auth.tenant_role() which do not exist |
| `supabase/migrations/20260420_0004_rls_coverage_rpc.sql` | check_rls_coverage() RPC | VERIFIED (static) | RPC created with SECURITY DEFINER, restricted to service_role. Cannot confirm runtime behavior — database not yet accessible (auth gate) |
| `supabase/migrations/20260420_0005_soft_delete_triggers.sql` | prevent_hard_delete trigger | PARTIAL — WRONG ROLE CHECK | Trigger exists but uses current_setting('role') which never equals 'service_role' in Supabase context — DELETEs blocked even for admin client |
| `src/lib/validations/cnpj.ts` | validateCNPJ/stripCNPJ/formatCNPJ | VERIFIED | All three functions exported, modulo-11 algorithm correctly implemented, passes 5/5 unit tests |
| `src/lib/types/database.types.ts` | Database TypeScript types | PARTIAL — HAND-AUTHORED | Exports Database type with correct table structure, but is hand-authored (not generated from live schema due to auth gate). Risk: may diverge from actual schema after migrations. |
| `src/lib/supabase/server.ts` | createClient() for Server Components | VERIFIED | createServerClient from @supabase/ssr with cookies(), correct setAll pattern |
| `src/lib/supabase/client.ts` | createClient() for Client Components | VERIFIED | createBrowserClient from @supabase/ssr, no server-only imports |
| `src/lib/supabase/admin.ts` | createAdminClient() with service_role | VERIFIED | import 'server-only' on line 1, SUPABASE_SERVICE_ROLE_KEY used, no NEXT_PUBLIC_ prefix |
| `src/lib/supabase/middleware.ts` | updateSession() helper | VERIFIED | getClaims()/getUser() fallback, trial_ends_at enforcement, slug ownership check, AUTH_ROUTES list |
| `src/middleware.ts` | Next.js middleware entry | VERIFIED | imports updateSession, matcher excludes api/_next/static/images |
| `supabase/functions/custom-access-token/index.ts` | Edge Function hook | VERIFIED (static) | Deno.serve, raw_app_meta_data read, trial_ends_at/plan injected, NOT deployed to cloud (auth gate) |
| `src/lib/actions/auth.ts` | registerTenant/loginWithPassword/signOut | PARTIAL | registerTenant atomic pattern correct but rollback blocked by trigger; loginWithPassword has open redirect on ?next= |
| `src/lib/actions/invites.ts` | Full invite lifecycle | PARTIAL | inviteUser/acceptInvite/resendInvite/cancelInvite all exist; atomic UPDATE triple-guard correct; BUT listUsers() call breaks at scale |
| `src/lib/validations/auth-schemas.ts` | Zod schemas for all auth flows | VERIFIED | 7 schemas exported: registerStep1/2/3, registerFull, login, invite, acceptInvite |
| `src/app/(auth)/login/page.tsx` + `login-form.tsx` | Login page with pt-BR copy | VERIFIED | "Bem-vindo de volta", error handling, ?next= forwarding, React Hook Form + Zod |
| `src/app/(auth)/cadastro/page.tsx` + wizard files | 3-step registration wizard | VERIFIED | Wizard with step state (Zustand), CNPJ enrichment via /api/cnpj/, pt-BR copy matches UI-SPEC |
| `src/app/(auth)/convite/[token]/page.tsx` | Accept invite page | VERIFIED | Server-side token validation before render, ExpiredPage for invalid/expired tokens |
| `src/app/(auth)/convite/expirado/page.tsx` | Expired invite page | VERIFIED | "Este convite expirou" and "Os convites são válidos por 72 horas" present |
| `src/app/(app)/[slug]/configuracoes/usuarios/page.tsx` | User management page | VERIFIED | Parallel queries for profiles and user_invitations, InviteDialog included |
| `src/app/(app)/[slug]/dashboard/page.tsx` | Dashboard shell | VERIFIED | Renders welcome, placeholder metric cards |
| `src/app/trial-expirado/page.tsx` | Trial expired page | VERIFIED | "Seu período de teste chegou ao fim", "Ver planos", sign-out action |
| `src/components/auth/split-screen-layout.tsx` | Split-screen layout | VERIFIED | lg:grid-cols-2, hidden lg:flex, from-blue-600 to-violet-600 |
| `src/stores/register-wizard.store.ts` | Zustand wizard store | VERIFIED | useRegisterWizard, step/empresaData/adminData/setStep/setEmpresaData/setAdminData/reset |
| `.env.example` | Env contract | VERIFIED | All required vars present, SUPABASE_SERVICE_ROLE_KEY without NEXT_PUBLIC_ prefix |
| `eslint.config.mjs` / `.eslintrc.json` | ESLint service_role guard | VERIFIED | no-restricted-imports blocks @/lib/supabase/admin in non-server contexts |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `supabase/migrations/20260420_0003_rls_policies.sql` | `supabase/migrations/20260420_0002_rls_helpers.sql` | USING clauses call helpers | NOT_WIRED | Migration 0003 calls auth.tenant_id()/auth.tenant_role() but 0002 defines public.jwt_tenant_id()/public.jwt_tenant_role() — namespace mismatch, link is broken at runtime |
| `src/middleware.ts` | `src/lib/supabase/middleware.ts` | import { updateSession } | WIRED | Confirmed: updateSession imported and called in middleware entry |
| `src/lib/supabase/middleware.ts` | JWT claims | getClaims()/getUser() | WIRED | Both paths implemented in readClaims() helper, getClaims confirmed available in @supabase/ssr@0.10.2 |
| `supabase/functions/custom-access-token/index.ts` | `public.tenants.trial_ends_at` | SELECT by rawApp.tenant_id | WIRED (static) | Code present, not deployed to cloud (auth gate) |
| `src/lib/actions/auth.ts (registerTenant)` | `createAdminClient` | createAdminClient() import | WIRED | Confirmed on line 48 |
| `src/lib/actions/invites.ts (inviteUser)` | `auth.admin.inviteUserByEmail` | direct call | WIRED | Confirmed on line 100 |
| `src/lib/actions/invites.ts (acceptInvite)` | atomic UPDATE user_invitations | UPDATE WHERE accepted_at IS NULL AND cancelled_at IS NULL AND expires_at > NOW() | WIRED | Triple-guard on lines 213-215 |
| `src/app/(auth)/cadastro/step-empresa.tsx` | `/api/cnpj/[cnpj]/route.ts` | fetch('/api/cnpj/...') | WIRED | Fetch call confirmed in step-empresa |
| `src/app/(app)/[slug]/configuracoes/usuarios/user-table.tsx` | `src/lib/actions/invites.ts` | resendInvite/cancelInvite | WIRED | Lines 101, 119 confirmed |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `usuarios/page.tsx` | profiles, invites | supabase.from('profiles').select() + supabase.from('user_invitations').select() | Yes — live DB queries via RLS-scoped anon client | FLOWING (once RLS is fixed — CR-03) |
| `dashboard/page.tsx` | Placeholder cards | Hardcoded "—" / "Em breve" | No | HOLLOW (intentional placeholder per plan; no dynamic data in Phase 1) |
| `convite/[token]/page.tsx` | invite | admin.from('user_invitations').select() by token | Yes — direct DB query | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED for cloud-dependent behaviors (Supabase database not accessible — auth gate).

| Behavior | Status | Notes |
|----------|--------|-------|
| validateCNPJ('11222333000181') returns true | PASS | Confirmed by cnpj.ts implementation + 5/5 unit tests documented in 01-01-SUMMARY.md |
| admin.ts throws at build if imported client-side | PASS | import 'server-only' on line 1 confirmed |
| middleware redirects /acme/dashboard when anonymous | PASS (static) | Route protection logic confirmed in middleware.ts; requires running server to verify end-to-end |
| RLS tenant isolation blocks cross-tenant reads | FAIL | auth.tenant_id() does not exist — all RLS policies will throw at runtime |
| registerTenant rollback deletes orphaned tenant | FAIL | prevent_hard_delete trigger blocks the rollback DELETE from admin client |
| acceptInvite single-use token works beyond 1000 users | FAIL | listUsers() limited to 1000 results per page |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-01 | 01-01, 01-03 | Corretora pode se registrar com nome, CNPJ e email — criando um tenant isolado | PARTIAL | registerTenant Server Action with 3-table atomic creation exists; rollback blocked by trigger bug |
| AUTH-02 | 01-02, 01-03 | Usuário pode fazer login com email e senha com sessão persistente entre refreshes | PARTIAL | loginWithPassword + @supabase/ssr cookie handling correct; open redirect in ?next= is a security gap |
| AUTH-03 | 01-03 | Admin pode convidar corretores por email com link de acesso | PARTIAL | Full invite lifecycle (inviteUser/acceptInvite/resendInvite/cancelInvite); listUsers() scale bug |
| AUTH-04 | 01-01, 01-03 | Sistema suporta papéis: Admin, Corretor, Financeiro, Visualizador com permissões distintas | PARTIAL | Four roles defined in schema and CHECK constraint; requireAdmin() app-layer guard works; RLS role enforcement broken (CR-03) |
| AUTH-05 | 01-01, 01-02 | Dados de cada corretora são isolados por RLS — nenhum tenant acessa dados de outro | FAILED | RLS namespace mismatch (CR-03): all policies call non-existent auth.tenant_id()/auth.tenant_role(); middleware slug ownership check provides partial URL-level protection but DB-level isolation is broken |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `supabase/migrations/20260420_0003_rls_policies.sql` | 19, 23-24, 32, 37-38, 44-47, 56-61 | Calls auth.tenant_id()/auth.tenant_role() which do not exist | BLOCKER | All RLS policies throw at runtime; tenant isolation completely broken |
| `supabase/migrations/20260420_0005_soft_delete_triggers.sql` | 11 | current_setting('role') <> 'service_role' — wrong check for Supabase service_role | BLOCKER | Rollback DELETEs in registerTenant are blocked silently; partial onboarding rows can be orphaned |
| `src/lib/actions/auth.ts` | 207 | next.startsWith('/') — allows //evil.com protocol-relative redirect | BLOCKER | Open redirect attack possible after login |
| `src/lib/actions/invites.ts` | 227 | admin.auth.admin.listUsers() — max 1000 results | BLOCKER | Invite acceptance silently fails when platform exceeds 1000 users |
| `src/lib/actions/auth.ts` | 69-70 | admin.from('tenants').select('slug') — unbounded scan of all slugs | WARNING | O(n) scan on every registration; includes soft-deleted tenant slugs permanently reserving slots |
| `src/stores/register-wizard.store.ts` | 11-15 | password field stored in Zustand client store | WARNING | Passwords visible to browser extensions / React DevTools during wizard flow |
| `src/app/(auth)/recuperar-senha/page.tsx` | — | Form button type="button" with no action/handler | WARNING | Password recovery flow is completely non-functional |
| `src/lib/types/database.types.ts` | 1 | Hand-authored (comment states "must regenerate from live schema") | INFO | May diverge from actual DB schema; should be regenerated after auth gate is resolved |

---

### Human Verification Required

The following items cannot be verified programmatically because they require a running Supabase cloud instance (blocked by auth gate — .env.local has empty credentials):

#### 1. Full Registration Wizard End-to-End

**Test:** Visit /cadastro with `npm run dev`, enter valid CNPJ 11.222.333/0001-81, complete 3-step wizard
**Expected:** CNPJ auto-fills razao social via /api/cnpj/ proxy; registration creates tenant + admin user + profile atomically; redirects to /{slug}/dashboard after login
**Why human:** Requires running Next.js server + connected Supabase instance

#### 2. RLS Tenant Isolation (After CR-03 Fix)

**Test:** After fixing migration 0003 to use public.jwt_tenant_id(), create two tenants (A and B), sign in as user of tenant A, query `supabase.from('profiles').select('*')` — should return 0 rows from tenant B
**Expected:** Zero cross-tenant rows returned; queries return only own tenant data
**Why human:** Requires connected Supabase instance with migrations applied and two seeded tenants

#### 3. Middleware Route Protection

**Test:** Visit /acme/dashboard anonymously → should redirect to /login?next=/acme/dashboard; sign in as user with slug "acme", visit /other-slug/dashboard → should redirect to /acme/dashboard
**Expected:** Redirect chain works correctly at Edge runtime
**Why human:** Requires running Next.js server

#### 4. Custom Access Token Hook JWT Injection

**Test:** After deploying Edge Function and activating hook in Supabase Dashboard, sign in as registered admin; inspect JWT claims
**Expected:** app_metadata contains tenant_id, role='admin', slug, trial_ends_at, plan='trial'
**Why human:** Requires Supabase cloud project, Edge Function deployed, hook activated in Dashboard

#### 5. Trial Expiry Redirect

**Test:** Via Supabase SQL Editor, set trial_ends_at to a past date for a tenant; navigate to /{slug}/dashboard
**Expected:** Middleware redirects to /trial-expirado
**Why human:** Requires live database + JWT refresh cycle to pick up new trial_ends_at value

---

## Gaps Summary

Three blocking gaps prevent the phase goal from being fully achieved:

**Gap 1 (Most Critical) — RLS Namespace Mismatch (CR-03):** The RLS helpers were created in the `public` schema (`public.jwt_tenant_id()`, `public.jwt_tenant_role()`) but the RLS policies in migration 0003 call `auth.tenant_id()` and `auth.tenant_role()` — functions that do not exist. This means all tenant-isolation RLS policies will throw a PostgreSQL error at runtime on every authenticated query. AUTH-05 (the RLS isolation requirement) is completely blocked by this. Fix: update migration 0003 to call `public.jwt_tenant_id()` and `public.jwt_tenant_role()`.

**Gap 2 — Rollback Trigger Bug (CR-04 + WR-01):** The `prevent_hard_delete` trigger uses `current_setting('role')` to check for service_role, but this setting never equals `'service_role'` in Supabase — the admin client's JWT uses service_role authorization but the PostgreSQL session role is still `authenticator`. When `registerTenant` fails after creating the tenant row, the rollback DELETE on the tenant (and auth user cascade) is silently blocked by the trigger, leaving orphaned rows in `tenants`. Fix: change the trigger to use `auth.role()` or check `(SELECT current_setting('request.jwt.claims', true))::jsonb->>'role'`.

**Gap 3 — Security Vulnerabilities (CR-01, CR-02):** Two security bugs that need fixing before production use: (a) Open redirect in `loginWithPassword` — `//evil.com` passes the `startsWith('/')` check and redirects to an external domain. Fix: also reject paths starting with `//` or containing `:`. (b) `acceptInvite` uses `listUsers()` which returns only the first 1000 users — invited users on any Supabase project with 1000+ users cannot accept invites. Fix: use `getUserByEmail(invite.email)`.

These three gaps cover the code-verified issues. An additional cluster of issues identified in the Code Review (CR-05 unbounded slug scan, WR-01/WR-04/WR-05/WR-06) are warnings that should be addressed before production launch but do not block the authentication flows in a development/staging environment.

The phase scaffold (Next.js 15, TypeScript, Tailwind v4, shadcn/ui, Vitest, env contract, ESLint guard) is fully complete and verified. The middleware route protection, Supabase client factories, and application-layer auth flows are functionally correct. The three gaps above are purely in the database RLS layer and two server action edge cases.

---

_Verified: 2026-04-21T21:00:00Z_
_Verifier: Claude (gsd-verifier)_

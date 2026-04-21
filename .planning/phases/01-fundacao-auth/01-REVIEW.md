---
phase: 01-fundacao-auth
reviewed: 2026-04-21T00:00:00Z
depth: standard
files_reviewed: 40
files_reviewed_list:
  - src/lib/supabase/server.ts
  - src/lib/supabase/client.ts
  - src/lib/supabase/admin.ts
  - src/lib/supabase/middleware.ts
  - src/middleware.ts
  - src/lib/actions/auth.ts
  - src/lib/actions/invites.ts
  - src/lib/validations/auth-schemas.ts
  - src/lib/validations/cnpj.ts
  - src/lib/utils/slug.ts
  - src/lib/types/database.types.ts
  - src/stores/register-wizard.store.ts
  - src/app/(auth)/login/login-form.tsx
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/cadastro/wizard.tsx
  - src/app/(auth)/cadastro/step-empresa.tsx
  - src/app/(auth)/cadastro/step-usuario.tsx
  - src/app/(auth)/cadastro/step-plano.tsx
  - src/app/(auth)/cadastro/page.tsx
  - src/app/(auth)/convite/[token]/accept-form.tsx
  - src/app/(auth)/convite/[token]/page.tsx
  - src/app/(auth)/convite/expirado/page.tsx
  - src/app/(auth)/layout.tsx
  - src/app/(auth)/recuperar-senha/page.tsx
  - src/app/(app)/layout.tsx
  - src/app/(app)/[slug]/dashboard/page.tsx
  - src/app/(app)/[slug]/configuracoes/usuarios/page.tsx
  - src/app/(app)/[slug]/configuracoes/usuarios/user-table.tsx
  - src/app/(app)/[slug]/configuracoes/usuarios/invite-dialog.tsx
  - src/app/trial-expirado/page.tsx
  - src/app/api/cnpj/[cnpj]/route.ts
  - src/components/auth/split-screen-layout.tsx
  - src/components/auth/brand-panel.tsx
  - src/components/auth/user-menu.tsx
  - src/components/auth/sidebar-shell.tsx
  - supabase/functions/custom-access-token/index.ts
  - supabase/migrations/20260420_0001_foundation_schema.sql
  - supabase/migrations/20260420_0002_rls_helpers.sql
  - supabase/migrations/20260420_0003_rls_policies.sql
  - supabase/migrations/20260420_0004_rls_coverage_rpc.sql
  - supabase/migrations/20260420_0005_soft_delete_triggers.sql
findings:
  critical: 5
  warning: 6
  info: 4
  total: 15
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 40
**Status:** issues_found

## Summary

This review covers the full authentication and multi-tenancy foundation for the NEXUS AGENT platform: Supabase client factory files, server actions for registration and invite acceptance, RLS migrations, the custom JWT hook, and all auth/app UI layers.

The overall architecture is sound and demonstrates good security instincts — `app_metadata` exclusivity for tenant claims, `server-only` guard on the admin client, atomic invite claiming via a conditional UPDATE, and per-tenant RLS isolation. However, five critical issues must be fixed before this layer is considered production-safe. The most severe is an open redirect in the login Server Action that allows an attacker to redirect any authenticated user to an arbitrary external domain. The second most severe is an unbounded `listUsers()` call in `acceptInvite` that will break at scale and leaks the existence of all platform users to the server action. The RLS policies also reference `auth.tenant_id()` / `auth.tenant_role()` functions that do not exist in the migration files as written (they call `public.jwt_tenant_*`), which would cause all policies to error at runtime.

---

## Critical Issues

### CR-01: Open Redirect in `loginWithPassword` — Unvalidated `?next=` Parameter

**File:** `src/lib/actions/auth.ts:207`

**Issue:** The `next` parameter is read from `FormData` (which originates from the query string in `login-form.tsx`) and redirected to after successful login. The only guard is `next.startsWith('/')`, but a URL like `//evil.com` or `//evil.com/path` starts with `/` and is treated as a protocol-relative URL by browsers, redirecting the user to an external domain. This is a standard open-redirect bypass.

```ts
// current — exploitable with next=//evil.com
if (next && next.startsWith('/')) {
  redirect(next)
}
```

**Fix:** Validate that `next` contains no protocol, host, or double-slash prefix. A safe allowlist approach:

```ts
function isSafeInternalPath(next: string): boolean {
  // Must start with / but NOT // (protocol-relative) and must not contain a protocol
  return (
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.includes(':')
  )
}

if (next && isSafeInternalPath(next)) {
  redirect(next)
}
```

---

### CR-02: `acceptInvite` Uses `listUsers()` — Full User Enumeration + O(n) Scan

**File:** `src/lib/actions/invites.ts:227`

**Issue:** After atomically claiming the invite row, the action fetches **all** auth users via `admin.auth.admin.listUsers()` (which is paginated but defaults to page 1, max 1000 users) and then does a client-side `.find()` to match the invited email. This has two problems:

1. **Correctness/scale bug:** `listUsers()` returns at most 1000 users per page. When the platform has more than 1000 users, invited users on pages 2+ will never be found, silently failing invite acceptance.
2. **Information exposure (defense in depth):** The full user list, including emails and metadata of all tenants on the platform, is loaded into memory in a Server Action during an unauthenticated flow (the invite recipient has no session yet). A memory dump or error log at this point exposes all user emails.

**Fix:** Use `getUserByEmail` instead of scanning the full list:

```ts
// Replace lines 227-235 with:
const { data: { users }, error: lookupErr } = await admin.auth.admin.listUsers({
  // getUserByEmail is the correct approach — no pagination issue
})
// Actually use the direct lookup:
const { data: userByEmail, error: lookupErr } = await admin.auth.admin.getUserByEmail(
  invite.email
)
if (lookupErr || !userByEmail?.user) {
  return { error: 'Usuário do convite não encontrado. Peça para o administrador reenviar o convite.' }
}
const authUser = userByEmail.user
```

Note: `admin.auth.admin.getUserByEmail(email)` is available in `@supabase/supabase-js` and performs a single server-side lookup by email. Use this instead of `listUsers()`.

---

### CR-03: RLS Policies Reference Non-Existent Functions `auth.tenant_id()` / `auth.tenant_role()`

**File:** `supabase/migrations/20260420_0003_rls_policies.sql:18-62`

**Issue:** Every RLS policy USING clause calls `auth.tenant_id()` and `auth.tenant_role()`, but migration `0002_rls_helpers.sql` creates those functions in the **`public`** schema as `public.jwt_tenant_id()`, `public.jwt_tenant_role()`, and `public.jwt_tenant_slug()`. There is no `auth.tenant_id` or `auth.tenant_role` function anywhere in the migration set. At runtime, every authenticated query will throw `ERROR: function auth.tenant_id() does not exist`, meaning **all RLS policies silently fail to protect data**.

**Fix:** Either rename the helpers in migration 0002 to live in `auth` schema (requires special permissions in Supabase — typically not allowed for custom functions), or — the correct approach — update all USING clauses in migration 0003 to use the `public.*` namespace:

```sql
-- In 0003_rls_policies.sql, replace all occurrences:
-- auth.tenant_id()  →  public.jwt_tenant_id()
-- auth.tenant_role()  →  public.jwt_tenant_role()

-- Example corrected policy:
CREATE POLICY "tenant_self_select" ON public.tenants
  FOR SELECT TO authenticated
  USING (id = (SELECT public.jwt_tenant_id()) AND deleted_at IS NULL);

CREATE POLICY "tenant_self_update" ON public.tenants
  FOR UPDATE TO authenticated
  USING (id = (SELECT public.jwt_tenant_id()) AND (SELECT public.jwt_tenant_role()) = 'admin')
  WITH CHECK (id = (SELECT public.jwt_tenant_id()));
```

Apply the same fix throughout the file for all six policy definitions. This is a blocking correctness issue — until fixed, RLS provides no tenant isolation.

---

### CR-04: `registerTenant` — CNPJ Uniqueness Check Has TOCTOU Race Condition

**File:** `src/lib/actions/auth.ts:51-66`

**Issue:** The action performs a SELECT to check CNPJ uniqueness, then INSERTs the tenant row as two separate operations. Between these two operations, a concurrent registration for the same CNPJ can succeed the SELECT check and also proceed to INSERT. Since the `tenants.cnpj` column has a `UNIQUE` constraint, the second INSERT will fail with a generic PostgreSQL error that the current code handles as a generic `_form` error ("Ocorreu um erro ao criar sua corretora"), leaking no information, but the rollback path then deletes an already-nonexistent tenant and swallows the error silently.

The actual severity here is primarily UX degradation (duplicate CNPJ shows a confusing message instead of the helpful one), not a security bypass, because the DB constraint does protect data integrity. However, in the rollback at line 103, `await admin.from('tenants').delete().eq('id', tenant.id)` is called **without checking its error**. If this DELETE fails (e.g., due to the soft-delete trigger in migration 0005), the orphaned tenant row is never cleaned up, leaving a permanently dangling row.

**Fix — two sub-issues:**

1. Check for a unique-constraint violation in the tenant INSERT error and return the friendly CNPJ message:

```ts
if (tenantErr || !tenant) {
  const isUniqueViolation = tenantErr?.code === '23505'
  if (isUniqueViolation && tenantErr?.message?.includes('cnpj')) {
    return { error: { cnpj: ['Este CNPJ já possui uma conta no NEXUS. Faça login ou recupere o acesso.'] } }
  }
  return { error: { _form: ['Ocorreu um erro ao criar sua corretora. Tente novamente.'] } }
}
```

2. The rollback DELETE at line 103 will be blocked by the `prevent_hard_delete` trigger if the caller is not `service_role`. The admin client uses `SUPABASE_SERVICE_ROLE_KEY`, so the trigger should pass — but the trigger checks `current_setting('role')` which is the PostgreSQL session role, not the JWT role. Confirm this trigger works correctly with the service role client (see WR-04 for the trigger issue).

---

### CR-05: `slug` Generation Fetches All Tenant Slugs Unfiltered — Denial of Service and Data Exposure Vector

**File:** `src/lib/actions/auth.ts:69-71`

**Issue:** The slug uniqueness check fetches `slug` from **all** tenants in the table with no filter, no limit, and no pagination:

```ts
const { data: slugRows } = await admin.from('tenants').select('slug')
const existingSlugs = (slugRows ?? []).map((r) => r.slug)
```

This means:
1. As the platform grows, this query returns an increasingly large payload on every registration.
2. The admin client (service role) bypasses RLS, so this returns slugs of soft-deleted tenants too — the `deleted_at IS NULL` filter is absent. A deleted tenant's slug is permanently reserved.
3. If `slugRows` is null due to a Supabase error (the error is silently discarded), `existingSlugs` becomes `[]`, and the generated slug may collide with an existing one, causing the subsequent INSERT to fail with a constraint violation.

**Fix:** Use an existence check for the specific candidate slug rather than fetching all slugs. Apply this pattern in the Server Action or move slug generation to a database function:

```ts
// Replace lines 69-71 with targeted existence checks:
async function isSlugTaken(admin: ReturnType<typeof createAdminClient>, slug: string): Promise<boolean> {
  const { data } = await admin
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  return data !== null
}

const base = generateSlug(companyName, [])
let slug = base
let i = 2
while (await isSlugTaken(admin, slug)) {
  slug = `${base}-${i++}`
}
```

---

## Warnings

### WR-01: `soft_delete` Trigger Role Check Uses `current_setting('role')` — Always Returns `''` for Admin Client

**File:** `supabase/migrations/20260420_0005_soft_delete_triggers.sql:10-12`

**Issue:** The trigger checks `current_setting('role') <> 'service_role'` to allow hard deletes by the admin client. However, `current_setting('role')` returns the **PostgreSQL session role** (e.g., `authenticator`, `anon`, `authenticated`), not the JWT role. When a Supabase service-role key is used, the session role is still `authenticator` or the internal Supabase role — not literally the string `'service_role'`. This means the trigger will **always fire** and block hard DELETEs even from the service role client. The rollback deletes in `auth.ts` (lines 103, 135, 136) will fail silently.

**Fix:** Use `auth.role()` which returns the role from the JWT context, or bypass the trigger differently for service-role operations. The standard Supabase pattern is:

```sql
-- Replace current_setting('role') with the JWT-aware check:
IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION '...';
END IF;
```

Alternatively, use `current_setting('request.jwt.claims', true)::jsonb->>'role'` to read the JWT role, consistent with how the helper functions work.

---

### WR-02: `acceptInvite` Does Not Verify the Atomic Claim Before Proceeding — Partial Rollback on `updateUserById` Failure Leaves Claimed Invite in Limbo

**File:** `src/lib/actions/invites.ts:209-260`

**Issue:** The invite is atomically claimed by setting `accepted_at` on line 210. If any subsequent step fails (lines 244-265: `updateUserById`, `upsert` profile, or `signInWithPassword`), the function returns an error to the user but does not reset `accepted_at` to `NULL`. The invite link is now permanently consumed, yet the user account was never properly configured. The user cannot re-use the invite link (it appears "already used") and has no path to recovery short of asking an admin for a new invite.

This is not catastrophic (no data loss, no security breach), but it is an unhandled partial-failure scenario that will frustrate real users.

**Fix:** Wrap the post-claim steps in a try/catch and reset `accepted_at` on failure:

```ts
// After successful atomic claim, wrap subsequent steps:
try {
  // ... updateUserById, upsert profile, signInWithPassword
} catch {
  // Unclaim the invite so the user can try again
  await admin
    .from('user_invitations')
    .update({ accepted_at: null })
    .eq('id', invite.id)
  return { error: 'Erro inesperado ao ativar conta. Tente novamente.' }
}
```

---

### WR-03: `?next=` Parameter Passed Through Login Page Without Sanitization in Server Component

**File:** `src/app/(auth)/login/page.tsx:8`, `src/app/(auth)/login/login-form.tsx:43`

**Issue:** The `next` query parameter from `searchParams` is passed directly to `LoginForm` as a prop and then placed into a hidden `FormData` field without any validation in the page component. While the Server Action does validate it (and CR-01 covers the bypass), the raw unsanitized string is reflected in the form and passed to the action. If CR-01 is fixed in the action, this becomes defense-in-depth; but if the page-level component ever renders `next` into the DOM (e.g., for a "redirecting to..." message), it would be an XSS vector since `next` is user-controlled.

**Fix:** Sanitize `next` at the page component level before passing it to `LoginForm`:

```ts
// In page.tsx:
const rawNext = (await searchParams).next
const next = rawNext?.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes(':')
  ? rawNext
  : undefined
return <LoginForm next={next} />
```

---

### WR-04: `recuperar-senha` Page Has No Server Action — Password Reset Is Completely Non-Functional

**File:** `src/app/(auth)/recuperar-senha/page.tsx:27`

**Issue:** The "Recuperar senha" page renders a form with a button of `type="button"` (not `type="submit"`) and no `action` or `onClick` handler. The email input has no associated state or submission logic. Clicking "Enviar link de recuperação" does nothing. This is a non-functional critical auth flow that users will encounter when they lose their password.

**Fix:** Implement the Server Action:

```ts
// Add server action in src/lib/actions/auth.ts:
export async function resetPassword(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const email = formData.get('email')?.toString()
  if (!email || !z.string().email().safeParse(email).success) {
    return { error: 'E-mail inválido.' }
  }
  const supabase = await createClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/redefinir-senha`,
  })
  // Always return success to prevent account enumeration
  return { success: true }
}
```

---

### WR-05: `users/page.tsx` — Pending Invites Query Fetches Across All Tenants Under Broken RLS

**File:** `src/app/(app)/[slug]/configuracoes/usuarios/page.tsx:8-19`

**Issue:** The page uses `createClient()` (anon key + user JWT) and queries `user_invitations` without any explicit `.eq('tenant_id', ...)` filter. This is intentionally delegated to RLS. However, given CR-03 (the RLS policies reference non-existent `auth.*` functions), these queries will either error out or — worse, if Supabase treats a missing function as returning NULL — return rows across all tenants. Once CR-03 is fixed, this query pattern is correct and safe.

Additionally, even with correct RLS in place, the current query has no `.is('expires_at', '...')` filter to exclude expired invites — a user sees "Convite pendente" for invites that expired 70+ hours ago. This is a UX bug, but it also means the table presents misleading data (invites that can no longer be accepted).

**Fix — UX only (after CR-03 is resolved):** Add an expiry filter:

```ts
supabase
  .from('user_invitations')
  .select('id, email, role, expires_at')
  .is('accepted_at', null)
  .is('cancelled_at', null)
  .gt('expires_at', new Date().toISOString())  // exclude expired
```

---

### WR-06: `registerTenant` Wizard Stores Password in Zustand Client Store

**File:** `src/stores/register-wizard.store.ts:11-15`, `src/app/(auth)/cadastro/step-usuario.tsx:37-44`

**Issue:** When the user completes Step 2, `setAdminData()` stores `password` and `passwordConfirm` in the Zustand store, which persists in memory for the entire browser session. This data is then read back from the store in `step-plano.tsx` (line 37-40) and submitted to the Server Action. Zustand state is accessible to any browser extension, script, or debugging tool that can access the React DevTools or `window.__zustand` internals. Passwords should never live in client-side state stores beyond the local form component.

**Fix:** Do not persist the password fields in the store. Instead, pass them via a hidden form or use React context scoped to the wizard. The cleanest fix is to keep the password in `step-usuario.tsx` local state only and pass it forward through a React context:

```ts
// In the store, remove password fields:
interface AdminData {
  adminName: string
  email: string
  // no password fields in store
}

// In step-usuario.tsx, use a ref or callback to pass password to step-plano
// without storing it in global state
```

---

## Info

### IN-01: `custom-access-token` Edge Function — `_user_id` Parameter Is Unused

**File:** `supabase/functions/custom-access-token/index.ts:14`

**Issue:** The destructuring `const { user_id: _user_id, claims } = body` renames `user_id` to `_user_id` indicating intentional discard. However, the function does a DB query on `rawApp.tenant_id` without cross-verifying that this `tenant_id` actually belongs to the user identified by `user_id`. If the `app_metadata` has an incorrect `tenant_id` (e.g., due to a prior partial write), the JWT will embed trial data for the wrong tenant. Using `user_id` to verify ownership adds defense in depth.

**Note:** This is low-priority given that `app_metadata` is only writable server-side, but worth adding the cross-check for auditability.

---

### IN-02: `slug.ts` — Unicode Diacritic Stripping Regex Is Fragile

**File:** `src/lib/utils/slug.ts:15`

**Issue:** The regex `/[̀-ͯ]/g` is intended to strip Unicode combining diacritics after NFD normalization, but this character class range (`U+0300` to `U+036F`) is correct for the Basic Latin combining marks block. However, the range is expressed as literal characters in source code which may render incorrectly if the file encoding is not strictly UTF-8, or if the source is copied through certain editors. The regex also does not handle characters outside the basic Latin/extended-Latin block (e.g., Chinese, Arabic), which could produce an empty slug that falls back to `'corretora'`.

**Fix:** Use the Unicode property escape for robustness:

```ts
.replace(/\p{M}/gu, '')  // Remove all Unicode combining marks (requires ES2018+)
```

---

### IN-03: `cnpj/route.ts` — Error Detail Leaks Internal Error String in Production

**File:** `src/app/api/cnpj/[cnpj]/route.ts:68`

**Issue:** On timeout/exception, the response includes `detail: String(err)` which may expose internal stack traces, library versions, or environment paths if the error is not a simple `AbortError`. This is acceptable in development but should be stripped in production.

**Fix:**

```ts
// Only include detail in non-production environments:
const detail = process.env.NODE_ENV !== 'production'
  ? (isTimeout ? 'timeout' : String(err))
  : undefined
return NextResponse.json({ error: '...', ...(detail ? { detail } : {}) }, { status: 504 })
```

---

### IN-04: `acceptInvite` Token Is Passed as a URL Path Segment — Tokens With Special Characters Could Cause Routing Issues

**File:** `src/lib/actions/invites.ts:99`, `supabase/migrations/20260420_0001_foundation_schema.sql:47`

**Issue:** The invite token is generated as `encode(extensions.gen_random_bytes(32), 'hex')` — 64 hex characters — which contains only `[0-9a-f]` and is safely URL-embeddable. This is correct and no action is needed. Noted as informational to confirm the token format is intentionally hex and not base64 (base64 uses `+`, `/`, `=` which require URL encoding).

No fix needed. This is a confirmation that the current design is correct.

---

_Reviewed: 2026-04-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

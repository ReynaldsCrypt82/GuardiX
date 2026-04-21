---
phase: 01-fundacao-auth
fixed_at: 2026-04-21T19:34:15Z
review_path: .planning/phases/01-fundacao-auth/01-REVIEW.md
iteration: 1
fix_scope: critical_warning
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-04-21T19:34:15Z
**Source review:** .planning/phases/01-fundacao-auth/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (5 Critical + 6 Warning)
- Fixed: 11
- Skipped: 0

## Fixed Issues

### CR-01: Open Redirect in loginWithPassword

**Files modified:** `src/lib/actions/auth.ts`
**Commit:** 682df42
**Applied fix:** Added `isSafeInternalPath()` guard function that rejects any `next` value starting with `//` or containing `:`. The check runs before `redirect(next)` in `loginWithPassword`.

---

### CR-02: acceptInvite Uses listUsers()

**Files modified:** `src/lib/actions/invites.ts`
**Commit:** e657283
**Applied fix:** Replaced `admin.auth.admin.listUsers()` + client-side `.find()` with a direct `admin.auth.admin.getUserByEmail(invite.email)` call. Eliminates the O(n) scan, the 1000-user pagination cap, and the full user-list memory exposure.

---

### CR-03: RLS Policies Reference Non-Existent auth.tenant_id() / auth.tenant_role() Functions

**Files modified:** `supabase/migrations/20260420_0003_rls_policies.sql`
**Commit:** fbac67d
**Applied fix:** Replaced all occurrences of `auth.tenant_id()` with `public.jwt_tenant_id()` and all occurrences of `auth.tenant_role()` with `public.jwt_tenant_role()` throughout the file (6 USING/WITH CHECK clauses across 5 policies). The `auth.uid()` call on the `profiles_update_admin_or_self` policy was intentionally preserved as it is a real Supabase built-in.

---

### CR-04: registerTenant CNPJ Uniqueness TOCTOU + Silent Rollback Failure

**Files modified:** `src/lib/actions/auth.ts`
**Commit:** b12e07e
**Applied fix:**
1. Added detection of PostgreSQL error code `23505` on the tenant INSERT and returns the friendly CNPJ-already-exists message instead of the generic `_form` error.
2. Added error checking on both rollback DELETE calls (after createUser failure and after profile INSERT failure) — failures are now logged via `console.error` with the affected IDs rather than silently swallowed.

---

### CR-05: Slug Generation Fetches All Tenant Slugs

**Files modified:** `src/lib/actions/auth.ts`
**Commit:** 1db4237
**Applied fix:** Added a private `isSlugTaken(admin, slug)` helper that performs a single `.select('id').eq('slug', slug).maybeSingle()` existence check. Replaced the unbounded `select('slug')` fetch with a `generateSlug(companyName, [])` base-slug call followed by a `while (await isSlugTaken(...))` loop that increments a suffix counter.

---

### WR-01: prevent_hard_delete Trigger Uses current_setting('role')

**Files modified:** `supabase/migrations/20260420_0005_soft_delete_triggers.sql`
**Commit:** d43cd91
**Applied fix:** Replaced `current_setting('role') <> 'service_role'` with `auth.role() IS DISTINCT FROM 'service_role'` to use the JWT-aware role check that correctly reflects the Supabase service-role context.

---

### WR-02: acceptInvite Doesn't Reset accepted_at on Post-Claim Failure

**Files modified:** `src/lib/actions/invites.ts`
**Commit:** 5d66a3e
**Applied fix:** Added an `unclaimInvite()` inner helper that resets `accepted_at` to `null`. It is called before each error return in the post-claim steps (`updateUserById` failure, profile `upsert` failure). The `signInWithPassword` failure path intentionally does not unclaim since at that point the account is fully configured — it redirects to manual login instead.

---

### WR-03: ?next= Not Sanitized at Page Level

**Files modified:** `src/app/(auth)/login/page.tsx`
**Commit:** 8652811
**Applied fix:** Added sanitization of `rawNext` in the page Server Component before passing to `LoginForm`. Values that start with `//` or contain `:` are replaced with `undefined`. This is defense-in-depth on top of the CR-01 fix in the Server Action.

---

### WR-04: recuperar-senha Has No Server Action

**Files modified:** `src/lib/actions/auth.ts`, `src/app/(auth)/recuperar-senha/page.tsx`
**Commit:** 0239a88
**Applied fix:**
1. Added `resetPassword` Server Action to `auth.ts` that calls `supabase.auth.resetPasswordForEmail` with a `redirectTo` pointing to `/redefinir-senha`. Always returns `{ success: true }` to prevent account enumeration. Uses `z.string().email()` validation via the top-level `zod` import (also added).
2. Rewrote `recuperar-senha/page.tsx` as a Client Component with `useState`/`useTransition` for pending and success states. The form now uses `action={handleSubmit}`, the button is `type="submit"`, the input has `name="email"`, and a success screen renders after the action returns.

---

### WR-05: user_invitations Query Missing Expiry Filter

**Files modified:** `src/app/(app)/[slug]/configuracoes/usuarios/page.tsx`
**Commit:** cfcadda
**Applied fix:** Added `.gt('expires_at', new Date().toISOString())` to the `user_invitations` query so expired invites are excluded from the users page display.

---

### WR-06: Password Stored in Zustand Store

**Files modified:** `src/stores/register-wizard.store.ts`, `src/app/(auth)/cadastro/wizard.tsx`, `src/app/(auth)/cadastro/step-usuario.tsx`, `src/app/(auth)/cadastro/step-plano.tsx`
**Commit:** 52d4857
**Applied fix:**
1. Removed `password` and `passwordConfirm` from the `AdminData` interface in the Zustand store. `setAdminData` now only accepts `adminName` and `email`.
2. Added `WizardPasswordContext` to `wizard.tsx` — exported context backed by a `useRef` so mutations never trigger re-renders and the value is never serialised into global state.
3. `StepUsuario` now keeps password fields in local React Hook Form state only. On submit it calls `setPassword(values.password)` from context and stores only `adminName`/`email` in the Zustand store.
4. `StepPlano` reads `password` from `WizardPasswordContext` and passes it to the Server Action FormData. The `passwordConfirm` field is set to the same value (the confirmation was already validated in step 2).

---

## Skipped Issues

None — all 11 in-scope findings were fixed.

---

_Fixed: 2026-04-21T19:34:15Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

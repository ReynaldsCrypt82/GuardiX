---
phase: 1
slug: fundacao-auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` (none — Wave 0 installs) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && npx tsc --noEmit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run && npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | AUTH-01 | T-1-01 | Tenant record created atomically with admin user | unit | `npx vitest run tests/auth/onboarding.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 0 | AUTH-01 | T-1-02 | CNPJ validation rejects invalid check digits | unit | `npx vitest run tests/auth/cnpj.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | AUTH-02 | T-1-03 | Session persists across page refresh (cookie-based) | e2e | `npx vitest run tests/auth/session.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | AUTH-03 | T-1-04 | Invite link creates user only once (token consumed) | unit | `npx vitest run tests/auth/invite.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | AUTH-04 | T-1-05 | Viewer role blocked from write operations (RLS) | unit | `npx vitest run tests/auth/rbac.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 2 | AUTH-05 | T-1-06 | Cross-tenant data isolation (RLS policy test) | unit | `npx vitest run tests/auth/rls-isolation.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-03 | 03 | 2 | AUTH-05 | T-1-07 | No public table without RLS (CI gate check) | build | `npx vitest run tests/db/rls-coverage.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/auth/onboarding.test.ts` — stubs for AUTH-01 (tenant + admin creation)
- [ ] `tests/auth/cnpj.test.ts` — CNPJ digit validation logic
- [ ] `tests/auth/session.test.ts` — cookie session persistence
- [ ] `tests/auth/invite.test.ts` — invite token single-use
- [ ] `tests/auth/rbac.test.ts` — role-based access control
- [ ] `tests/auth/rls-isolation.test.ts` — cross-tenant isolation
- [ ] `tests/db/rls-coverage.test.ts` — CI gate: all tables have RLS
- [ ] `vitest.config.ts` — vitest setup with TypeScript support

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin convida corretor por email e o convidado acessa link unico | AUTH-03 | Requer envio real de email via Resend | Registrar corretora, convidar usuario, verificar email recebido, clicar no link, confirmar acesso |
| Sessao expira apos periodo de trial | AUTH-02 | Requer manipulacao de tempo | Definir `trial_ends_at` no passado via admin, tentar acessar area protegida, confirmar redirect |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

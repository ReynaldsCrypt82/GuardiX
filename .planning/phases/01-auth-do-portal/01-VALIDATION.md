---
phase: 1
slug: auth-do-portal
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-04
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (já instalado no projeto v1.0) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | PORTAL-AUTH-01 | T-1-01 | portal_clients RLS blocks cross-tenant access | unit | `npx vitest run src/lib/__tests__/portal-rls.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 0 | PORTAL-AUTH-02 | T-1-02 | CPF verification only matches within tenant | unit | `npx vitest run src/lib/__tests__/portal-signup.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | PORTAL-AUTH-03 | T-1-03 | portal_client JWT blocked outside /portal/** | unit | `npx vitest run src/lib/__tests__/portal-middleware.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | PORTAL-AUTH-04 | — | internal user JWT blocked inside /portal/** | unit | `npx vitest run src/lib/__tests__/portal-middleware.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/portal-rls.test.ts` — stubs para isolamento RLS portal_clients
- [ ] `src/lib/__tests__/portal-signup.test.ts` — stubs para verificação CPF no cadastro
- [ ] `src/lib/__tests__/portal-middleware.test.ts` — stubs para separação de sessão no middleware

*Framework Vitest já instalado — sem instalações adicionais necessárias.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Login portal completo no browser | PORTAL-AUTH-01 | Requer Supabase conectado em produção | Acessar /{slug}/portal/login, fazer login com credenciais criadas |
| Auto-cadastro com CPF real | PORTAL-AUTH-02 | Requer cliente com CPF cadastrado no banco | Acessar /{slug}/portal/cadastro, digitar CPF existente, criar conta |
| Sessão expirada redireciona para login | PORTAL-AUTH-03 | Requer controle de tempo de sessão | Aguardar expiração ou limpar cookies manualmente |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

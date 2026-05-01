---
phase: 2
slug: crm-clientes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 + @testing-library/react 16 |
| **Config file** | `vitest.config.ts` (raiz do projeto — já configurado Phase 1) |
| **Quick run command** | `npx vitest run tests/validations/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/validations/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-W0-01 | 01 | 0 | CRM-01, CRM-08 | T-02-03 | validateCPF rejeita inválidos e all-same | unit | `npx vitest run tests/validations/cpf.test.ts` | ❌ W0 | ⬜ pending |
| 02-W0-02 | 01 | 0 | CRM-01, CRM-02, CRM-05, CRM-09 | T-02-01, T-02-02 | createClientAction valida docs, RBAC stage change | unit | `npx vitest run tests/actions/clients.test.ts` | ❌ W0 | ⬜ pending |
| 02-W0-03 | 01 | 0 | CRM-06, CRM-07 | T-02-04 | createTask prazo obrigatório; getOverdueTasks filtra correto | unit | `npx vitest run tests/actions/tasks.test.ts` | ❌ W0 | ⬜ pending |
| 02-W0-04 | 01 | 0 | CRM-01, RBAC | T-02-01 | Corretor só lê seus próprios clientes (RLS) | integration | `npx vitest run tests/db/rls-clients.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/validations/cpf.test.ts` — stubs para CRM-01, CRM-08 (validateCPF, stripCPF, formatCPF)
- [ ] `tests/actions/clients.test.ts` — stubs para CRM-01, CRM-02, CRM-05, CRM-09
- [ ] `tests/actions/tasks.test.ts` — stubs para CRM-06, CRM-07
- [ ] `tests/db/rls-clients.test.ts` — isolamento RBAC de clientes (padrão de `tests/db/rls-coverage.test.ts`)

*Framework já instalado — nenhuma nova dependência de dev necessária.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Toggle PF/PJ muda campos corretamente no formulário | CRM-01, CRM-02 | DOM interaction state — difícil em unit test sem browser | Clicar toggle, verificar CPF↔CNPJ, nome↔razão social |
| Dropdown inline de estágio na tabela funciona | CRM-05 | Interação de DOM inline na tabela | Clicar badge de estágio, selecionar novo, verificar atualização sem reload |
| Badge de notificação aparece ao abrir sistema com tarefa vencida | CRM-07 | Requer estado de banco + render de layout | Criar tarefa com `due_date = ontem`, recarregar página, verificar badge |
| Toast de tarefa vencendo ao abrir sistema | CRM-07 | Side effect de render — não testável em unit | Mesmo setup acima, verificar toast no canto da tela |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

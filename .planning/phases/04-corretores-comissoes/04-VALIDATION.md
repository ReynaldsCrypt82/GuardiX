---
phase: 4
slug: corretores-comissoes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-26
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + jsdom |
| **Config file** | `vitest.config.ts` (raiz do projeto) |
| **Quick run command** | `npm test -- --run tests/utils/commission-rate.test.ts tests/actions/commission-entries.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run tests/utils/commission-rate.test.ts tests/actions/commission-entries.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | COM-01 | T-4-06 / T-4-01 | `upsertBrokerProfileAction` retorna erro para role !== 'admin' | unit | `npm test -- --run tests/actions/broker-profiles.test.ts` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 1 | COM-01 | T-4-05 | Zod safeParse rejeita `commission_rate_default > 1` | unit | `npm test -- --run tests/actions/broker-profiles.test.ts` | ❌ W0 | ⬜ pending |
| 4-01-03 | 01 | 1 | COM-02 | T-4-01 | `createPartnerAction` retorna erro para role !== 'admin' | unit | `npm test -- --run tests/actions/partners.test.ts` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 1 | COM-03 | T-4-03 | `resolveCommissionRate` retorna override quando presente | unit | `npm test -- --run tests/utils/commission-rate.test.ts` | ❌ W0 | ⬜ pending |
| 4-02-02 | 02 | 1 | COM-03 | T-4-03 | `resolveCommissionRate` retorna default quando override ausente | unit | `npm test -- --run tests/utils/commission-rate.test.ts` | ❌ W0 | ⬜ pending |
| 4-02-03 | 02 | 1 | COM-03 | T-4-03 | `resolveCommissionRate` usa prefixo `consorcio_` para cotas | unit | `npm test -- --run tests/utils/commission-rate.test.ts` | ❌ W0 | ⬜ pending |
| 4-02-04 | 02 | 1 | COM-04 | T-4-02 | `markCommissionPaidAction` insere 1 entry para corretor sem parceiro | unit | `npm test -- --run tests/actions/commission-entries.test.ts` | ❌ W0 | ⬜ pending |
| 4-02-05 | 02 | 1 | COM-04 | T-4-02 | `markCommissionPaidAction` insere 2 entries quando há parceiro (D-06) | unit | `npm test -- --run tests/actions/commission-entries.test.ts` | ❌ W0 | ⬜ pending |
| 4-02-06 | 02 | 1 | COM-04 | T-4-02 | `markCommissionPaidAction` retorna erro se `commission_paid_at` já preenchido | unit | `npm test -- --run tests/actions/commission-entries.test.ts` | ❌ W0 | ⬜ pending |
| 4-02-07 | 02 | 1 | COM-04 | T-4-07 | `registerEstornoAction` insere entry com `amount` negativo e `entry_type='estorno'` | unit | `npm test -- --run tests/actions/commission-entries.test.ts` | ❌ W0 | ⬜ pending |
| 4-02-08 | 02 | 1 | COM-05 | — | `commission_entries` filtradas por `reference_month` retornam apenas entradas do mês | unit | `npm test -- --run tests/actions/commission-entries.test.ts` | ❌ W0 | ⬜ pending |
| 4-03-01 | 03 | 2 | COM-06 | T-4-04 | Redirect para próprio dashboard quando corretor tenta acessar outro `broker_id` | manual | Teste de navegação no browser | N/A | ⬜ pending |
| 4-04-01 | 04 | 2 | COM-06 | T-4-05 | Tenant isolation: corretor de tenant A não vê dados de tenant B | manual | Teste com duas sessões no browser | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/utils/commission-rate.test.ts` — stubs para resolução de taxa (COM-03)
- [ ] `tests/actions/broker-profiles.test.ts` — stubs para RBAC e validação (COM-01)
- [ ] `tests/actions/partners.test.ts` — stubs para CRUD de parceiros (COM-02)
- [ ] `tests/actions/commission-entries.test.ts` — stubs para mark paid, estorno, correção, idempotência (COM-04, COM-05)

*Todos os arquivos seguem o padrão de `tests/actions/policies.test.ts`: `vi.mock('@/lib/supabase/server', ...)` + `vi.mock('next/cache', ...)` + helper `makeFormData()`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Redirect para próprio dashboard quando corretor acessa `/[slug]/corretores/[outro-id]` | COM-06 | Requer sessão autenticada com role=corretor | 1. Login como usuário com `role='corretor'`; 2. Navegar para URL de outro corretor; 3. Verificar redirect para `/[slug]/corretores/[proprio-id]` |
| `commission_entries` não pode ser editado via UI | COM-04 | Requer verificação visual — nenhum campo editável deve aparecer na tabela de relatório | 1. Registrar uma comissão; 2. Navegar para aba Relatório; 3. Confirmar que apenas leitura está disponível |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

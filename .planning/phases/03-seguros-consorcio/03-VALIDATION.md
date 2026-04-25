---
phase: 3
slug: seguros-consorcio
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.x + @testing-library/react 16.x |
| **Config file** | `vitest.config.ts` (raiz do projeto) |
| **Quick run command** | `npx vitest run tests/utils/vigencia.test.ts tests/actions/policies.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/utils/vigencia.test.ts tests/actions/policies.test.ts tests/actions/claims.test.ts tests/actions/consortium.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green + `npm run typecheck` passing
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | SEG-02 | — | N/A | unit | `npx vitest run tests/utils/vigencia.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 0 | SEG-01 | T-corretor-scope | Server Action rejeita corretor atribuindo apólice a outro | unit | `npx vitest run tests/actions/policies.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 0 | SEG-04 | T-tenant-isolation | claims insert exige tenant_id do JWT | unit | `npx vitest run tests/actions/claims.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-04 | 01 | 0 | SEG-05 | — | N/A | unit | `npx vitest run tests/actions/endorsements.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-05 | 01 | 0 | CON-01 | — | N/A | unit | `npx vitest run tests/actions/consortium.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-06 | 01 | 0 | RLS | T-tenant-isolation | Tenant A nunca vê apólices do Tenant B | integration (stub) | `npx vitest run tests/db/rls-seguros.test.ts` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | SEG-01 | T-jsonb-injection | type_data JSONB só aceita campos validados pelo Zod | unit | `npx vitest run tests/actions/policies.test.ts` | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 1 | SEG-01 | — | N/A | unit | `npx vitest run tests/actions/policies.test.ts` | ❌ W0 | ⬜ pending |
| 3-02-03 | 02 | 1 | SEG-06 | — | N/A | unit | `npx vitest run tests/actions/policies.test.ts` | ❌ W0 | ⬜ pending |
| 3-02-04 | 02 | 1 | SEG-07 | — | N/A | unit | `npx vitest run tests/actions/policies.test.ts` | ❌ W0 | ⬜ pending |
| 3-02-05 | 02 | 1 | SEG-03 | — | N/A | unit | `npx vitest run tests/actions/policies.test.ts` | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 1 | CON-02 | — | N/A | unit | `npx vitest run tests/actions/consortium.test.ts` | ❌ W0 | ⬜ pending |
| 3-03-02 | 03 | 1 | CON-03 | — | N/A | unit | `npx vitest run tests/actions/consortium.test.ts` | ❌ W0 | ⬜ pending |
| 3-03-03 | 03 | 1 | CON-04 | — | N/A | unit | `npx vitest run tests/actions/consortium.test.ts` | ❌ W0 | ⬜ pending |
| 3-03-04 | 03 | 1 | CON-05 | T-null-assembly | next_assembly_date IS NULL não crashar alerta | unit | `npx vitest run tests/actions/consortium.test.ts` | ❌ W0 | ⬜ pending |
| 3-03-05 | 03 | 1 | CON-06 | — | N/A | unit | `npx vitest run tests/actions/consortium.test.ts` | ❌ W0 | ⬜ pending |
| 3-04-01 | 04 | 2 | SEG-02 | — | VigenciaBadge renderiza cor correta | manual | — | N/A | ⬜ pending |
| 3-04-02 | 04 | 2 | CON-05 | — | Toast alerta aparece ao abrir sistema | manual | — | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/utils/vigencia.test.ts` — cobre SEG-02 (getVigenciaStatus — função pura crítica)
- [ ] `tests/actions/policies.test.ts` — cobre SEG-01, SEG-03, SEG-06, SEG-07
- [ ] `tests/actions/claims.test.ts` — cobre SEG-04
- [ ] `tests/actions/endorsements.test.ts` — cobre SEG-05
- [ ] `tests/actions/consortium.test.ts` — cobre CON-01, CON-02, CON-03, CON-05, CON-06
- [ ] `tests/db/rls-seguros.test.ts` — stubs de isolamento RLS (padrão `it.todo(...)`)

**Mocks necessários (mesmo padrão de tests/actions/clients.test.ts):**
- `vi.mock('@/lib/supabase/server')` — mock do cliente Supabase
- `vi.mock('next/cache')` — mock de `revalidatePath`
- `vi.mock('next/headers')` — alias já configurado em vitest.config.ts

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| VigenciaBadge exibe cor verde/amarela/vermelha corretamente | SEG-02 | Requer renderização visual no browser | Cadastrar 3 apólices com vigência_fim: hoje+90d, hoje+45d, hoje+15d — verificar cores na listagem |
| Toast de alerta de assembleia aparece ao abrir o sistema | CON-05 | Requer interação com sistema real + DB com dado real | Criar grupo com next_assembly_date = hoje+2d — abrir o sistema e verificar toast |
| Formulário dinâmico troca campos ao mudar tipo de seguro | SEG-01 | Requer interação com formulário no browser | Selecionar Auto (campos placa/chassi), trocar para Vida (campos beneficiários) — verificar campos mudam |
| Aba Apólices na tela do cliente exibe apólices vinculadas | SEG-07 | Requer dados reais de cliente + apólice | Criar apólice vinculada a cliente X — abrir tela do cliente X e verificar aba Apólices |
| Aba Consórcio na tela do cliente exibe cotas vinculadas | CON-02 | Requer dados reais | Criar cota vinculada a cliente X — abrir tela do cliente X e verificar aba Consórcio |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

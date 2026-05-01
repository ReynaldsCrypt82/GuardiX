---
phase: 6
slug: dashboards-relatorios
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | `vitest.config.ts` (raiz do projeto) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | DASH-01 | — | N/A | unit | `npm test -- tests/utils/dashboard-queries.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | DASH-02 | — | N/A | unit | `npm test -- tests/utils/dashboard-queries.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | DASH-03 | — | N/A | unit | `npm test -- tests/utils/dashboard-queries.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-04 | 01 | 1 | DASH-09 | T-06-01 | corretor é redirecionado; visualizador recebe 404 | unit | `npm test -- tests/utils/dashboard-queries.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | DASH-04 | T-06-02 | export rejeita roles não autorizados (403); valida slug; whitelist type | integration | manual (requer Supabase real) | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/utils/dashboard-queries.test.ts` — stubs para DASH-01, DASH-02, DASH-03, DASH-09 (mock Supabase client, lógica de agrupamento e RBAC)
- [ ] Framework já configurado — Vitest + mocks de `next/headers` e `next/navigation` já existem no projeto

*Infraestrutura existente cobre o restante dos requisitos da phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Route Handler de export retorna arquivo .xlsx válido | DASH-04 | Requer Supabase real + exceljs em runtime | Acessar `/api/[slug]/export?type=apolices` autenticado como admin; verificar download de .xlsx com dados corretos |
| Export respeita filtros ativos da listagem | DASH-04 (D-08) | Requer browser + filtros ativos em UI | Filtrar /seguros por seguradora X, clicar Exportar Excel, verificar que .xlsx contém apenas apólices da seguradora X |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

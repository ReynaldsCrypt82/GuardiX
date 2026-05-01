---
phase: 06-dashboards-relatorios
plan: 01
subsystem: dashboard-helpers
tags: [dashboard, helpers, tests, wave0, exceljs, vitest]
dependency_graph:
  requires: []
  provides: [exceljs@4.4.0, dashboard-queries-helpers, wave0-tests]
  affects: [06-02-PLAN, 06-03-PLAN]
tech_stack:
  added: [exceljs@4.4.0]
  patterns: [pure-helper-functions, vitest-unit-tests, date-fns-pt-BR]
key_files:
  created:
    - src/lib/utils/dashboard-queries.ts
    - tests/utils/dashboard-queries.test.ts
  modified:
    - package.json
    - package-lock.json
decisions:
  - exceljs@4.4.0 escolhido vs xlsx@0.18.5 (CVE-2023-30533 + pacote inativo)
  - parseSelectedMonth aceita today injetavel para testes deterministicos
  - ALLOWED_EXPORT_TYPES como const tuple readonly — nao pode ser estendida em runtime
metrics:
  duration: 15m
  completed: 2026-04-30
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 06 Plan 01: Dashboard Helpers + Wave 0 Tests Summary

**One-liner:** Fundacao Wave 1 da Phase 6 — exceljs 4.4.0 instalado e 5 helpers puros de dashboard (agregacao, dedup, parse de mes, RBAC, whitelist export) com suite Vitest de 23 testes cobrindo DASH-01/02/03/09.

## What Was Built

### Novo Pacote

| Pacote | Versao | Motivo |
|--------|--------|--------|
| exceljs | 4.4.0 | xlsx@0.18.5 (npm publico) tem CVE-2023-30533 (prototype pollution) e esta inativo. exceljs 4.4.0 publicado 2024-12-20, ativo, API fluente server-side. |

**Instalacao verificada:**
```
npm ls exceljs
`-- exceljs@4.4.0
```

### Simbolos Exportados de `src/lib/utils/dashboard-queries.ts`

| Simbolo | Tipo | Proposito |
|---------|------|-----------|
| `aggregateBrokerRanking` | function | Agrega comissoes + producao por corretor — 1 linha por profile, ordenado DESC commission/production/nome |
| `dedupeClientIds` | function | Dedup de IDs de cliente de multiplas fontes (policies + quotas) retornando Set<string> |
| `parseSelectedMonth` | function | Parse de monthParam YYYY-MM com fallback graceful e locale pt-BR |
| `isExecutiveRole` | function | RBAC whitelist — true apenas para 'admin' e 'financeiro' |
| `ALLOWED_EXPORT_TYPES` | const | `['apolices', 'clientes', 'comissoes'] as const` — whitelist do Route Handler de export |
| `BrokerRankingRow` | type | Shape de uma linha do ranking de corretores |
| `AllowedExportType` | type | `'apolices' | 'clientes' | 'comissoes'` derivado do const |
| `ProfileRow` | type | Shape de linha de perfil (id + full_name) |
| `CommissionRow` | type | Shape de entrada de comissao (broker_id + amount) |
| `ProductionRow` | type | Shape de entrada de producao (assigned_to) |

### Suite de Testes `tests/utils/dashboard-queries.test.ts`

**Resultado:**
```
npm test -- tests/utils/dashboard-queries.test.ts

 ✓ tests/utils/dashboard-queries.test.ts (23 tests) 85ms

 Test Files  1 passed (1)
       Tests  23 passed (23)
    Duration  15.98s (transform 334ms, setup 609ms, collect 12.41s, tests 85ms)
```

**Cobertura por requisito:**

| Requisito | Descricao | Testes |
|-----------|-----------|--------|
| DASH-01 | KPI cards — parseSelectedMonth | 4 casos (undefined fallback, mes valido, invalido, label pt-BR) |
| DASH-02 | Ranking de corretores — aggregateBrokerRanking | 7 casos (ordenacao, tiebreaks, 0/0, string coerce, multiplos, ghost broker) |
| DASH-03 | Alertas / dedup carteira — dedupeClientIds | 3 casos (vazio, null, dedup cross-fonte) |
| DASH-09 | RBAC — isExecutiveRole | 7 casos (admin/financeiro true, corretor/visualizador/null/undefined/'' false) |
| Whitelist | ALLOWED_EXPORT_TYPES | 2 casos (length=3, contem 3 tipos esperados) |

**Total: 23 testes, 0 falhas, execucao em 85ms.**

## Decisions Made

1. **exceljs@4.4.0 sobre xlsx@0.18.5** — security decision; xlsx tem CVE-2023-30533 e status inativo no npm
2. **`today` injetavel em `parseSelectedMonth`** — permite testes deterministicos sem mocking de Date
3. **`as const` em ALLOWED_EXPORT_TYPES** — readonly tuple TypeScript; Plan 03 importa exatamente esta whitelist sem poder estende-la em runtime
4. **Helpers 100% puros (sem Supabase)** — testavel em isolamento, reutilizavel em Plan 02 (dashboard page) e Plan 03 (Route Handler de export)

## Deviations from Plan

None — plano executado exatamente como especificado.

## Known Stubs

None — todos os helpers implementados com logica real; nenhum valor placeholder ou hardcoded vazio.

## Threat Surface Scan

Nenhuma nova superficie de seguranca introduzida neste plano. Os helpers sao funcoes puras sem acesso a rede, banco ou sistema de arquivos.

Mitigacoes aplicadas conforme threat_model do plano:
- **T-06-01a:** `isExecutiveRole` usa whitelist explicita — qualquer valor desconhecido retorna `false`
- **T-06-01b:** `ALLOWED_EXPORT_TYPES` e `as const` readonly — testado para length=3
- **T-06-01c:** `parseSelectedMonth` valida com `isValid()` e faz fallback silencioso sem throw

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/lib/utils/dashboard-queries.ts | FOUND |
| tests/utils/dashboard-queries.test.ts | FOUND |
| exceljs in package.json | FOUND |
| Commit a4ca069 (feat helpers) | FOUND |
| Commit aec7e08 (test suite) | FOUND |

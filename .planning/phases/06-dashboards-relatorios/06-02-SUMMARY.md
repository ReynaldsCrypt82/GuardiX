---
phase: 06-dashboards-relatorios
plan: 02
subsystem: dashboard
tags: [dashboard, kpis, rbac, server-component, shadcn, supabase, alert, ranking]

requires:
  - phase: 06-01
    provides: [isExecutiveRole, parseSelectedMonth, aggregateBrokerRanking, ProfileRow, CommissionRow, ProductionRow]
  - phase: 04-corretores-comissoes
    provides: [StatCard, MonthSelector, commission_entries schema]
  - phase: 05-financeiro
    provides: [financial_entries schema, RBAC notFound/redirect pattern, try/catch graceful pattern]
provides:
  - Painel Executivo em /[slug]/dashboard com 4 KPIs reais + 3 alertas + ranking de corretores
  - AlertSection Server Component com grid 3 colunas (vencendo/cobrancas/assembleias)
  - BrokerRankingTable Server Component com tabela shadcn ordenada por comissao DESC
affects: [06-03-PLAN]

tech-stack:
  added: []
  patterns:
    - server-component-rbac: notFound para visualizador, redirect para corretor, continua para admin/financeiro
    - try-catch-graceful-per-block: cada bloco de query isolado — falha nao propaga para outros cards
    - parallel-queries-with-limit: alertas usam .limit(5) + count:exact para badge de totalCount
    - pitfall-vigencia: policies nao tem campo status — "ativa" = vigencia_fim >= hoje + deleted_at IS NULL

key-files:
  created:
    - src/components/dashboard/alert-section.tsx
    - src/components/dashboard/broker-ranking-table.tsx
  modified:
    - src/app/(app)/[slug]/dashboard/page.tsx

key-decisions:
  - "D-09 RBAC: corretor redireciona para proprio dashboard, visualizador recebe notFound — padrao identico ao financeiro/page.tsx"
  - "Queries de KPI em try/catch individuais: cada card tem fallback 0/R$0,00 independente, sem Promise.all — mais robusto contra falhas parciais"
  - "AlertSection recebe dados via props (sem fetch interno): facilita teste e reutilizacao"
  - "reference_month filtrado como DATE yyyy-MM-dd (monthStartStr), nao yyyy-MM (monthValue) — Pitfall 2"

patterns-established:
  - "Dashboard page: RBAC guard antes de qualquer query, fallback graceful por bloco, props-down para componentes"
  - "Componentes de dashboard sem fetch interno: dados calculados no page.tsx e passados como props"

requirements-completed: [DASH-01, DASH-02, DASH-03]

duration: 20m
completed: 2026-05-01
---

# Phase 06 Plan 02: Dashboard Executivo Summary

**Painel Executivo real para admin/financeiro: 4 KPI cards com dados Supabase, 3 listas de alertas (vencendo/cobrancas/assembleias) e ranking de corretores com RBAC por role — substitui placeholder stub.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-05-01T01:04:00Z
- **Completed:** 2026-05-01T01:24:26Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Painel Executivo `/[slug]/dashboard` reescrito como Server Component com RBAC D-09: corretor redireciona para `/corretores/{user.id}`, visualizador recebe 404, admin e financeiro veem conteudo identico (D-10)
- 4 KPI cards com dados reais: Apolices ativas (vigencia_fim >= hoje), Receita do periodo (paid_at no mes selecionado), Inadimplencia (pending + vencido), Vencendo em 30 dias — MonthSelector URL-driven controla receita/inadimplencia/ranking (D-03)
- 2 novos Server Components: `AlertSection` (3 cards lado a lado com Badge colorido, max 5 itens, link "Ver todos") e `BrokerRankingTable` (tabela shadcn com corretor/producao/comissao ordenada por comissao DESC)

## Task Commits

1. **Task 1: AlertSection e BrokerRankingTable (Server Components)** - `55dccd5` (feat)
2. **Task 2: Reescrever /[slug]/dashboard — Server Component executivo com RBAC** - `14131cb` (feat)

## Files Created/Modified

- `src/components/dashboard/alert-section.tsx` — Server Component: grid 3 colunas com cards de alertas; Badge variants: outline+amber (vencendo), destructive (cobrancas), secondary (assembleias); empty state "Nenhum item."; links "Ver todos" por categoria
- `src/components/dashboard/broker-ranking-table.tsx` — Server Component: Card + tabela shadcn com corretor/producao/comissao; formatBRL via Intl; empty state; link por corretor para /corretores/{id}
- `src/app/(app)/[slug]/dashboard/page.tsx` — Substituiu placeholder: RBAC D-09, 4 KPIs, AlertSection, BrokerRankingTable, MonthSelector, queries paralelas com try/catch graceful

## Copy Strings (UI-SPEC fidelidade)

Strings literais usadas conforme UI-SPEC / must_haves:

| Componente | String |
|------------|--------|
| page.tsx | "Painel Executivo" |
| page.tsx | "Bem-vindo, {fullName}. Visao consolidada da corretora." |
| page.tsx | "Apolices ativas" |
| page.tsx | "Receita do periodo" |
| page.tsx | "Inadimplencia" |
| page.tsx | "Vencendo em 30 dias" |
| alert-section.tsx | "Apolices vencendo ({totalCount})" |
| alert-section.tsx | "Cobrancas em atraso ({totalCount})" |
| alert-section.tsx | "Assembleias proximas ({totalCount})" |
| alert-section.tsx | "Nenhum item." |
| alert-section.tsx | "Ver todas as apolices →" |
| alert-section.tsx | "Ver lancamentos →" |
| alert-section.tsx | "Ver grupos de consorcio →" |
| broker-ranking-table.tsx | "Ranking de Corretores — {monthLabel}" |
| broker-ranking-table.tsx | "Producao do mes" |
| broker-ranking-table.tsx | "Comissao (R$)" |
| broker-ranking-table.tsx | "Nenhum corretor com producao neste periodo." |

## Tabelas Supabase Consultadas e RLS

| Tabela | Operacao | RLS aplicada |
|--------|----------|--------------|
| `profiles` | SELECT (full_name, role) | tenant_id = current_user_tenant() |
| `policies` | SELECT (count, id, policy_number, vigencia_fim, client:clients(name), assigned_to, created_at) | tenant_id = current_user_tenant() |
| `financial_entries` | SELECT (amount, id, description, due_date) | tenant_id = current_user_tenant() |
| `commission_entries` | SELECT (broker_id, amount) com reference_month = monthStartStr | tenant_id = current_user_tenant() |
| `consortium_groups` | SELECT (id, administrator, next_assembly_date) | tenant_id = current_user_tenant() |

Todas as queries usam `createClient()` com cookies do usuario logado — `service_role` nao exposto. RLS garante isolamento cross-tenant automaticamente.

## RBAC Testado

| Role | Comportamento | Implementado em |
|------|---------------|-----------------|
| admin | Renderiza Painel Executivo completo | `if (!isExecutiveRole(role)) notFound()` — passa |
| financeiro | Idem admin (D-10 — mesmo conteudo) | `isExecutiveRole('financeiro') === true` |
| corretor | `redirect(/${slug}/corretores/${user.id})` | `if (role === 'corretor') redirect(...)` |
| visualizador | `notFound()` (404) | `if (role === 'visualizador') notFound()` |
| desconhecido | `notFound()` (defesa em profundidade) | `if (!isExecutiveRole(role)) notFound()` |

## Decisions Made

1. **Queries individuais com try/catch em vez de Promise.all**: Preferido sobre `Promise.all` para que falha de uma query (ex: tabela ainda nao existente em dev) nao quebre a pagina inteira. Cada card tem fallback 0/R$0,00 isolado. Padrao identico ao `[slug]/layout.tsx`.

2. **`reference_month` como `monthStartStr` (yyyy-MM-dd)**: Pitfall 2 documentado no RESEARCH.md — campo DATE no Postgres armazena primeiro dia do mes. Passado como `month.monthStartStr`, nao `month.monthValue`.

3. **Receita filtrada por `paid_at`**: Pitfall 3 — "Receita do periodo" = entradas efetivamente pagas no mes, filtradas por `paid_at TIMESTAMPTZ`, nao por `due_date`. Representa receita realizada.

4. **"Apolices ativas" sem campo `status`**: Pitfall 1 — tabela `policies` nao tem campo `status`. Ativa = `vigencia_fim >= hoje AND deleted_at IS NULL`.

5. **AlertSection como Server Component com props**: Dados calculados no `page.tsx` e passados via props — sem fetch interno no componente. Facilita teste unitario e composicao.

## Deviations from Plan

None — plano executado exatamente como especificado.

## Known Stubs

None — todos os dados vem de queries reais ao Supabase. Fallback graceful (0/vazio) e comportamento intencional para queries que falham, nao stub de desenvolvimento.

## Threat Surface Scan

Mitigacoes aplicadas conforme threat_model do plano 06-02:

| Threat ID | Mitigacao | Status |
|-----------|-----------|--------|
| T-06-10 | RBAC: `visualizador → notFound()` + `!isExecutiveRole(role) → notFound()` (defesa em profundidade) | APLICADO |
| T-06-11 | Ranking exibe todos corretores do tenant para admin/financeiro — RLS limita ao tenant, sem cross-tenant | ACEITO (design) |
| T-06-12 | `parseSelectedMonth` valida com `isValid()` — input invalido cai em mes corrente sem throw | APLICADO (Plan 01) |
| T-06-13 | `createClient()` SSR com cookies — RLS ativo, sem service_role exposto | APLICADO |
| T-06-14 | Alertas com `.limit(5)`, KPIs com `head:true` | APLICADO |
| T-06-15 | try/catch por bloco — fallback graceful por card | APLICADO |

Nenhuma nova superficie de seguranca introduzida alem do previsto no threat_model.

## Issues Encountered

None.

## User Setup Required

None — nenhuma configuracao externa necessaria. Componentes usam Supabase RLS existente.

## Next Phase Readiness

- Plan 03 (Export Excel) pode comecar: `ALLOWED_EXPORT_TYPES` e helpers do Plan 01 ja disponiveis
- Dashboard executivo esta completo para admin e financeiro
- Rota `/[slug]/dashboard` nao e mais um placeholder — retorna conteudo real para todos os 4 roles conforme D-09

---

## Self-Check

| Item | Status |
|------|--------|
| src/components/dashboard/alert-section.tsx | FOUND |
| src/components/dashboard/broker-ranking-table.tsx | FOUND |
| src/app/(app)/[slug]/dashboard/page.tsx (reescrito) | FOUND |
| Commit 55dccd5 (Task 1 — Server Components) | FOUND |
| Commit 14131cb (Task 2 — dashboard page rewrite) | FOUND |
| tsc --noEmit: 44 erros pre-existentes, 0 novos | PASSED |
| npm test: 186 passing, 1 pre-existing TODO fail (rls-isolation) | PASSED |

## Self-Check: PASSED

*Phase: 06-dashboards-relatorios*
*Completed: 2026-05-01*

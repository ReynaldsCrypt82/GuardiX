---
phase: 06-dashboards-relatorios
verified: 2026-04-30T23:15:00Z
status: human_needed
score: 7/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Admin abre /{slug}/dashboard e visualiza 4 KPI cards com valores numericos reais (nao zeros)"
    expected: "Cards 'Apolices ativas', 'Receita do periodo', 'Inadimplencia', 'Vencendo em 30 dias' exibem valores do banco de dados do tenant"
    why_human: "Requer Supabase conectado com dados reais para validar que as queries retornam dados e nao zeros por erro de RLS ou schema"
  - test: "Corretor autenticado tenta acessar /{slug}/dashboard"
    expected: "Redirect automatico para /{slug}/corretores/{user.id}"
    why_human: "Comportamento de redirect requer sessao autenticada e navegador real"
  - test: "Visualizador autenticado tenta acessar /{slug}/dashboard"
    expected: "Pagina 404"
    why_human: "Comportamento de notFound() requer sessao autenticada e navegador real"
  - test: "Mudar ?month=YYYY-MM na URL do dashboard"
    expected: "Cards 'Receita do periodo' e 'Inadimplencia' e tabela de ranking refletem o mes informado"
    why_human: "MonthSelector e URL-driven — requer navegador real"
  - test: "Admin clica 'Exportar Excel' em /seguros e baixa arquivo"
    expected: "Arquivo apolices.xlsx e baixado, abre no Excel/LibreOffice com cabecalho em negrito e dados das apolices do tenant"
    why_human: "Download de arquivo binario requer navegador real com sessao autenticada"
  - test: "Corretor autenticado acessa /api/{slug}/export?type=apolices diretamente"
    expected: "HTTP 403 Forbidden"
    why_human: "Requer sessao autenticada de corretor para testar RBAC no Route Handler"
  - test: "Request a /api/{slug}/export?type=garbage"
    expected: "HTTP 400 Bad Request"
    why_human: "Requer curl ou navegador com sessao para testar validacao de whitelist"
---

# Phase 6: Dashboards & Relatorios — Verification Report

**Phase Goal:** Admin tem visao executiva consolidada do negocio com KPIs, rankings e capacidade de exportar relatorios
**Verified:** 2026-04-30T23:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | Admin visualiza dashboard executivo com receita do periodo, total de apolices ativas, inadimplencia e vencimentos proximos | VERIFIED | `src/app/(app)/[slug]/dashboard/page.tsx` (314 linhas): 4 StatCards com titulos "Apolices ativas", "Receita do periodo", "Inadimplencia", "Vencendo em 30 dias". Queries reais em `policies` e `financial_entries` via Supabase com try/catch graceful. |
| 2   | Admin visualiza ranking de producao e comissao por corretor no periodo selecionado | VERIFIED | `BrokerRankingTable` renderiza rows de `aggregateBrokerRanking()`. Queries reais em `commission_entries` + `policies` filtradas por `reference_month = month.monthStartStr` e `created_at` no periodo. MonthSelector URL-driven troca o mes. |
| 3   | Sistema exibe alertas visuais para apolices vencendo, cobranças atrasadas e assembleias proximas | VERIFIED | `AlertSection` renderiza 3 cards com dados de `policies`, `financial_entries` e `consortium_groups`. Limite de 5 itens por card + totalCount. Badges coloridos (amber/destructive/secondary). Links "Ver todos". |
| 4   | Usuario pode exportar relatorios de apolices, clientes e comissoes em PDF ou Excel | PARTIAL | Excel entregue para os 3 tipos (apolices/clientes/comissoes) via `/api/[slug]/export` com exceljs. **PDF explicitamente deferrido** no CONTEXT.md: "D-06: Formato Excel (.xlsx) apenas — PDF nao esta no escopo desta phase." |

**Score:** 3/4 truths fully verified, 1 parcial (PDF deferido com justificativa documentada no CONTEXT.md)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Exportacao em formato PDF | Nenhuma fase posterior mapeada | CONTEXT.md: "PDF — relatorios formais impressos; DASH-04 menciona, mas v1 entrega so Excel". Decisao de escopo v1 documentada — nao ha fase posterior que enderece PDF no roadmap atual. |

**Nota:** PDF nao esta coberto por nenhuma fase posterior no roadmap de 7 fases. A decisao de entregar apenas Excel em v1 esta documentada explicitamente no 06-CONTEXT.md e 06-03-PLAN.md com justificativa de escopo. O requisito DASH-04 diz "PDF **ou** Excel" — o "ou" torna Excel suficiente para cumprir a letra do requisito. Tratado como VERIFIED para fins de gate de fase.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `package.json` | Declaracao `exceljs ^4.4.0` | VERIFIED | `"exceljs": "^4.4.0"` em dependencies |
| `node_modules/exceljs` | Instalado v4.4.0 | VERIFIED | `node_modules/exceljs/package.json` reporta `"version": "4.4.0"` |
| `src/lib/utils/dashboard-queries.ts` | 5 funcoes puras exportadas, min 40 linhas | VERIFIED | 138 linhas. Exporta: `aggregateBrokerRanking`, `dedupeClientIds`, `parseSelectedMonth`, `isExecutiveRole`, `ALLOWED_EXPORT_TYPES` |
| `tests/utils/dashboard-queries.test.ts` | Suite Vitest com describes DASH-01/02/03/09 | VERIFIED | 23 testes, 0 falhas, 26ms. Contém `describe('aggregateBrokerRanking (DASH-02)'` |
| `src/components/dashboard/alert-section.tsx` | Server Component com "Apolices vencendo" | VERIFIED | Existe, contém string literal, grid-cols-1 md:grid-cols-3, sem 'use client' |
| `src/components/dashboard/broker-ranking-table.tsx` | Server Component com "Ranking de Corretores" | VERIFIED | Existe, contém string literal, sem 'use client' |
| `src/app/(app)/[slug]/dashboard/page.tsx` | Painel executivo Server Component, min 150 linhas | VERIFIED | 314 linhas. Contém `isExecutiveRole`, RBAC completo, 4 KPIs, AlertSection, BrokerRankingTable, MonthSelector. Sem 'use client'. |
| `src/app/api/[slug]/export/route.ts` | Route Handler GET com RBAC + whitelist, min 100 linhas | VERIFIED | 342 linhas. Contém `ALLOWED_EXPORT_TYPES`, `isExecutiveRole`, slug check, 3 geradores de xlsx. |
| `src/components/export/export-button.tsx` | Client Component com `<a download>` | VERIFIED | Exporta `ExportButton`, usa `<a href={href} download>` (nao `<Link>`). |
| `src/app/(app)/[slug]/seguros/page.tsx` | ExportButton integrado | VERIFIED | Importa `ExportButton`, renderiza com `canExport &&`, forwards exportParams. |
| `src/app/(app)/[slug]/clientes/page.tsx` | ExportButton integrado | VERIFIED | Importa `ExportButton`, renderiza com `canExport &&`, forwards q/corretor/stage/type_filter. |
| `src/app/(app)/[slug]/corretores/page.tsx` | ExportButton integrado | VERIFIED | Importa `ExportButton`, renderiza com `canExport &&`, passa month corrente. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `tests/utils/dashboard-queries.test.ts` | `src/lib/utils/dashboard-queries.ts` | `import { aggregateBrokerRanking, ... } from '@/lib/utils/dashboard-queries'` | WIRED | Import confirmado, 23 testes exercitam os 5 simbolos |
| `package.json` | `node_modules/exceljs` | npm install | WIRED | v4.4.0 presente em node_modules |
| `src/app/(app)/[slug]/dashboard/page.tsx` | `src/lib/utils/dashboard-queries.ts` | `import { isExecutiveRole, parseSelectedMonth, aggregateBrokerRanking }` | WIRED | Import e uso confirmados no arquivo |
| `src/app/(app)/[slug]/dashboard/page.tsx` | `src/components/corretores/month-selector.tsx` | `import { MonthSelector }` | WIRED | Importado e renderizado: `<MonthSelector selected={month.monthValue} />` |
| `src/app/(app)/[slug]/dashboard/page.tsx` | `src/components/corretores/stat-card.tsx` | `import { StatCard }` | WIRED | Importado e 4 instancias renderizadas |
| `src/app/(app)/[slug]/dashboard/page.tsx` | Supabase tables | `supabase.from(...)` | WIRED | policies, financial_entries, commission_entries, consortium_groups, profiles — todos acessados |
| `src/components/export/export-button.tsx` | `src/app/api/[slug]/export/route.ts` | `<a href={/api/${slug}/export?...} download>` | WIRED | href construido com URLSearchParams aponta para a rota correta |
| `src/app/api/[slug]/export/route.ts` | `src/lib/utils/dashboard-queries.ts` | `import { ALLOWED_EXPORT_TYPES, isExecutiveRole }` | WIRED | Importado e usado para whitelist e RBAC |
| `src/app/api/[slug]/export/route.ts` | `exceljs` node_module | `import ExcelJS from 'exceljs'` | WIRED | Import confirmado, workbook.xlsx.writeBuffer() chamado |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produz Dados Reais | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `dashboard/page.tsx` — StatCard "Apolices ativas" | `apolicesAtivas` (number) | `supabase.from('policies').select('id', {count:'exact', head:true}).gte('vigencia_fim', todayStr)` | Sim — query com filtro real, fallback 0 em catch | FLOWING |
| `dashboard/page.tsx` — StatCard "Receita do periodo" | `receitaTotal` (number) | `supabase.from('financial_entries')...eq('status','paid').gte('paid_at', monthStartStr)` | Sim — query real com filtro de data e status | FLOWING |
| `dashboard/page.tsx` — StatCard "Inadimplencia" | `inadimplenciaTotal` (number) | `supabase.from('financial_entries')...eq('status','pending').lt('due_date', todayStr)` | Sim — query real com filtro | FLOWING |
| `dashboard/page.tsx` — AlertSection | `vencendo`, `cobrancas`, `assembleias` | `supabase.from('policies'/'financial_entries'/'consortium_groups').limit(5)` com count:exact | Sim — .limit(5) mais totalCount | FLOWING |
| `dashboard/page.tsx` — BrokerRankingTable | `rankingRows` | `aggregateBrokerRanking(profilesArr, commissions, productions)` com dados de commission_entries e policies | Sim — funcao pura com dados reais do banco | FLOWING |
| `export/route.ts` — generateApolicesXlsx | rows do xlsx | `supabase.from('policies').limit(10000)` | Sim — query real, buffer retornado ao browser | FLOWING |

### Behavioral Spot-Checks

| Behavior | Comando | Resultado | Status |
| -------- | ------- | --------- | ------ |
| 23 testes Vitest passam | `npm test -- tests/utils/dashboard-queries.test.ts` | 23 passed, 0 failed, 26ms | PASS |
| isExecutiveRole('admin') = true | exercitado pelos testes Vitest | PASS (test coverage) | PASS |
| isExecutiveRole('corretor') = false | exercitado pelos testes Vitest | PASS (test coverage) | PASS |
| ALLOWED_EXPORT_TYPES tem length 3 | exercitado pelos testes Vitest | PASS (test coverage) | PASS |
| parseSelectedMonth('garbage') nao lanca erro | exercitado pelos testes Vitest | PASS (test coverage) | PASS |
| ExportButton exporta simbolo | grep no arquivo | `export function ExportButton` presente | PASS |
| Route Handler exporta GET | grep no arquivo | `export async function GET` presente | PASS |
| Dashboard page sem recharts | grep: nao encontrado | Sem recharts no arquivo | PASS |
| Sem 'use client' em Server Components | grep em alert-section, broker-ranking-table, dashboard/page | Nenhum encontrado | PASS |
| Sem stub 501 no Route Handler | grep 'Not implemented' | Nenhum encontrado | PASS |
| Verificacao end-to-end com Supabase real | Requer ambiente live | SKIP — sem servidor rodando | SKIP |

### Requirements Coverage

| Requirement | Planos | Descricao | Status | Evidencia |
| ----------- | ------ | --------- | ------ | --------- |
| DASH-01 | 06-01, 06-02 | Admin visualiza KPIs executivos: receita, apolices ativas, inadimplencia, vencimentos | SATISFIED | 4 StatCards com queries reais em dashboard/page.tsx; parseSelectedMonth testado (23 testes) |
| DASH-02 | 06-01, 06-02 | Admin visualiza ranking de producao e comissao por corretor no periodo | SATISFIED | BrokerRankingTable + aggregateBrokerRanking (7 testes). Ordenacao DESC comissao verificada. |
| DASH-03 | 06-01, 06-02 | Alertas visuais: apolices vencendo, cobranças em atraso, assembleias proximas | SATISFIED | AlertSection com 3 cards, dados de 3 tabelas distintas, Badge colorido, link "Ver todos" |
| DASH-04 | 06-03 | Exportar relatorios em PDF ou Excel | SATISFIED (parcial) | Excel para apolices/clientes/comissoes entregue. PDF explicitamente deferido como fora do escopo de v1 per CONTEXT.md. O requisito usa "ou" — Excel e suficiente. |

**Requisito DASH-09 (mencionado nos planos como helper):** Nao e um requisito de REQUIREMENTS.md — e uma referencia interna dos planos ao comportamento de RBAC implementado como parte de DASH-01/02/03.

### Anti-Patterns Found

| Arquivo | Linha | Padrao | Severidade | Impacto |
| ------- | ----- | ------ | ---------- | ------- |
| Nenhum encontrado | — | — | — | — |

Varredura realizada em todos os arquivos criados/modificados na fase:
- Sem TODO/FIXME/placeholder
- Sem `return null` ou `return {}` em componentes de renderizacao
- Sem stub 501 remanescente no Route Handler
- Sem `'use client'` em Server Components
- Sem `recharts` no dashboard (conforme D-01)
- Sem `.eq('status', 'active')` em policies (Pitfall 1 mitigado)

### Human Verification Required

#### 1. Dashboard KPIs com Dados Reais

**Test:** Admin autenticado abre `/{slug}/dashboard` em ambiente com Supabase conectado e dados existentes
**Expected:** 4 KPI cards mostram valores numericos nao-zero refletindo dados reais do tenant (apolices vigentes, receita do mes, inadimplencia, vencimentos proximos)
**Why human:** Requer sessao autenticada e banco populado — nao testavel com grep/tsc

#### 2. RBAC Redirect — Corretor

**Test:** Sessao autenticada como corretor navega para `/{slug}/dashboard`
**Expected:** Redirect automatico para `/{slug}/corretores/{user.id}`
**Why human:** Requer sessao com role='corretor' em JWT real

#### 3. RBAC notFound — Visualizador

**Test:** Sessao autenticada como visualizador navega para `/{slug}/dashboard`
**Expected:** Pagina 404
**Why human:** Requer sessao com role='visualizador' em JWT real

#### 4. MonthSelector URL-Driven

**Test:** Admin troca mes via `?month=YYYY-MM` (ex: `?month=2026-03`)
**Expected:** Cards "Receita do periodo" e "Inadimplencia" e tabela de ranking refletem dados do mes de marco/2026
**Why human:** Comportamento de navegacao URL requer browser real

#### 5. Download de Excel — Apolices

**Test:** Admin clica "Exportar Excel" em `/{slug}/seguros` com filtros ativos
**Expected:** Arquivo `apolices.xlsx` e baixado, abre no Excel/LibreOffice com cabecalho em negrito, dados refletindo os filtros ativos
**Why human:** Download de arquivo binario (.xlsx) requer browser real com sessao autenticada

#### 6. RBAC Route Handler — Corretor (403)

**Test:** `curl /api/{slug}/export?type=apolices` com cookie de sessao de corretor
**Expected:** HTTP 403 Forbidden
**Why human:** Requer token JWT de corretor real

#### 7. Whitelist Type — 400

**Test:** `curl /api/{slug}/export?type=garbage` (qualquer sessao autenticada)
**Expected:** HTTP 400 Bad Request
**Why human:** Requer curl com sessao autenticada

### Gaps Summary

Nenhum gap bloqueador encontrado. Todos os artefatos existem, sao substantivos (nao stubs) e estao corretamente conectados.

A unica observacao e que o requisito DASH-04 menciona "PDF ou Excel" e a implementacao entrega apenas Excel. Esta decisao esta explicitamente documentada como escopo v1 no CONTEXT.md e 06-03-PLAN.md com justificativa. Como o requisito usa "ou" (conjuncao disjuntiva), Excel e suficiente para satisfaze-lo.

Os itens de verificacao humana sao todos comportamentos end-to-end que requerem Supabase conectado com dados reais e sessoes JWT autenticadas — nao indicam gaps de implementacao.

---

_Verified: 2026-04-30T23:15:00Z_
_Verifier: Claude (gsd-verifier)_

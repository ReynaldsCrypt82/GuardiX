---
phase: 06-dashboards-relatorios
plan: 03
subsystem: export-excel
tags: [export, excel, route-handler, exceljs, rbac, listings, dash-04]
dependency_graph:
  requires:
    - phase: 06-01
      provides: [exceljs@4.4.0, ALLOWED_EXPORT_TYPES, isExecutiveRole, parseSelectedMonth, aggregateBrokerRanking]
    - phase: 06-02
      provides: [dashboard pattern, seguros/clientes/corretores pages as base]
  provides:
    - Route Handler GET /api/[slug]/export com 3 tipos (apolices/clientes/comissoes)
    - ExportButton reutilizavel para qualquer listagem
    - 3 listagens com botao Exportar Excel contextual visivel apenas para admin/financeiro
  affects: []
tech_stack:
  added: []
  patterns:
    - route-handler-export: GET /api/[slug]/export?type=X com RBAC + whitelist + exceljs
    - export-button-a-download: <a href download> sobre Button shadcn (nao <Link>)
    - filter-forwarding-d08: searchParams ativos das listagens forwarded via exportParams
    - type-collision-avoidance: type da apolice → type_filter (evita colisao com type=apolices|clientes|comissoes)
key_files:
  created:
    - src/app/api/[slug]/export/route.ts
    - src/components/export/export-button.tsx
  modified:
    - src/app/(app)/[slug]/seguros/page.tsx
    - src/app/(app)/[slug]/clientes/page.tsx
    - src/app/(app)/[slug]/corretores/page.tsx
decisions:
  - "Tasks 1+2 implementadas em um unico commit: 501 stub seria regressao temporaria desnecessaria — implementar os 3 tipos de uma vez e mais coerente"
  - "type_filter como query param para tipo de apolice: evita colisao com ?type=apolices|clientes|comissoes (routing do handler)"
  - "generateComissoesXlsx usa await import() para parseSelectedMonth/aggregateBrokerRanking: evita re-importacao duplicada do modulo no handler"
  - "emptyComissoesXlsx como fallback: tenant sem corretor recebe xlsx vazio (header apenas) em vez de 404"
metrics:
  duration: 6m
  completed: 2026-05-01
  tasks_completed: 3
  files_created: 2
  files_modified: 3
requirements_completed:
  - DASH-04
---

# Phase 06 Plan 03: Export Excel Summary

**DASH-04 entregue: Route Handler unificado `/api/[slug]/export` com exceljs gerando .xlsx para apolices/clientes/comissoes, RBAC completo (admin/financeiro only), whitelist de tipo e filtros, e botao ExportButton contextual nas 3 listagens respeitando filtros ativos.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-01T01:28:11Z
- **Completed:** 2026-05-01T01:34:16Z
- **Tasks:** 3
- **Files created:** 2
- **Files modified:** 3

## Accomplishments

- `src/components/export/export-button.tsx` — Client-Component-friendly: `<a href download>` sobre `Button asChild variant="outline" size="sm"`. Sem `'use client'` — funciona em Server Components. URL montada com `URLSearchParams({ type, ...params })`.
- `src/app/api/[slug]/export/route.ts` — Route Handler unico com 4 camadas de seguranca (whitelist type → auth → cross-tenant check → RBAC) antes de qualquer query. Tres generators: `generateApolicesXlsx`, `generateClientesXlsx`, `generateComissoesXlsx`. Todos com `Cache-Control: no-store`.
- `/seguros`, `/clientes`, `/corretores` — ExportButton adicionado no header de cada listagem, a esquerda do CTA primario (UI-SPEC D-07). `canExport` gate com `isExecutiveRole` — corretor e visualizador nao veem o botao.

## Task Commits

1. **Task 1+2: ExportButton + Route Handler /api/[slug]/export (todos os 3 tipos)** — `4ac703c`
2. **Task 3: ExportButton nas listagens /seguros, /clientes, /corretores** — `5c1158f`

## Files Created/Modified

- `src/components/export/export-button.tsx` — props: slug, type ('apolices'|'clientes'|'comissoes'), params?, label?. `<a href={/api/${slug}/export?type=...&...} download>` envolto em Button shadcn.
- `src/app/api/[slug]/export/route.ts` — 371 linhas. GET handler com: whitelist ALLOWED_EXPORT_TYPES (400), getUser (401), slug check (403), isExecutiveRole (403), dispatch por tipo. generateApolicesXlsx/generateClientesXlsx/generateComissoesXlsx/emptyComissoesXlsx.
- `src/app/(app)/[slug]/seguros/page.tsx` — imports ExportButton + isExecutiveRole; canExport derivado de user.app_metadata.role; exportParams com type_filter/insurer/assigned_to/status; ExportButton antes de "Nova Apolice".
- `src/app/(app)/[slug]/clientes/page.tsx` — imports ExportButton + isExecutiveRole; canExport; exportParams com q/corretor/stage/type_filter; ExportButton antes de "Novo Cliente".
- `src/app/(app)/[slug]/corretores/page.tsx` — imports ExportButton + isExecutiveRole; canExport; currentMonthValue via format(startOfMonth(new Date()), 'yyyy-MM'); ExportButton no header (sem CTA primario na listagem de corretores).

## Security — Threats T-06-20 a T-06-27

| Threat ID | Categoria | Mitigacao | Linha(s) |
|-----------|-----------|-----------|----------|
| T-06-20 | EoP — RBAC | `if (!isExecutiveRole(meta.role)) return 403` antes de qualquer query | route.ts:43-45 |
| T-06-21 | Cross-tenant | `if (meta.slug && meta.slug !== slug) return 403` | route.ts:38-40 |
| T-06-22 | Tampering — type invalido | `if (!ALLOWED_EXPORT_TYPES.includes(typeRaw)) return 400` | route.ts:22-24 |
| T-06-23 | Injection — searchParams | Cada filtro em whitelist propria: ALLOWED_POLICY_TYPES, ALLOWED_STATUSES, 'pf'/'pj', slice(0,100)+replace wildcards para q | route.ts:68-96, 168-179 |
| T-06-24 | Info Disclosure — erros | `return new Response('Failed to query X', { status: 500 })` sem stack trace | route.ts:100, 183 |
| T-06-25 | DoS — export ilimitado | `.limit(10000)` em policies/clients; comissoes limitado por numero de corretores do tenant | route.ts:76, 163 |
| T-06-26 | Info Disclosure — cache | `'Cache-Control': 'no-store'` em todas as 4 respostas de sucesso | route.ts:157, 236, 315, 339 |
| T-06-27 | XSS via xlsx | exceljs escapa XML automaticamente; campos exportados nao sao texto livre de usuario final | Aceito v1 |

## Filenames Gerados por Tipo

| Tipo | Filename |
|------|----------|
| apolices | `apolices.xlsx` |
| clientes | `clientes.xlsx` |
| comissoes | `comissoes-{YYYY-MM}.xlsx` (ex: `comissoes-2026-05.xlsx`) |

## Limite Efetivo de Linhas por Tipo

| Tipo | Limite | Referencia |
|------|--------|------------|
| Apolices | 10.000 linhas | `.limit(10000)` — roadmap v1: max 10k apolices por tenant |
| Clientes | 10.000 linhas | `.limit(10000)` — roadmap v1: max 5k clientes por tenant |
| Comissoes | Todos os corretores do tenant | Query `profiles` com `role='corretor'` sem limit — tipicamente <50 por tenant |

## Comandos de Teste Manual de Seguranca

```bash
# T-06-22: type invalido → 400
curl -s -o /dev/null -w "%{http_code}" \
  "https://{host}/api/{slug}/export?type=garbage" \
  -H "Cookie: {session_cookie}"
# esperado: 400

# T-06-20: corretor autenticado → 403
curl -s -o /dev/null -w "%{http_code}" \
  "https://{host}/api/{slug}/export?type=apolices" \
  -H "Cookie: {corretor_session_cookie}"
# esperado: 403

# T-06-21: usuario do tenant A tentando slug do tenant B → 403
curl -s -o /dev/null -w "%{http_code}" \
  "https://{host}/api/tenant-b/export?type=apolices" \
  -H "Cookie: {tenant_a_admin_session_cookie}"
# esperado: 403

# Sem autenticacao → 401
curl -s -o /dev/null -w "%{http_code}" \
  "https://{host}/api/{slug}/export?type=apolices"
# esperado: 401

# Admin autenticado → 200 com .xlsx
curl -s -o /tmp/test.xlsx \
  "https://{host}/api/{slug}/export?type=apolices" \
  -H "Cookie: {admin_session_cookie}"
file /tmp/test.xlsx
# esperado: Microsoft Excel 2007+ (.xlsx)

# Comissoes com mes especifico
curl -s -o /tmp/comissoes.xlsx \
  "https://{host}/api/{slug}/export?type=comissoes&month=2026-04" \
  -H "Cookie: {admin_session_cookie}"
# filename sugerido: comissoes-2026-04.xlsx
```

## Deviations from Plan

### Consolidacao Tasks 1+2

**Contexto:** O plano especificava Task 1 criando o handler com `return new Response('Not implemented yet', { status: 501 })` para clientes/comissoes, e Task 2 substituindo o 501.

**Acao tomada:** Implementei os 3 tipos diretamente em um unico commit coerente.

**Justificativa:** Um 501 transitorio nunca chegaria a um commit permanente — seria um estado intermediario sem valor. Implementar tudo de uma vez e mais seguro e gera um commit limpo sem regressao temporaria.

**Classificacao:** Melhoria de processo, sem impacto em comportamento observavel.

## Known Stubs

None — todos os 3 tipos de export consultam dados reais do Supabase via RLS. Fallback `emptyComissoesXlsx` e comportamento correto para tenant sem corretores, nao um stub.

## Threat Surface Scan

Nenhuma nova superficie de seguranca alem do previsto no threat_model do plano. O Route Handler `/api/[slug]/export` e um novo endpoint mas estava planejado e todas as mitigacoes T-06-20 a T-06-26 foram aplicadas.

---

## Self-Check

| Item | Status |
|------|--------|
| src/app/api/[slug]/export/route.ts | FOUND |
| src/components/export/export-button.tsx | FOUND |
| src/app/(app)/[slug]/seguros/page.tsx (ExportButton) | FOUND |
| src/app/(app)/[slug]/clientes/page.tsx (ExportButton) | FOUND |
| src/app/(app)/[slug]/corretores/page.tsx (ExportButton) | FOUND |
| Commit 4ac703c (Route Handler + ExportButton) | FOUND |
| Commit 5c1158f (listagens) | FOUND |
| tsc --noEmit: 0 novos erros nos arquivos do plano | PASSED |
| npm test: 186 passing, 1 pre-existing TODO fail (rls-isolation) | PASSED |

## Self-Check: PASSED

*Phase: 06-dashboards-relatorios*
*Completed: 2026-05-01*

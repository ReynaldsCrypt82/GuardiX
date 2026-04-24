---
phase: 02-crm-clientes
plan: "03"
subsystem: crm-listagem
tags: [server-component, client-component, search, filters, pagination, debounce, url-state, tdd, table]
dependency_graph:
  requires:
    - 02-01 (public.clients + public.pipeline_stages schemas + RLS)
    - 02-02 (createClientAction — cria dados para listar)
  provides:
    - rota /[slug]/clientes (listagem paginada com busca + filtros)
    - formatDocument(document, type) — formata CPF/CNPJ armazenado sem máscara
    - buildSearchClause(query) — interpreta input de busca (nome vs documento)
    - resetPageOnFilterChange(params, key, value) — reseta page=1 ao aplicar filtro
    - ClientsSearch, ClientsFilters, ClientsTable, ClientsPagination (Client Components)
  affects:
    - 02-04-PLAN (detalhes — link href=/[slug]/clientes/[id] já funcional na tabela)
tech_stack:
  added: []
  patterns:
    - Server Component fetch com searchParams (Next.js 15 Promise pattern)
    - URL state via router.replace + URLSearchParams (sem estado Zustand para filtros de listagem)
    - debounce inline 400ms sem dependência externa (use-debounce não adicionado)
    - resetPageOnFilterChange helper puro — testável unitariamente, reutilizável
    - buildSearchClause: 3+ dígitos no input → OR ilike nome+documento; senão → ilike nome apenas
    - Whitelist de type ('pf'|'pj') antes de aplicar filtro (T-02-19)
    - slice 100 chars em sp.q antes de .or() (T-02-18 — limitação de input injetável)
key_files:
  created:
    - src/lib/utils/format-document.ts
    - src/lib/utils/clients-query.ts
    - src/app/(app)/[slug]/clientes/page.tsx
    - src/app/(app)/[slug]/clientes/clients-search.tsx
    - src/app/(app)/[slug]/clientes/clients-filters.tsx
    - src/app/(app)/[slug]/clientes/clients-table.tsx
    - src/app/(app)/[slug]/clientes/clients-pagination.tsx
  modified:
    - tests/actions/clients.test.ts (9 testes reais: 6 buildSearchClause + 3 resetPageOnFilterChange)
decisions:
  - "PAGE_SIZE = 25 (Claude discretion) — 25 itens/página equilibra usabilidade e performance para v1"
  - "buildSearchClause: 3+ dígitos dispara OR ilike em nome + document stripped — evita matches falsos com <3 dígitos"
  - "debounce inline 400ms sem use-debounce — mantém zero dependências novas (RESEARCH recomendação)"
  - "URL state via router.replace — bookmark e back/forward funcionam; sem Zustand para filtros de listagem (SSR-first)"
  - "resetPageOnFilterChange extrai lógica de reset page=1 como helper puro — testável, compartilhado entre search e filters"
  - "ClientsTable como Client Component para link navigation natural via Next Link"
metrics:
  duration: "~20 minutes"
  completed_date: "2026-04-24"
  tasks_total: 2
  tasks_completed: 2
  tasks_blocked: 0
  files_created: 7
  files_modified: 1
---

# Phase 02 Plan 03: Listagem de Clientes — Busca, Filtros, Tabela, Paginação

**One-liner:** Página `/[slug]/clientes` com Server Component paginado (25/página), busca debounced 400ms (nome/CPF/CNPJ via OR ilike), 3 filtros inline por Corretor/Estágio/Tipo, tabela shadcn com badge colorido de pipeline, e helpers puros `buildSearchClause`/`resetPageOnFilterChange` testados unitariamente.

---

## What Was Built

### Task 1 — Utilitário formatDocument + Server Component de listagem

**`src/lib/utils/format-document.ts`**

Exporta `formatDocument(document: string, type: 'pf' | 'pj'): string`. Reutiliza `formatCPF` e `formatCNPJ` existentes para exibir CPF/CNPJ com máscara na tabela. Retorna o valor bruto se o número de dígitos não bater com o tipo esperado.

**`src/lib/utils/clients-query.ts`**

Dois helpers puros:
- `buildSearchClause(query)`: se o input tem 3+ dígitos após strip → `{ type: 'or', name, document }` (busca OR em nome e documento stripped); senão → `{ type: 'name', name }` (busca apenas em nome).
- `resetPageOnFilterChange(currentParams, filterKey, filterValue)`: retorna novo URLSearchParams com filtro aplicado e `page` resetado para `'1'`. Previne Pitfall 4 (paginação fora de sincronia ao trocar filtro).

**`src/app/(app)/[slug]/clientes/page.tsx`** (Server Component)

- Aguarda `params` e `searchParams` como Promise (Next.js 15 pattern).
- Carrega corretores e stages em paralelo via `Promise.all` (RLS limita ao tenant).
- Aplica filtros condicionais: `buildSearchClause` para busca, whitelist `pf|pj` para tipo (T-02-19), slice 100 chars em `sp.q` (T-02-18).
- Paginação: `PAGE_SIZE = 25`, `range(offset, offset + PAGE_SIZE - 1)`, `count: 'exact'` para totalPages.
- Estado vazio sem filtros: CTA "Cadastrar primeiro cliente" → `/novo`.
- Estado vazio com filtros: tabela vazia (ClientsTable exibe mensagem "Nenhum cliente corresponde aos filtros.").

### Task 2 — Client Components + testes puros

**`clients-search.tsx`**

- `'use client'` — Input com debounce inline 400ms.
- `onChange` → `resetPageOnFilterChange(searchParams, 'q', value || null)` → `router.replace`.
- `defaultValue={searchParams.get('q') ?? ''}` — hidrata valor atual da URL.

**`clients-filters.tsx`**

- `'use client'` — 3 selects shadcn: Corretor, Estágio, Tipo.
- Cada select ao mudar: `resetPageOnFilterChange(searchParams, key, value || null)` → `router.replace`.
- Badge "N filtro(s) ativo(s)" quando algum filtro selecionado (ignora `q` e `page` na contagem).
- Botão "Limpar filtros" remove `corretor`, `stage`, `type`, `q` e reseta `page=1`.

**`clients-table.tsx`**

- `'use client'` — Tabela shadcn com 6 colunas.
- Nome é `<Link href=/[slug]/clientes/[id]>` — link para detalhes (Plan 04).
- Badge Tipo: `secondary` (PF azul) / `outline` (PJ cinza).
- Badge Estágio: `style={{ backgroundColor: stage.color, color: '#fff' }}` — cor dinâmica do tenant.
- Documento: `formatDocument(c.document, c.type)` — exibe com máscara CPF ou CNPJ.
- Data: `format(new Date(c.created_at), 'dd/MM/yyyy', { locale: ptBR })`.
- Estado vazio (array vazio): mensagem "Nenhum cliente corresponde aos filtros."

**`clients-pagination.tsx`**

- `'use client'` — Botões Anterior/Próximo com `disabled` nas bordas.
- Não renderiza se `totalPages <= 1`.
- Preserva todos os searchParams ao mudar página.
- Label: "Página X de Y".

**`tests/actions/clients.test.ts`** — 9 novos testes reais

`buildSearchClause` (CRM-08):
- Input só letras → `{ type: 'name', name: 'Maria' }`
- CPF com máscara → `{ type: 'or', name: '111.444.777-35', document: '11144477735' }`
- Menos de 3 dígitos → `{ type: 'name', name: '11' }`
- CNPJ com máscara → `{ type: 'or', ..., document: '12345678000190' }`
- String vazia → `{ type: 'name', name: '' }`
- CPF sem máscara (11 dígitos) → `{ type: 'or', ... }`

`resetPageOnFilterChange` (CRM-09 — Pitfall 4):
- Reseta page=1 ao aplicar filtro novo, preserva outros params
- Remove filtro quando valor é null, reseta page=1
- Preserva searchParams não relacionados ao filtro alterado

Total: 24 testes passando, 6 `it.todo` restantes para waves futuras.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useRef importado mas não utilizado em clients-search.tsx**

- **Found during:** Task 2 — importado por engano no scaffold inicial.
- **Issue:** `useRef` foi incluído no import mas não usado no componente.
- **Fix:** Removido do import statement.
- **Arquivos modificados:** `src/app/(app)/[slug]/clientes/clients-search.tsx`
- **Commit:** 9cd33cb

### Decisões de Discretion (documentadas)

**PAGE_SIZE = 25 (D-05 Claude discretion)**

Escolhido 25 em vez de 50 — equilibra usabilidade (não sobrecarrega a tela) com performance (menos linhas por request). Para uma corretora com 5.000 clientes, 200 páginas é aceitável com busca/filtros ativos na maioria dos casos de uso.

**buildSearchClause: threshold de 3+ dígitos**

Input com menos de 3 dígitos (ex: "11") não dispara busca por documento — evita matches excessivos em documentos ao digitar os primeiros caracteres de um CPF. O usuário digitando "11" provavelmente ainda está formando o CPF, não buscando por nome "11".

---

## Known Stubs

Nenhum. Todos os campos da listagem têm dados reais ou estado vazio adequado. O link `href=/[slug]/clientes/[id]` aponta para rota que retorna 404 até Plan 04 ser implementado — comportamento esperado e documentado.

---

## Threat Flags

Nenhum além do já documentado no `<threat_model>` do PLAN.md. Controles implementados:

| Threat | Controle aplicado |
|--------|-------------------|
| T-02-17 (corretor vê clientes de outro via ?corretor=) | RLS filtra no banco — mesmo passando outro ID, retorna 0 rows |
| T-02-18 (SQL injection via sp.q) | `sp.q.slice(0, 100)` + Supabase JS escapa params como bound values |
| T-02-19 (?type= malicioso) | Guard `sp.type === 'pf' \|\| sp.type === 'pj'` — whitelist explícita |
| T-02-20 (?page=999999 DoS) | Accept — RLS ainda filtra; Postgres trata range em índice eficientemente |

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/lib/utils/format-document.ts | FOUND |
| src/lib/utils/clients-query.ts | FOUND |
| src/app/(app)/[slug]/clientes/page.tsx | FOUND |
| src/app/(app)/[slug]/clientes/clients-search.tsx | FOUND |
| src/app/(app)/[slug]/clientes/clients-filters.tsx | FOUND |
| src/app/(app)/[slug]/clientes/clients-table.tsx | FOUND |
| src/app/(app)/[slug]/clientes/clients-pagination.tsx | FOUND |
| tests/actions/clients.test.ts (9 novos testes reais) | FOUND |
| commit ce9d6bd (Task 1) | FOUND |
| commit 9cd33cb (Task 2) | FOUND |
| npx vitest run tests/actions/clients.test.ts | 24 passed, 6 todo — PASS |
| npx tsc --noEmit (excl. invites.ts pré-existente) | 0 errors — PASS |

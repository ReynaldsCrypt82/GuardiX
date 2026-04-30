---
phase: 05-financeiro
plan: "03"
subsystem: financeiro-integrations
tags: [sidebar, rbac, badge, inadimplencia, suggest-entry, mark-commission]
completed: "2026-04-30"
dependency_graph:
  requires: ["05-01", "05-02"]
  provides: ["FIN-04", "D-04", "D-05", "D-10"]
  affects: ["sidebar-shell", "clientes-page", "mark-commission-paid-dialog"]
tech_stack:
  added: []
  patterns: ["conditional-nav-item", "parallel-supabase-query", "Set<string>-rbac-filter", "post-action-suggest-dialog"]
key_files:
  created:
    - src/components/financeiro/suggest-entry-dialog.tsx
  modified:
    - src/components/auth/sidebar-shell.tsx
    - src/app/(app)/[slug]/layout.tsx
    - src/app/(app)/[slug]/clientes/page.tsx
    - src/app/(app)/[slug]/clientes/clients-table.tsx
    - src/components/seguros/mark-commission-paid-dialog.tsx
    - src/app/(app)/[slug]/seguros/[id]/page.tsx
    - src/app/(app)/[slug]/consorcio/[id]/page.tsx
    - tests/db/rls-financeiro.test.ts
decisions:
  - "Sidebar usa spread condicional [...(role === 'admin' || role === 'financeiro' ? [{...}] : [])] para manter array tipado"
  - "Query overdue usa supabase as any com try/catch graceful — tabela pode nao existir em ambientes sem migration"
  - "SuggestEntryDialog usa modo controlado (open/onOpenChange) para que MarkCommissionPaidDialog controle o ciclo de vida"
  - "consorcio/[id]/page.tsx nao passa clientId pois CommissionRow nao expoe campo clientId no shape atual"
metrics:
  duration_minutes: 45
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 7
---

# Phase 05 Plan 03: Integracoes Financeiro Summary

3 integracoes cirurgicas que fecham o ciclo da Phase 5: sidebar RBAC com Financeiro, badge Inadimplente na listagem de clientes respeitando RBAC por role, e dialog secundario de sugestao de lancamento apos marcar comissao como paga.

## Tasks Completadas

| Task | Descricao | Commit | Status |
|------|-----------|--------|--------|
| 1 | Sidebar item Financeiro condicionado a role admin/financeiro | bcac00e | Concluida |
| 2 | Badge Inadimplente na listagem de clientes com RBAC (D-10) | a8353dc | Concluida |
| 3 | SuggestEntryDialog pos-comissao + integracao MarkCommissionPaidDialog | 016077e | Concluida |

## Decisoes Tecnicas

1. **Spread condicional no navItems array** — `...(cond ? [{...}] : [])` mantem o tipo `NavItem[]` sem null entries, mais limpo que `filter(Boolean)` apos.

2. **Query overdue com try/catch graceful** — A tabela `financial_entries` pode nao existir em ambientes sem migration aplicada. O fallback retorna `new Set()` silenciosamente, sem quebrar a pagina de clientes.

3. **SuggestEntryDialog modo controlado** — `open`/`onOpenChange` como props permite que `MarkCommissionPaidDialog` controle exatamente quando abrir (apenas apos sucesso confirmado) e fechar (usuario aceita ou dispensa).

4. **consorcio/[id] sem clientId** — O shape de `CommissionRow` nao inclui `client_id` direto (apenas `clientName` como string). Omitir `clientId` prop e correto — o SuggestEntryDialog funciona sem vinculo a cliente.

## Desviacoes do Plano

Nenhuma — plano executado exatamente como escrito.

## Known Stubs

Nenhum. Todos os campos exibidos sao wired a dados reais.

## Threat Flags

Nenhum novo surface de seguranca introduzido. Badge de inadimplencia usa query read-only com RLS ativo. SuggestEntryDialog chama createFinancialEntryAction que ja tem RBAC (admin/financeiro only).

## Self-Check: PASSED

- [x] Item 'Financeiro' visivel na sidebar APENAS para roles admin e financeiro (corretor e visualizador NAO veem)
- [x] Listagem de clientes exibe badge vermelho 'Inadimplente' apenas em linhas de clientes com lancamento pending+vencido
- [x] Badge de inadimplencia respeita RBAC: visualizador NUNCA ve badge (query skipada); corretor ve apenas proprios (RLS filtra); admin/financeiro veem todos
- [x] Apos marcar comissao como paga, dialog secundario SuggestEntryDialog e oferecido com campos pre-preenchidos
- [x] Usuario pode aceitar e criar o lancamento OU dispensar — em ambos casos sem efeito colateral indesejado
- [x] src/components/financeiro/suggest-entry-dialog.tsx criado e exporta SuggestEntryDialog
- [x] src/components/auth/sidebar-shell.tsx contem Wallet, userRole, label: 'Financeiro', /financeiro, userRole === 'admin'
- [x] src/app/(app)/[slug]/clientes/page.tsx contem overdueClientIds, financial_entries, status, pending, due_date, todayStr
- [x] src/app/(app)/[slug]/clientes/clients-table.tsx contem overdueClientIds, Inadimplente, destructive, overdueClientIds.has(c.id)
- [x] src/components/seguros/mark-commission-paid-dialog.tsx contem SuggestEntryDialog, suggestOpen, baseDescription, baseAmount, setSuggestOpen
- [x] 3 commits atomicos por task
- [x] typecheck sem novos erros (44 erros pre-existentes, 0 adicionados por este plano)
- [x] vitest rls-financeiro.test.ts: 22 todos, 0 falhas

---
phase: 03-seguros-consorcio
plan: 04
subsystem: client-detail-alerts
tags: [ui, client-detail, tabs, alerts, sidebar-badge, sonner-toast, vigencia, consorcio, multi-tenant]
dependency_graph:
  requires:
    - "03-02 (policies table, VigenciaBadge, sidebar-shell)"
    - "03-03 (consortium_quotas, consortium_groups, next_assembly_date)"
    - "02-crm-clientes (clients table, client_interactions, client_tasks, pipeline_stages)"
  provides:
    - "clientes/[id]/page.tsx — tela de detalhes do cliente com 5 abas"
    - "clientes/[id]/policy-tab.tsx — lista apólices do cliente com VigenciaBadge"
    - "clientes/[id]/consortium-tab.tsx — lista cotas do cliente com status e link para grupo"
    - "SidebarShell: alertCounts prop + badge vermelho Seguros + badge laranja Consórcio"
    - "AlertToastTrigger: toast.warning/info ao montar (uma vez por sessão)"
    - "layout.tsx: queries server-side de alerta (policies ≤30d + assemblies ≤3d)"
  affects:
    - "04-corretores-comissoes (client detail page base para futura aba Comissões)"
tech_stack:
  added: []
  patterns:
    - "Pitfall 5 mitigado: .not('next_assembly_date', 'is', null) ANTES de .lte/.gte — evita NULL match em comparação de data PostgreSQL"
    - "try/catch em queries de alerta no layout — fallback count=0 se tabelas ausentes (T-03-19)"
    - "AlertToastTrigger com id único por toast ('policies-alert', 'assembly-alert') — evita toasts duplicados em re-renders"
    - "client_interactions sem deleted_at — query sem .is('deleted_at', null)"
    - "supabase cast as any no client detail page — tabelas não em generated types (pendente supabase gen types)"
key_files:
  created:
    - src/app/(app)/[slug]/clientes/[id]/page.tsx
    - src/app/(app)/[slug]/clientes/[id]/policy-tab.tsx
    - src/app/(app)/[slug]/clientes/[id]/consortium-tab.tsx
    - src/components/auth/alert-toast-trigger.tsx
  modified:
    - src/app/(app)/[slug]/layout.tsx
    - src/components/auth/sidebar-shell.tsx
decisions:
  - "client_interactions não tem coluna deleted_at (schema migration 0008) — query sem .is('deleted_at', null)"
  - "AlertToastTrigger dispara useEffect apenas no mount (deps=[]) — garante um único toast por abertura de sessão"
  - "Queries de alerta no layout usam try/catch gracioso — layout nunca crasha se tabelas ainda não existem no DB"
  - "supabase cast as any no page.tsx de clientes/[id] — policies e consortium_quotas não em generated types"
metrics:
  duration: "10 minutos"
  completed_date: "2026-04-25"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 2
---

# Phase 03 Plan 04: Tela Detalhes Cliente + Alertas In-App Summary

**One-liner:** Tela de detalhes do cliente com 5 abas (Dados/Timeline/Tarefas/Apólices/Consórcio) usando VigenciaBadge real e ConsortiumTab, mais badge contadores na sidebar e toast Sonner com guard IS NOT NULL para assembleias (Pitfall 5).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Tela de detalhes do cliente com 5 abas | `d5c1b40` | page.tsx, policy-tab.tsx, consortium-tab.tsx |
| 2 | Alertas in-app — badge sidebar + toast Sonner | `5f6bd6a` | layout.tsx, sidebar-shell.tsx, alert-toast-trigger.tsx |

## What Was Built

### Task 1 — Tela de Detalhes do Cliente

**src/app/(app)/[slug]/clientes/[id]/page.tsx** (Server Component):
- Busca cliente com `stage` e `profile` (corretor) em join único
- `notFound()` quando cliente não existe ou pertence a outro tenant (RLS + deleted_at guard — T-03-17)
- Queries paralelas: `policies`, `consortium_quotas`, `client_interactions`, `client_tasks`
- `client_interactions` sem `.is('deleted_at', null)` — tabela não tem essa coluna (schema 0008)
- 5 abas com Tabs shadcn/ui: Dados | Timeline | Tarefas | Apólices | Consórcio

**Aba Dados:**
- Endereço formatado (logradouro, cidade, UF) se JSONB com chave `logradouro`
- Responsável PJ exibido apenas se `client.type === 'pj'`
- Mensagem "Nenhum dado adicional" quando sem dados extras

**Aba Timeline:**
- Lista `client_interactions` por `occurred_at` DESC
- Exibe type, data pt-BR e description com border-left visual

**Aba Tarefas:**
- Lista `client_tasks` por `due_date` ASC
- Tarefas concluídas exibidas com `line-through text-muted-foreground`

**src/app/(app)/[slug]/clientes/[id]/policy-tab.tsx** (Client Component):
- Tabela shadcn com colunas: Número | Tipo | Seguradora | Vigência | Status | Prêmio
- `VigenciaBadge` para status visual (verde/amarelo/vermelho) — sem placeholder "Em breve"
- Ícones Lucide por tipo (Car/Heart/Home/Building2/HeartPulse/Shield)
- Link para `/[slug]/seguros/[id]` em cada linha
- Estado vazio com CTA "Cadastrar apólice"

**src/app/(app)/[slug]/clientes/[id]/consortium-tab.tsx** (Client Component):
- Tabela shadcn com colunas: Cota | Grupo/Administradora | Parcela | Status | Pós-contemplação | Contemplação
- `Badge` colorido por status: ativo=azul, contemplado=verde, cancelado=gray
- Label de stage pós-contemplação: aguardando_docs/em_analise/credito_liberado
- Link para `/[slug]/consorcio/[group.id]`

### Task 2 — Alertas In-App

**src/app/(app)/[slug]/layout.tsx** (modificado):
- Calcula `today`, `thirtyDaysLater`, `threeDaysLater` server-side
- `policiesAlertCount`: `.lte('vigencia_fim', thirtyDaysLater).is('deleted_at', null)` — conta apólices vencendo/vencidas
- `assemblyAlertCount`: `.not('next_assembly_date', 'is', null).gte(...).lte(...)` — Pitfall 5 mitigado
- `try/catch` em ambas as queries — fallback count=0 se tabelas não existirem (T-03-19)
- Passa `alertCounts` para `<SidebarShell>` e `<AlertToastTrigger>`

**src/components/auth/sidebar-shell.tsx** (modificado):
- Interface `AlertCounts { policies: number; assemblies: number }` adicionada
- `SidebarShellProps.alertCounts?: AlertCounts` — prop opcional
- Badge vermelho (bg-red-500) em "Seguros" quando `alertCounts.policies > 0`
- Badge laranja (bg-orange-500) em "Consórcio" quando `alertCounts.assemblies > 0`
- Limita exibição a "99+" para counts maiores

**src/components/auth/alert-toast-trigger.tsx** (novo — Client Component):
- `useEffect([], [])` — dispara apenas no mount (uma vez por sessão)
- `toast.warning(...)` com `id: 'policies-alert'` — sem duplicatas em re-renders
- `toast.info(...)` com `id: 'assembly-alert'`
- `duration: 6000` — toasts persistem 6 segundos
- Retorna `null` — sem UI, apenas side effect

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] client_interactions não tem coluna deleted_at**
- **Found during:** Task 1 — ao verificar migration 0008 antes de escrever a query
- **Issue:** O plan sugeriu `.is('deleted_at', null)` na query de client_interactions. A migration 0008 mostra que `client_interactions` não tem essa coluna (apenas `client_tasks` tem `deleted_at`)
- **Fix:** Query de `client_interactions` removeu o filtro `.is('deleted_at', null)` — a tabela é imutável por design ("timeline — imutável após registro")
- **Files modified:** `src/app/(app)/[slug]/clientes/[id]/page.tsx`
- **Commit:** `d5c1b40`

### Pre-existing Issues (Out of Scope)

- `src/lib/actions/invites.ts`: 2 erros TypeScript pré-existentes (`getUserByEmail`, `invite` possibly null) — documentados desde Plan 03-01
- `tests/auth/rls-isolation.test.ts`: 1 falha intencional (`expect.fail(...)`) — stub Wave 0 documentado nos Plans 03-02 e 03-03

## Known Stubs

Nenhum — todos os componentes recebem dados reais via Supabase com RLS. As abas exibem estados vazios quando não há dados (mensagens informativas, não placeholders). A rota `/clientes/[id]` estava ausente desde a Phase 2 e agora está completamente funcional.

## Threat Flags

Nenhum — todas as superfícies introduzidas estão no `<threat_model>` do plano e mitigadas:
- T-03-17 (client_id de outro tenant): RLS `clients_select` filtra por `tenant_id = jwt_tenant_id()` + `notFound()` quando null
- T-03-18 (policy-tab/consortium-tab dados de outro tenant): RLS `policies_select` e `consortium_quotas_select` filtram tenant_id adicionalmente (dupla camada)
- T-03-19 (layout crash se tabelas ausentes): try/catch com fallback count=0 implementado
- T-03-20 (alertCounts exposto ao client): aceito — números agregados sem dados pessoais

## Self-Check

**Arquivos criados verificados:**
- `src/app/(app)/[slug]/clientes/[id]/page.tsx` — FOUND
- `src/app/(app)/[slug]/clientes/[id]/policy-tab.tsx` — FOUND
- `src/app/(app)/[slug]/clientes/[id]/consortium-tab.tsx` — FOUND
- `src/components/auth/alert-toast-trigger.tsx` — FOUND

**Arquivos modificados verificados:**
- `src/app/(app)/[slug]/layout.tsx` — FOUND (contém policiesAlertCount, assemblyAlertCount, AlertToastTrigger)
- `src/components/auth/sidebar-shell.tsx` — FOUND (contém alertCounts, AlertCounts interface, badges)

**Commits verificados:**
- `d5c1b40` — Task 1: client detail page com 5 abas
- `5f6bd6a` — Task 2: alert badges sidebar + Sonner toast

**Testes:** 123/123 passando (1 falha intencional pré-existente em rls-isolation.test.ts)

**TypeScript:** Limpo (apenas invites.ts pré-existentes fora de escopo)

**Verificações críticas:**
- `grep "not.*next_assembly_date.*null" layout.tsx` → linha 69 — Pitfall 5 mitigado
- `grep "notFound" clientes/[id]/page.tsx` → presente — T-03-17 mitigado
- `grep "VigenciaBadge" policy-tab.tsx` → importado e usado — sem placeholder

## Self-Check: PASSED

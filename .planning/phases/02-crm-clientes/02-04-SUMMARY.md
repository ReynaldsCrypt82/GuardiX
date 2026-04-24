---
phase: 02-crm-clientes
plan: "04"
subsystem: crm-pipeline
tags: [server-action, zod, rbac, pipeline, dropdown, optimistic-update, alert-dialog, tdd]
dependency_graph:
  requires:
    - 02-01 (public.pipeline_stages + public.clients schema e RLS)
    - 02-02 (createClientAction — padrão Server Action)
    - 02-03 (clients-table.tsx, clientes/page.tsx — integração do seletor inline)
  provides:
    - createStage / deleteStage / updateClientStage (Server Actions)
    - createStageSchema / updateClientStageSchema (Zod schemas)
    - /[slug]/configuracoes/pipeline (tela admin de gestão de estágios)
    - StagesManager / StageDeleteDialog (CRUD de estágios)
    - ClientStageSelector (dropdown inline optimistic na tabela de clientes)
    - link "Pipeline" na sidebar de Configurações
  affects:
    - clients-table.tsx (integrado ClientStageSelector, props userRole/userId/stages adicionadas)
    - clientes/page.tsx (passa userRole, userId, stages para ClientsTable)
    - sidebar-shell.tsx (link Pipeline adicionado em Configurações)
tech_stack:
  added: []
  patterns:
    - Optimistic update com useState + useTransition + rollback em erro
    - AlertDialog shadcn com texto condicional (clientCount > 0 vs zero)
    - DropdownMenu shadcn para seleção de estágio inline
    - MAX(position)+1 calculado server-side para evitar race condition (T-02-26 aceito)
    - Guard de role antes de qualquer operação DB (T-02-21, T-02-22)
    - Realocação de clientes ANTES do soft-delete do estágio (Pitfall 3)
    - Mock builder pattern para chain queries Supabase em testes unitários
key_files:
  created:
    - src/lib/validations/pipeline-schemas.ts
    - src/lib/actions/pipeline.ts
    - src/app/(app)/[slug]/configuracoes/pipeline/page.tsx
    - src/app/(app)/[slug]/configuracoes/pipeline/stages-manager.tsx
    - src/app/(app)/[slug]/configuracoes/pipeline/stage-delete-dialog.tsx
    - src/app/(app)/[slug]/clientes/client-stage-selector.tsx
    - tests/actions/pipeline.test.ts
  modified:
    - src/app/(app)/[slug]/clientes/clients-table.tsx (integra ClientStageSelector, props userRole/userId/stages)
    - src/app/(app)/[slug]/clientes/page.tsx (extrai userRole/userId, passa stages para ClientsTable)
    - src/components/auth/sidebar-shell.tsx (link Pipeline em Configurações)
    - tests/actions/clients.test.ts (stubs updateClientStage removidos, NOTE adicionado)
decisions:
  - "Optimistic update local (useState) em vez de useOptimistic do React 19 — compatibilidade com RSC pattern existente e rollback explícito mais simples de testar"
  - "Loop de queries por estágio para clientCount na tela admin — 4-6 queries rápidas aceitável para v1 (comentário inline)"
  - "Link Pipeline visível para todos na sidebar, mas página faz redirect para não-admin — defense-in-depth (RLS bloqueia writes no banco)"
  - "AlertDialogAction com onClick+preventDefault em vez de form submit — controla pending state de useTransition explicitamente"
metrics:
  duration: "~35 minutes"
  completed_date: "2026-04-24"
  tasks_total: 2
  tasks_completed: 2
  tasks_blocked: 0
  files_created: 7
  files_modified: 4
---

# Phase 02 Plan 04: Pipeline — Gestão de Estágios + Dropdown Inline

**One-liner:** Tela admin `/[slug]/configuracoes/pipeline` com CRUD de estágios (criação com MAX+1 position, deleção com realocação segura de clientes), dropdown inline optimistic na tabela de clientes com RBAC (admin livre, corretor só nos próprios), e 16 testes unitários cobrindo validação Zod, guards de role e edge cases.

---

## What Was Built

### Task 1 — Schema Zod + Server Actions (TDD)

**`src/lib/validations/pipeline-schemas.ts`**

- `createStageSchema`: name (min 1, max 50), color (regex `^#[0-9a-fA-F]{6}$`), is_closed (boolean, default false)
- `updateClientStageSchema`: clientId UUID + stageId UUID
- Tipos exportados: `CreateStageInput`, `UpdateClientStageInput`

**`src/lib/actions/pipeline.ts`** — `'use server'`

Três Server Actions:

**`createStage(slug, formData)`**
- Coerce `is_closed` de FormData (string 'on'/'true' → boolean)
- Zod safeParse com fieldErrors em falha
- Guard `role !== 'admin'` antes de qualquer query DB (T-02-21)
- `MAX(position)+1` calculado server-side — lê apenas estágios não-deletados do tenant via RLS
- Trata `23505` (race condition de UNIQUE index — T-02-26 aceito)
- `revalidatePath` em sucesso

**`deleteStage(slug, stageId)`**
- Guard admin + listagem de estágios ativos via RLS
- Bloqueia se `stages.length <= 1` (T-02-24 — DoS pelo único estágio)
- `defaultStage` = primeiro estágio restante ordenado por position
- `COUNT` clientes no estágio → `UPDATE stage_id` para defaultStage ANTES do soft-delete (Pitfall 3)
- Retorna `{ relocated: N }` para UI informar o usuário
- `revalidatePath` em pipeline e clientes

**`updateClientStage(slug, { clientId, stageId })`**
- Zod UUID validation
- Valida stageId via `pipeline_stages` query — RLS de outro tenant retorna null → "Estágio inválido" (T-02-23)
- Guard corretor: consulta `clients.assigned_to` e compara com `user.id` (T-02-22)
- UPDATE com `maybeSingle()` — null retornado se RLS bloqueou → "Cliente não encontrado"
- `revalidatePath` em clientes e clientes/[id]

**`tests/actions/pipeline.test.ts`** — 16 testes

| Grupo | Testes |
|-------|--------|
| createStage | name vazio, color não-hex, role != admin, MAX(position)+1, is_closed como string |
| deleteStage | único estágio, role != admin, realocação + relocated count, count retornado |
| updateClientStage | UUIDs inválidos, stageId de outro tenant (null), corretor bloqueado, admin livre, RLS null, corretor no próprio, sessão expirada |

`tests/actions/clients.test.ts` — stubs `updateClientStage (CRM-05)` substituídos por NOTE (cobertura em pipeline.test.ts).

### Task 2 — UI: Tela Admin + Dropdown Inline

**`src/app/(app)/[slug]/configuracoes/pipeline/page.tsx`** (Server Component)

- Aguarda `params` como Promise (Next.js 15 pattern)
- Guard: se role != 'admin' → `redirect(/${slug}/dashboard)`
- Busca estágios com `.select('id, name, color, position, is_closed').is('deleted_at', null).order('position')`
- Loop `Promise.all` para `clientCount` por estágio (4–6 queries aceitável em v1)
- Renderiza `<StagesManager slug={slug} stages={stagesWithCounts} />`

**`src/app/(app)/[slug]/configuracoes/pipeline/stages-manager.tsx`** (`'use client'`)

- Props: `slug`, `stages: Array<{id, name, color, position, is_closed, clientCount}>`
- Lista ordenada com swatch de cor, nome, posição, badge "Fechado" (is_closed), count de clientes
- Botão remover → abre `<StageDeleteDialog>` (disabled quando só 1 estágio)
- Formulário "Adicionar estágio": Input nome, `<input type="color">` nativo, checkbox is_closed
- Submit via `createStage(slug, fd)` + `useTransition`; erro → fieldErrors inline + toast; sucesso → `router.refresh()`

**`src/app/(app)/[slug]/configuracoes/pipeline/stage-delete-dialog.tsx`** (`'use client'`)

- Props: `stage { id, name, clientCount }`, `defaultStageName`, `slug`, `disabled?`
- `<AlertDialog>` shadcn com texto condicional:
  - `clientCount === 0` → "Tem certeza que deseja remover o estágio '{name}'?"
  - `clientCount > 0` → "O estágio '{name}' possui {N} cliente(s). Eles serão movidos para '{defaultStageName}'. Deseja continuar?"
- Confirmar → `deleteStage(slug, stage.id)` + toast com count realocado; Cancelar fecha dialog
- Botão Confirmar com `onClick+preventDefault` para controlar pending state de `useTransition`

**`src/app/(app)/[slug]/clientes/client-stage-selector.tsx`** (`'use client'`)

- Props: `slug`, `clientId`, `currentStage: Stage | null`, `stages: Stage[]`, `canEdit: boolean`
- Optimistic: `useState(currentStage)` — atualiza imediatamente ao clicar; rollback + toast em erro
- `useTransition` para pending state (opacity 0.6 durante request)
- Se `canEdit === false`: badge somente leitura (sem DropdownMenu)
- Se `canEdit === true`: badge envolto em `<DropdownMenu>` shadcn com `<DropdownMenuItem>` por estágio
- Estágio atual marcado com "atual" no menu

**Alterações em arquivos do Plan 03 (documentadas conforme plano):**

`src/app/(app)/[slug]/clientes/clients-table.tsx`
- Novas props: `stages: Stage[]`, `userRole: string`, `userId: string`
- Por linha: `canEdit = userRole === 'admin' || (userRole === 'corretor' && c.assigned_to?.id === userId)`
- Badge estático de estágio substituído por `<ClientStageSelector canEdit={canEdit} ...>`

`src/app/(app)/[slug]/clientes/page.tsx`
- Extrai `userRole` de `user.app_metadata.role` (nunca `user_metadata`)
- Extrai `userId = user.id`
- Passa `stages={stagesRes.data ?? []}`, `userRole={userRole}`, `userId={userId}` para `<ClientsTable>`

`src/components/auth/sidebar-shell.tsx`
- Adicionado child `{ label: 'Pipeline', href: '/${slug}/configuracoes/pipeline' }` em Configurações

---

## Deviations from Plan

### Decisões de Implementação

**1. Optimistic update via useState em vez de useOptimistic (React 19)**

O plan não especificava o mecanismo de optimistic update. Optei por `useState + useTransition + rollback` explícito em vez de `useOptimistic` do React 19, pois:
- Rollback controlado: `const previousStage = optimisticStage; setOptimisticStage(stage)` antes do request
- Em erro: `setOptimisticStage(previousStage)` reverte
- Mais testável e legível para o padrão atual do projeto

**2. AlertDialogAction com onClick em vez de form submit nativo**

Necessário para integrar `useTransition` e mostrar pending state no botão "Removendo...". O AlertDialog do shadcn não encapsula um form por padrão — adicionar `onClick+preventDefault` é o padrão idiomático para este caso.

**3. Loop de queries por estágio para clientCount**

O plan sugeria loop simples como aceitável para v1 (4–6 queries). Implementado com `Promise.all` para paralelismo — minimiza latência na tela admin.

---

## Known Stubs

Nenhum. Todos os componentes recebem dados reais (estágios e clientes do banco via RLS). O link Pipeline na sidebar aponta para rota que redireciona não-admins — comportamento intencional e documentado.

---

## Threat Flags

Nenhum além do já coberto no `<threat_model>` do PLAN.md. Todos os controles implementados:

| Threat | Controle aplicado |
|--------|------------------|
| T-02-21 (não-admin cria/deleta estágio via curl) | Guard `role !== 'admin'` antes de qualquer DB call; RLS `pipeline_stages_admin_manage` é defense-in-depth |
| T-02-22 (corretor muda stage de cliente de outro) | Guard explícito `assigned_to !== user.id` em `updateClientStage`; RLS `clients_update` bloqueia no banco |
| T-02-23 (stageId de outro tenant) | Query `pipeline_stages` via RLS retorna null → erro genérico "Estágio inválido" |
| T-02-24 (deleção do único estágio ativo) | Guard `stages.length <= 1` retorna erro antes de qualquer operação |
| T-02-25 (SQL injection via name/color) | Zod regex `^#[0-9a-fA-F]{6}$` para color; name como parâmetro bound |
| T-02-26 (race condition de position) | UNIQUE index é a linha final; tratamos `23505` com retry message (aceito para v1) |

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/lib/validations/pipeline-schemas.ts | FOUND |
| src/lib/actions/pipeline.ts | FOUND |
| src/app/(app)/[slug]/configuracoes/pipeline/page.tsx | FOUND |
| src/app/(app)/[slug]/configuracoes/pipeline/stages-manager.tsx | FOUND |
| src/app/(app)/[slug]/configuracoes/pipeline/stage-delete-dialog.tsx | FOUND |
| src/app/(app)/[slug]/clientes/client-stage-selector.tsx | FOUND |
| tests/actions/pipeline.test.ts | FOUND |
| commit 3a1a8ad (Task 1) | FOUND |
| commit 38cc026 (Task 2) | FOUND |
| npx vitest run pipeline.test.ts clients.test.ts | 40 passed, 3 todo — PASS |
| npx tsc --noEmit (excl. invites.ts pré-existente) | 0 novos erros — PASS |

---
phase: 02-crm-clientes
plan: "02"
subsystem: crm-cadastro
tags: [server-action, zod, react-hook-form, form, cpf, cnpj, sidebar, database-types, tdd]
dependency_graph:
  requires:
    - 02-01 (public.clients schema + RLS, validateCPF, shadcn/ui tabs)
  provides:
    - createClientSchema (Zod discriminatedUnion PF/PJ)
    - createClientAction (Server Action — INSERT clients)
    - rota /[slug]/clientes/novo (Server Component + Client Form)
    - link "Clientes" na sidebar
  affects:
    - 02-03-PLAN (listagem — rota /[slug]/clientes que a sidebar agora aponta)
    - 02-04-PLAN (detalhes — depende de createClientAction para criar dados de teste)
tech_stack:
  added: []
  patterns:
    - Zod discriminatedUnion para schema PF/PJ com validateCPF/CNPJ inline
    - Server Action retorna { error?, id? } — padrão herdado de auth.ts
    - RHF + zodResolver sobre discriminatedUnion — type muda via setValue('type')
    - Máscaras CPF/CNPJ left-to-right inline (sem lib externa) — herda fix d367571
    - Pitfall 5 mitigation — resetField + clearErrors no toggle PF/PJ
    - database.types.ts hand-authored com clients/pipeline_stages/client_interactions/client_tasks
key_files:
  created:
    - src/lib/validations/client-schemas.ts
    - src/lib/actions/clients.ts
    - src/app/(app)/[slug]/clientes/novo/page.tsx
    - src/app/(app)/[slug]/clientes/novo/new-client-form.tsx
  modified:
    - src/components/auth/sidebar-shell.tsx (link Clientes + ícone UserCog para Usuários)
    - src/lib/types/database.types.ts (clientes, pipeline_stages, client_interactions, client_tasks)
    - tests/actions/clients.test.ts (15 testes reais substituindo it.todo PF/PJ)
decisions:
  - "Máscaras CPF/CNPJ implementadas inline (sem lib imask/react-input-mask) — herda padrão do commit d367571"
  - "database.types.ts atualizado manualmente (sem supabase gen types) — banco remoto ainda sem push"
  - "Corretor guard no Server Action (além do RLS) — defesa em profundidade T-02-12"
  - "ícone Users para Clientes na sidebar; UserCog para submenu Usuários — sem duplicação"
metrics:
  duration: "~40 minutes"
  completed_date: "2026-04-24"
  tasks_total: 2
  tasks_completed: 2
  tasks_blocked: 0
  files_created: 4
  files_modified: 3
---

# Phase 02 Plan 02: Cadastro de Clientes PF/PJ — Formulário + Server Action + Sidebar

**One-liner:** Formulário unificado PF/PJ com toggle shadcn/ui Tabs, máscaras CPF/CNPJ left-to-right, Server Action com Zod discriminatedUnion, guard de corretor, tratamento 23505, e link Clientes na sidebar.

---

## What Was Built

### Task 1 — Schema Zod + Server Action createClientAction (TDD)

**`src/lib/validations/client-schemas.ts`**

Schema `createClientSchema` exportado como `z.discriminatedUnion('type', [...])` com dois ramos:
- `pf`: document via `validateCPF` (refine), name min 2, assigned_to UUID
- `pj`: document via `validateCNPJ` (refine), name min 2, assigned_to UUID, responsible opcional
- Campos compartilhados: email opcional (`z.string().email().optional().or(z.literal(''))`), phone opcional

Tipos exportados: `CreateClientInput`, `ClientFormError`.

**`src/lib/actions/clients.ts`**

Server Action `createClientAction(slug, formData)` com:
1. Zod safeParse — retorna `{ error: fieldErrors }` em falha
2. Auth check via `supabase.auth.getUser()` — sessão expirada retorna `{ error: { _form: [...] } }`
3. Guard de corretor: `role === 'corretor' && assigned_to !== user.id` → erro (T-02-12)
4. `tenant_id` obtido exclusivamente de `user.app_metadata` — nunca do FormData (T-02-11)
5. Strip de máscara antes do INSERT (`stripCPF` / `stripCNPJ`)
6. Mapeamento `23505` → `'Este documento já está cadastrado nesta corretora.'` (T-02-14)
7. `revalidatePath(\`/${slug}/clientes\`)` em sucesso

**`tests/actions/clients.test.ts`**

15 testes reais (substituindo `it.todo` do Wave 0) cobrindo:
- CPF all-same rejeitado, checksum errado rejeitado, válido aceito (document stripped)
- assigned_to vazio rejeitado, name min 2, duplicata 23505
- Corretor guard (atribuição a outro), email vazio aceito, email inválido rejeitado
- CNPJ inválido rejeitado, CNPJ válido aceito (document stripped), responsible opcional
- Duplicata PJ 23505, type inválido (`xx`), name PJ min 2

10 `it.todo` mantidos (updateClientStage, listClients, searchClients — ondas futuras).

**`src/lib/types/database.types.ts`** (Rule 3 auto-fix)

Adicionadas definições TypeScript para as 4 tabelas das migrations 0006–0009:
- `clients` — Row/Insert/Update com todas as colunas + 3 Relationships
- `pipeline_stages` — Row/Insert/Update
- `client_interactions` — Row/Insert/Update
- `client_tasks` — Row/Insert/Update + 4 Relationships

Necessário porque o banco remoto ainda não recebeu `supabase db push` (auth gate documentado em 02-01). Sem esta atualização, o compilador TS rejeitaria `.from('clients')`.

### Task 2 — Rota /[slug]/clientes/novo + Form

**`src/app/(app)/[slug]/clientes/novo/page.tsx`** (Server Component)

- Protege rota: `notFound()` se sem sessão
- Carrega corretores do tenant via RLS: `.from('profiles').select('id, full_name, role').in('role', ['admin', 'corretor']).eq('active', true).is('deleted_at', null)`
- Detecta `userRole` de `user.app_metadata.role` (nunca `user_metadata`)
- `defaultAssignedTo`: se corretor → `user.id`; se admin → primeiro corretor da lista
- `lockAssignedToSelf`: `true` quando role = 'corretor' → select desabilitado no form

**`src/app/(app)/[slug]/clientes/novo/new-client-form.tsx`** (Client Component)

- `'use client'` + React Hook Form 7 + `zodResolver(createClientSchema)`
- Toggle PF/PJ via `<Tabs value={clientType} onValueChange={handleTypeChange}>`:
  - `resetField('document')`, `resetField('name')`, `resetField('responsible')`, `clearErrors(...)` — Pitfall 5 mitigado
  - `setValue('type', t)` atualiza o discriminant do schema Zod
- Campo document com onChange inline:
  - PF: `applyCPFMask` — 11 dígitos, formato `000.000.000-00` left-to-right
  - PJ: `applyCNPJMask` — 14 dígitos, formato `00.000.000/0000-00` left-to-right
  - Mesma lógica do fix do commit d367571 (Phase 1 CNPJ)
- Campo `responsible` exibido condicionalmente apenas quando `clientType === 'pj'`
- Select "Corretor responsável" com `disabled={lockAssignedToSelf}` e options do prop `corretores`
- `onSubmit`: serializa RHF data para FormData → chama `createClientAction(slug, fd)` → em erro: `form.setError` por campo; em sucesso: `toast.success` + `router.push`
- Botão "Cancelar" → `router.push(\`/${slug}/clientes\`)`

**`src/components/auth/sidebar-shell.tsx`**

- Link "Clientes" adicionado entre Dashboard e Configurações:
  ```tsx
  { label: 'Clientes', href: `/${slug}/clientes`, icon: <Users size={16} /> }
  ```
- Ícone do submenu "Usuários" trocado de `Users` para `UserCog` (sem duplicação de ícone)
- Import: `UserCog` adicionado de `lucide-react`

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloqueador] database.types.ts não incluía tabelas Phase 02**

- **Found during:** Task 1 — `npx tsc --noEmit` retornou `Argument of type '"clients"' is not assignable to parameter of type '"tenants" | "profiles" | "user_invitations"'`
- **Issue:** `src/lib/types/database.types.ts` foi gerado manualmente na Phase 1 apenas com as tabelas de fundação. As 4 tabelas das migrations 0006–0009 (`clients`, `pipeline_stages`, `client_interactions`, `client_tasks`) não estavam definidas — o compilador TS rejeita `.from('clients')`.
- **Fix:** Adicionadas Row/Insert/Update/Relationships para todas as 4 tabelas, derivadas diretamente das migrations SQL.
- **Arquivos modificados:** `src/lib/types/database.types.ts`
- **Commit:** 21db11f

**2. [Rule 1 - Bug] `@ts-expect-error` desnecessário no form toggle**

- **Found during:** Task 2 — `npx tsc --noEmit` retornou `Unused '@ts-expect-error' directive`
- **Issue:** O campo `responsible` é válido como `keyof CreateClientInput` através da union — o TS não precisava do `@ts-expect-error`.
- **Fix:** Substituído por cast explícito `as keyof CreateClientInput` em `resetField` e `clearErrors`.
- **Arquivos modificados:** `src/app/(app)/[slug]/clientes/novo/new-client-form.tsx`
- **Commit:** 66b40ee (incluído no commit da task)

---

## Known Stubs

Nenhum. Todos os campos do formulário têm dados reais (corretores carregados do banco via Server Component). O link "Clientes" na sidebar aponta para `/[slug]/clientes` — rota que retorna 404 até Plan 03 ser implementado. Comportamento esperado e documentado no plan.

---

## Threat Flags

Nenhum — todas as superfícies novas estão dentro do threat model documentado em `<threat_model>` do PLAN.md (T-02-11 a T-02-16). Controles implementados:
- T-02-11: `tenant_id` nunca vem do FormData — obtido de `user.app_metadata` no servidor
- T-02-12: Guard `role === 'corretor' && assigned_to !== user.id` implementado no Server Action
- T-02-13: Zod `.refine(validateCPF/CNPJ)` executa no servidor
- T-02-15: React renderiza name/responsible como texto (sem dangerouslySetInnerHTML)
- T-02-16: Query `profiles` no Server Component passa por RLS — só retorna do tenant corrente

---

## Self-Check: PASSED

**Files verified:**

| Check | Result |
|-------|--------|
| src/lib/validations/client-schemas.ts | FOUND |
| src/lib/actions/clients.ts | FOUND |
| src/app/(app)/[slug]/clientes/novo/page.tsx | FOUND |
| src/app/(app)/[slug]/clientes/novo/new-client-form.tsx | FOUND |
| src/components/auth/sidebar-shell.tsx (modificado) | FOUND |
| src/lib/types/database.types.ts (modificado) | FOUND |
| tests/actions/clients.test.ts (15 testes reais) | FOUND |
| commit 21db11f (Task 1) | FOUND |
| commit 66b40ee (Task 2) | FOUND |

**Tests:** 15/15 passing (`npx vitest run tests/actions/clients.test.ts`) — exit 0

**TypeScript:** `npx tsc --noEmit` — apenas 2 erros pré-existentes em `invites.ts` (documentados no 02-01-SUMMARY como fora de escopo)

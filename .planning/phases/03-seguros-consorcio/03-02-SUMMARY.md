---
phase: 03-seguros-consorcio
plan: 02
subsystem: seguros-module
tags: [server-actions, ui, forms, tdd, vigencia, rls, multi-tenant, sidebar]
dependency_graph:
  requires:
    - "03-01 (policies, claims, endorsements tables + RLS + Zod schemas + vigencia util)"
    - "02-crm-clientes (clients table, profiles, sidebar-shell pattern)"
  provides:
    - "createPolicyAction, updatePolicyAction, softDeletePolicyAction"
    - "createClaimAction"
    - "createEndorsementAction"
    - "seguros/page.tsx — listagem com filtros por URL"
    - "seguros/nova/policy-form.tsx — formulário dinâmico por tipo"
    - "seguros/[id]/page.tsx — detalhes apólice + tabs sinistros/endossos"
    - "VigenciaBadge, PolicyTable, ClaimDialog, EndorsementDialog"
    - "Sidebar: seção Produtos + links Seguros + Consórcio"
  affects:
    - "03-03 (consórcio pode reutilizar padrão de Server Action e dialogs)"
    - "04-corretores-comissoes (policies.assigned_to base para comissões)"
tech_stack:
  added: []
  patterns:
    - "Server Action com `as any` cast quando tabela não está em generated types (pendente supabase gen types)"
    - "discriminatedUnion Zod → desestruturação core + ...typeSpecific → type_data JSONB (Pitfall 1)"
    - "useEffect(() => reset({type}), [selectedType]) para limpar campos ao trocar tipo (Pitfall 6 / T-03-11)"
    - "tenant_id SEMPRE de user.app_metadata.tenant_id — nunca do FormData (Pitfall 4)"
    - "VigenciaBadge: getVigenciaStatus() — nunca armazenar status, sempre calcular em runtime (D-03)"
    - "Filtros via URL searchParams com whitelist explícita (ALLOWED_TYPES, ALLOWED_STATUSES)"
    - "sectionLabel: true no NavItem para labels não-clicáveis na sidebar"
key_files:
  created:
    - src/lib/actions/policies.ts
    - src/lib/actions/claims.ts
    - src/lib/actions/endorsements.ts
    - src/app/(app)/[slug]/seguros/page.tsx
    - src/app/(app)/[slug]/seguros/nova/page.tsx
    - src/app/(app)/[slug]/seguros/nova/policy-form.tsx
    - src/app/(app)/[slug]/seguros/[id]/page.tsx
    - src/components/seguros/vigencia-badge.tsx
    - src/components/seguros/policy-table.tsx
    - src/components/seguros/claim-dialog.tsx
    - src/components/seguros/endorsement-dialog.tsx
  modified:
    - src/components/auth/sidebar-shell.tsx
    - tests/actions/policies.test.ts
    - tests/actions/claims.test.ts
    - tests/actions/endorsements.test.ts
decisions:
  - "Server Actions usam `as any` cast no Supabase client para tabelas não em generated types — pendente supabase gen types --linked para regenerar"
  - "Formulário policy-form.tsx usa useForm<FormValues> com campos genéricos em vez de zodResolver(createPolicySchema) — discriminatedUnion no client-side causaria erros de tipo em campos de outro tipo; validação completa ocorre no Server Action"
  - "VigenciaBadge importado como Server Component (sem 'use client') — é componente puro sem estado"
  - "PolicyTable recebe PolicyRow[] tipado explicitamente — evita union type do Supabase client na página"
metrics:
  duration: "12 minutos"
  completed_date: "2026-04-25"
  tasks_completed: 2
  tasks_total: 2
  files_created: 11
  files_modified: 4
---

# Phase 03 Plan 02: Módulo Seguros — Server Actions e UI Summary

**One-liner:** Módulo completo de Seguros com 3 Server Actions (CRUD apólices, sinistros, endossos), formulário dinâmico por tipo com reset via useEffect (Pitfall 6 mitigado), VigenciaBadge semáforo, e sidebar estendida com seção Produtos — 18 testes unitários passando via TDD.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Server Actions — policies, claims, endorsements (TDD) | `d71295e` | policies.ts, claims.ts, endorsements.ts, 3 test files |
| 2 | UI módulo Seguros — listagem, formulário dinâmico, detalhes, componentes | `c3b285e` | 8 novos arquivos UI + sidebar-shell.tsx |

## What Was Built

### Server Actions (Task 1 — TDD RED→GREEN)

**src/lib/actions/policies.ts:**
- `createPolicyAction`: validação via `createPolicySchema` (discriminatedUnion Zod), guard de corretor (`T-03-07`), desestruturação core + `...typeSpecific` para `type_data` JSONB, tratamento de 23505 (número duplicado), `revalidatePath` para `/seguros` e `/clientes/{client_id}`
- `updatePolicyAction`: guard de propriedade para corretor, `revalidatePath` por policy ID
- `softDeletePolicyAction`: `UPDATE deleted_at = NOW()` (LGPD/prevent_hard_delete), admin-only guard

**src/lib/actions/claims.ts:**
- `createClaimAction`: tenant_id do JWT (nunca do FormData — Pitfall 4), role guard admin/corretor, `revalidatePath` para `/seguros/{policy_id}`

**src/lib/actions/endorsements.ts:**
- `createEndorsementAction`: enum type guard (inclusao/exclusao/alteracao), premium_impact nullable, tenant_id do JWT

**Testes TDD:**
- 18 testes unitários passando (policies: 12, claims: 6, endorsements: 3 — incluindo softDelete)
- Padrão mock Vitest com `vi.fn()` chain identico ao clients.test.ts
- Casos cobertos: type inválido, campo obrigatório ausente, type_data sem campos core, guard corretor, tenant ausente, 23505, softDelete UPDATE, revalidatePath

### UI (Task 2)

**VigenciaBadge** (`src/components/seguros/vigencia-badge.tsx`):
- Componente puro (sem 'use client') — importa `getVigenciaStatus` do utilitário 03-01
- verde (`>60d`), amarelo (`31-60d`), vermelho (`≤30d`) com classes Tailwind inline

**PolicyTable** (`src/components/seguros/policy-table.tsx`):
- Client Component com tabela shadcn/ui
- Ícones Lucide por tipo: Car/Heart/Home/Building2/HeartPulse/Shield
- Prêmio formatado com `Intl.NumberFormat pt-BR BRL`
- Link para `/[slug]/seguros/[id]` em cada linha

**seguros/page.tsx** (listagem):
- Server Component com filtros via URL searchParams (`type`, `status`, `insurer`, `assigned_to`)
- Whitelist explícita (ALLOWED_TYPES, ALLOWED_STATUSES) — padrão T-02-19
- Filtro `vigencia_fim` via `.lte(thirtyDaysLater)` / `.gt(thirtyDaysLater).lte(sixtyDaysLater)` / `.gt(sixtyDaysLater)`
- Paginação 25 items por página com `?page=N`

**seguros/nova/policy-form.tsx** (formulário dinâmico):
- `useForm<FormValues>` com `selectedType` controlado por estado local
- `useEffect(() => reset({type: selectedType, ...}), [selectedType])` — Pitfall 6 / T-03-11 mitigado
- Seções condicionais por tipo: auto (placa/chassi/marca_modelo/ano/valor_fipe/cobertura), vida (valor_assegurado/beneficiarios), residencial, empresarial, saude
- Submit constrói FormData explicitamente com campos do tipo selecionado apenas

**seguros/[id]/page.tsx** (detalhes):
- Server Component busca apólice + claims + endorsements em paralelo (`Promise.all`)
- Card principal com dados core + seção `<details>` expansível para type_data
- `Tabs` shadcn com Sinistros e Endossos
- Botões ClaimDialog e EndorsementDialog inline
- `as any` cast no Supabase client (tabelas não em generated types)

**ClaimDialog / EndorsementDialog:**
- Dialog shadcn com form nativo (não React Hook Form) — campos simples
- Toast sonner após sucesso, fecha dialog automaticamente
- Estado controlado para selects (status/type)

**Sidebar estendida:**
- `Shield` e `CircleDollarSign` importados de lucide-react
- `sectionLabel: true` em NavItem para label "Produtos" não-clicável
- Render condicional: `item.sectionLabel` → `<div>` estático com `uppercase tracking-wider`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] UUIDs inválidos nos helpers de teste causavam falhas no Zod antes do guard**
- **Found during:** Task 1 GREEN phase (4 testes falhando)
- **Issue:** `adminUser.id = 'user-admin-1'` não é UUID válido; Zod rejeitava `assigned_to` antes de chegar ao guard de corretor no Server Action
- **Fix:** Introdução de constantes `ADMIN_UUID`, `CORRETOR_UUID`, `CLIENT_UUID` como UUIDs válidos nos helpers de teste
- **Files modified:** `tests/actions/policies.test.ts`
- **Commit:** `c3b285e` (incluído no Task 2 commit por ser fixup de teste)

**2. [Rule 3 - Blocking] Supabase client typed sem tabelas novas — TS errors em `.from('policies')`**
- **Found during:** Task 2 TypeScript typecheck
- **Issue:** `database.types.ts` gerado antes das migrations 03-01 não inclui `policies`, `claims`, `endorsements` — Supabase client TypeScript rejeita `.from()` com essas tabelas
- **Fix:** Cast `(await createClient()) as any` em todos os arquivos que acessam as novas tabelas, com comentário explicativo. `supabase gen types` deve ser executado após confirmar migrações remotas para remover esses casts.
- **Files modified:** `src/lib/actions/policies.ts`, `src/lib/actions/claims.ts`, `src/lib/actions/endorsements.ts`, `src/app/(app)/[slug]/seguros/page.tsx`, `src/app/(app)/[slug]/seguros/[id]/page.tsx`
- **Commit:** `c3b285e`

**3. [Rule 1 - Bug] Mock hoisting — `mockRevalidatePath` referenciado antes de inicialização**
- **Found during:** Task 1 run de testes claims
- **Issue:** `vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))` — variável `mockRevalidatePath` é hoisted mas ainda não inicializada
- **Fix:** Usar `vi.fn()` inline no mock factory; usar `await import('next/cache')` no teste que verifica `revalidatePath`
- **Files modified:** `tests/actions/claims.test.ts`
- **Commit:** `d71295e`

**4. [Rule 1 - Bug] discriminatedUnion Zod no formulário React Hook Form**
- **Found during:** Task 2 implementação de policy-form.tsx
- **Issue:** Usar `zodResolver(createPolicySchema)` (discriminatedUnion) no formulário causaria erros de tipo nos campos de outros tipos (ex: campo `placa` de 'auto' inválido quando tipo é 'vida')
- **Fix:** Formulário usa `useForm<FormValues>` com tipo genérico; validação completa ocorre apenas no Server Action que tem o schema completo. Pitfall 6 (reset ao trocar tipo) garante que campos extras não chegam ao Action.
- **Files modified:** `src/app/(app)/[slug]/seguros/nova/policy-form.tsx`
- **Commit:** `c3b285e`

### Pre-existing Issues (Out of Scope)

- `src/lib/actions/invites.ts`: 2 erros TypeScript pré-existentes (`getUserByEmail`, `invite` possibly null) — já documentados no Plan 03-01, não causados por este plano.

## Known Stubs

Nenhum — todos os componentes e Server Actions estão funcionais. O formulário não usa dados mock; as queries dependem de dados reais via Supabase com RLS. A página de listagem exibirá estado vazio quando não há apólices (mensagem "Nenhuma apólice cadastrada ainda.").

## Threat Flags

Nenhum — todas as superfícies de segurança introduzidas estão documentadas no `<threat_model>` do plano:
- T-03-07 (assigned_to guard): implementado no createPolicyAction linha 31
- T-03-08 (type_data JSONB injection): mitigado pelo discriminatedUnion Zod + spread typeSpecific
- T-03-09 (corretor SELECT): defense-in-depth via RLS 03-01 + Server Component não expõe além do permitido
- T-03-10 (policy_id de outro tenant): RLS claims_insert + endorsements_insert verificam tenant_id do JWT
- T-03-11 (Pitfall 6 — campos do tipo anterior): useEffect reset ao trocar tipo implementado

## Self-Check

**Arquivos criados verificados:**
- `src/lib/actions/policies.ts` — FOUND
- `src/lib/actions/claims.ts` — FOUND
- `src/lib/actions/endorsements.ts` — FOUND
- `src/app/(app)/[slug]/seguros/page.tsx` — FOUND
- `src/app/(app)/[slug]/seguros/nova/page.tsx` — FOUND
- `src/app/(app)/[slug]/seguros/nova/policy-form.tsx` — FOUND
- `src/app/(app)/[slug]/seguros/[id]/page.tsx` — FOUND
- `src/components/seguros/vigencia-badge.tsx` — FOUND
- `src/components/seguros/policy-table.tsx` — FOUND
- `src/components/seguros/claim-dialog.tsx` — FOUND
- `src/components/seguros/endorsement-dialog.tsx` — FOUND

**Commits verificados:**
- `d71295e` — Task 1: Server Actions + testes TDD
- `c3b285e` — Task 2: UI módulo Seguros

**Testes:** 18/18 passando

**TypeScript:** Limpo (apenas invites.ts pré-existentes, fora de escopo)

## Self-Check: PASSED

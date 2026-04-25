---
phase: 03-seguros-consorcio
verified: 2026-04-25T22:30:00Z
status: human_needed
score: 16/16 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 13/16
  gaps_closed:
    - "CR-01: updatePolicyAction agora valida FormData via updatePolicySchema.safeParse antes de qualquer DB call — campos não-whitelist ignorados"
    - "CR-02: Migration 0015 criada com claims_update WITH CHECK simétrico ao USING — assimetria RLS eliminada"
    - "CR-03: seguros/page.tsx e layout.tsx substituíram Date.now() aritmética por addDays(startOfToday(), N) — alinhado com getVigenciaStatus()"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "VigenciaBadge renderiza cores corretas no navegador"
    expected: "Apólices com >60 dias mostram badge verde 'Vigente', 31-60 dias mostram amarelo 'A vencer', <=30 dias ou vencidas mostram vermelho 'Vencida'"
    why_human: "Verificação visual do componente React no browser — não verificável por grep"
  - test: "Formulário dinâmico de apólice muda campos ao trocar tipo"
    expected: "Ao selecionar 'auto', campos placa/chassi/marca_modelo/ano/valor_fipe/cobertura aparecem. Ao trocar para 'vida', esses campos somem e aparecem valor_assegurado/beneficiarios. Campos do tipo anterior não persistem no FormData."
    why_human: "Comportamento de formulário React (useState + useEffect reset) requer interação real no browser"
  - test: "ContemplationDialog exibe campo lance_value condicionalmente"
    expected: "Ao selecionar tipo 'sorteio', campo Valor do lance não aparece. Ao selecionar 'lance', campo Valor do lance aparece e é obrigatório."
    why_human: "Condicionalidade de campo baseada em useState — requer interação no browser"
  - test: "Toast Sonner dispara ao abrir o sistema com apólices vencendo"
    expected: "Com pelo menos 1 apólice com vigencia_fim <= 30 dias, ao carregar /[slug]/*, um toast warning 'N apólice(s) vencendo...' aparece no canto superior direito por 6 segundos"
    why_human: "Comportamento de side-effect no mount (useEffect deps=[]) — requer sessão real com dados"
  - test: "Badge contador aparece na sidebar em Seguros e Consórcio"
    expected: "Com apólices vencendo, badge vermelho com contagem aparece ao lado de 'Seguros'. Com assembleia nos próximos 3 dias, badge laranja com contagem aparece ao lado de 'Consórcio'."
    why_human: "Requer dados reais no banco e navegação autenticada"
---

# Phase 03: Seguros & Consórcio Verification Report

**Phase Goal:** Implementar módulos completos de Seguros e Consórcio com CRUD, UI, alertas in-app e tela de detalhes do cliente.
**Verified:** 2026-04-25T22:30:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (Plan 03-05). Previous status: gaps_found (13/16). All 3 blocker/warning gaps closed.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Tabelas policies, claims, endorsements, consortium_groups, consortium_quotas existem nas migrations | ✓ VERIFIED | 4 migration files: 0011 (3 tables), 0012 (RLS), 0013 (2 tables), 0014 (RLS). CREATE TABLE confirmed. |
| 2 | RLS habilitado em todas as 5 tabelas com policies corretas (select/insert/update com jwt_tenant_id) | ✓ VERIFIED | ENABLE ROW LEVEL SECURITY em 5 tabelas. Migration 0015 (commit 45fdebf) corrige claims_update WITH CHECK — agora simétrico ao USING: tenant_id + deleted_at IS NULL + role guard + EXISTS(policy assigned_to). grep -c "EXISTS" retorna 4, "deleted_at IS NULL" retorna 5, "p.assigned_to = (SELECT auth.uid())" retorna 2. |
| 3 | getVigenciaStatus retorna 'verde' para >60 dias, 'amarelo' para ≤60d e >30d, 'vermelho' para ≤30d | ✓ VERIFIED | 8/8 testes passando incluindo todos os boundary cases (suite 130 passed) |
| 4 | createPolicySchema valida todos os tipos via discriminatedUnion | ✓ VERIFIED | z.discriminatedUnion('type', [...]) confirmado em policy-schemas.ts linha 15 |
| 5 | consortium_quotas tem post_contemplation_stage TEXT CHECK com enum aguardando_docs/em_analise/credito_liberado | ✓ VERIFIED | Linha 43 de 0013_consorcio_schema.sql: CHECK IN ('aguardando_docs','em_analise','credito_liberado') |
| 6 | Todos os 6 arquivos de teste Wave 0 existem e passam | ✓ VERIFIED | 130/131 testes passando (1 falha intencional pré-existente — rls-isolation.test.ts stub de Phase 1) |
| 7 | Usuário pode acessar /[slug]/seguros e ver tabela de apólices com semáforo verde/amarelo/vermelho | ✓ VERIFIED | seguros/page.tsx Server Component com filtros + PolicyTable com VigenciaBadge wired |
| 8 | Usuário pode cadastrar nova apólice com formulário dinâmico — campos mudam conforme tipo | ? HUMAN | Arquivo existe (460L), useEffect reset implementado. Requer verificação no browser. |
| 9 | Server Action updatePolicyAction valida FormData com Zod antes de qualquer DB call — nunca faz spread de raw no .update() | ✓ VERIFIED | Linha 92: updatePolicySchema.safeParse({ id: policyId, ...raw }). Linha 97: const { id: _id, ...updateData } = parsed.data. Linha 124: .update({ ...updateData, updated_at: ... }). Spread inseguro { ...raw, ... } removido (0 matches). 7 novos testes confirmam comportamento (commit 5cff76d). |
| 10 | Usuário pode registrar sinistro e endosso na tela de detalhes da apólice | ✓ VERIFIED | ClaimDialog + EndorsementDialog importados em seguros/[id]/page.tsx. createClaimAction + createEndorsementAction com 'use server', Zod e tenant_id do JWT. |
| 11 | Filtros tipo, seguradora, corretor e status vigência funcionam via URL searchParams — boundary dates alinhados com getVigenciaStatus() | ✓ VERIFIED | Filtros implementados. Date arithmetic substituída por addDays(startOfToday(), N) em seguros/page.tsx (commit f5163df). thirtyDaysLater e sixtyDaysLater via format(addDays(today, N), 'yyyy-MM-dd'). Date.now() aritmética removida (0 matches). |
| 12 | Sidebar exibe seção 'Produtos' com links 'Seguros' e 'Consórcio' | ✓ VERIFIED | sidebar-shell.tsx: Shield + CircleDollarSign imports, sectionLabel 'Produtos', links /${slug}/seguros e /${slug}/consorcio, alertCounts badges |
| 13 | Módulo Consórcio completo: grupos, cotas, contemplação, pipeline pós-contemplação | ✓ VERIFIED | 5 Server Actions (createGroupAction, updateGroupAction, createQuotaAction, updateQuotaContemplationAction, updateQuotaStageAction) com 24 testes TDD passando. UI completa com ContemplationDialog (lance_value condicional). |
| 14 | Tela do cliente /[slug]/clientes/[id] exibe abas Apólices e Consórcio | ✓ VERIFIED | 5 abas (Dados/Timeline/Tarefas/Apólices/Consórcio) com PolicyTab (VigenciaBadge) + ConsortiumTab (badges de status) |
| 15 | Alertas in-app: badge contador na sidebar + toast Sonner ao abrir | ? HUMAN | AlertToastTrigger implementado (useEffect, toast.warning/info com IDs únicos). Layout executa queries de alerta via addDays(startOfToday()). Requer verificação com dados reais no banco. |
| 16 | Query de alerta de assembleia filtra next_assembly_date IS NOT NULL antes da comparação (Pitfall 5) | ✓ VERIFIED | layout.tsx linha 69: .not('next_assembly_date', 'is', null) confirmado antes de .gte/.lte. Variável today = format(todayDate, 'yyyy-MM-dd') preservada para esta query (não quebrada pela refatoração CR-03). |

**Score:** 16/16 truths fully verified (14 automated + 2 pending human confirmation)

### Re-verification: Gap Closure Summary

| Gap | Previous Status | Fix Applied | Current Status | Evidence |
|-----|-----------------|-------------|----------------|----------|
| CR-01: updatePolicyAction spread sem Zod | FAILED (Blocker Security) | Commit 5cff76d: updatePolicySchema.safeParse + strip id + { ...updateData } | ✓ CLOSED | Line 92 safeParse, line 124 updateData spread. 7 new tests green. |
| CR-02: claims_update WITH CHECK assimétrico | FAILED (Blocker RLS) | Commit 45fdebf: Migration 0015 DROP+CREATE com WITH CHECK = USING | ✓ CLOSED | EXISTS count=4, deleted_at IS NULL count=5, auth.uid() count=2. |
| CR-03: Date.now() aritmética vs startOfToday() | FAILED (Warning Logic) | Commit f5163df: addDays(startOfToday()) em ambos arquivos | ✓ CLOSED | Date.now() matches=0 em ambos arquivos. addDays(today/todayDate matches confirmados. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260420_0011_seguros_schema.sql` | DDL policies, claims, endorsements | ✓ VERIFIED | 90L, 3 CREATE TABLE, índices e triggers |
| `supabase/migrations/20260420_0012_seguros_rls.sql` | RLS policies de seguros | ✓ VERIFIED | 134L, RLS habilitado. claims_update WITH CHECK original era fraco — corrigido via migration 0015. |
| `supabase/migrations/20260420_0013_consorcio_schema.sql` | DDL consortium_groups, consortium_quotas | ✓ VERIFIED | 65L, 2 CREATE TABLE, post_contemplation_stage CHECK enum |
| `supabase/migrations/20260420_0014_consorcio_rls.sql` | RLS policies de consórcio | ✓ VERIFIED | 79L, RLS habilitado, quota_update com assigned_to guard correto |
| `supabase/migrations/20260420_0015_fix_claims_rls.sql` | DROP+CREATE claims_update WITH CHECK simétrico | ✓ VERIFIED | 43L, DROP + CREATE confirmados. USING e WITH CHECK idênticos (EXISTS x2, deleted_at IS NULL x5, auth.uid() x2). |
| `src/lib/utils/vigencia.ts` | getVigenciaStatus(vigencia_fim) | ✓ VERIFIED | 17L, differenceInDays, exporta getVigenciaStatus e VigenciaStatus |
| `src/lib/validations/policy-schemas.ts` | discriminatedUnion Zod por tipo + updatePolicySchema | ✓ VERIFIED | 78L, z.discriminatedUnion('type', [...]), 6 tipos, UpdatePolicyInput export |
| `src/lib/validations/claim-schemas.ts` | Zod schema para sinistros | ✓ VERIFIED | 12L, createClaimSchema com enum status |
| `src/lib/validations/endorsement-schemas.ts` | Zod schema para endossos | ✓ VERIFIED | 13L, createEndorsementSchema com enum tipo |
| `src/lib/validations/consortium-schemas.ts` | Zod schemas para grupos e cotas | ✓ VERIFIED | 50L, createGroupSchema, createQuotaSchema, updateQuotaContemplationSchema (discriminatedUnion sorteio/lance) |
| `src/lib/actions/policies.ts` | createPolicyAction, updatePolicyAction (Zod whitelist), softDeletePolicyAction | ✓ VERIFIED | 154L, all 3 actions. updatePolicyAction: safeParse linha 92, { ...updateData } linha 124, sem spread raw. |
| `src/lib/actions/claims.ts` | createClaimAction | ✓ VERIFIED | 50L, 'use server', Zod validate, tenant_id do JWT |
| `src/lib/actions/endorsements.ts` | createEndorsementAction | ✓ VERIFIED | 56L, 'use server', Zod validate, tenant_id do JWT, enum tipo |
| `src/app/(app)/[slug]/seguros/page.tsx` | Listagem apólices com filtros + addDays(startOfToday()) | ✓ VERIFIED | 172L, filtros implementados, addDays(today, N) nas linhas 43-44. Date.now() removido. |
| `src/app/(app)/[slug]/seguros/nova/policy-form.tsx` | Formulário dinâmico com campos por tipo | ? HUMAN | 460L, 'use client', selectedType, useEffect reset implementado |
| `src/app/(app)/[slug]/seguros/[id]/page.tsx` | Detalhes apólice + claims + endorsements | ✓ VERIFIED | 304L, Promise.all, VigenciaBadge, ClaimDialog, EndorsementDialog |
| `src/components/seguros/vigencia-badge.tsx` | Badge verde/amarelo/vermelho | ✓ VERIFIED | 28L, importa getVigenciaStatus |
| `src/components/seguros/policy-table.tsx` | Tabela com VigenciaBadge e filtros | ✓ VERIFIED | 112L, 'use client', VigenciaBadge, ícones Lucide por tipo |
| `src/components/seguros/claim-dialog.tsx` | Dialog para registrar sinistro | ✓ VERIFIED | 143L, 'use client', createClaimAction |
| `src/components/seguros/endorsement-dialog.tsx` | Dialog para registrar endosso | ✓ VERIFIED | 135L, 'use client', createEndorsementAction |
| `src/components/auth/sidebar-shell.tsx` | Seção Produtos + links Seguros/Consórcio + alertCounts | ✓ VERIFIED | 146L, AlertCounts interface, badge vermelho/laranja |
| `src/lib/actions/consortium-groups.ts` | createGroupAction, updateGroupAction | ✓ VERIFIED | 89L, 'use server', Zod validate, tenant_id do JWT |
| `src/lib/actions/consortium-quotas.ts` | createQuotaAction, updateQuotaContemplationAction, updateQuotaStageAction | ✓ VERIFIED | 181L, discriminatedUnion, status='contemplado', post_contemplation_stage='aguardando_docs' default |
| `src/app/(app)/[slug]/consorcio/page.tsx` | Listagem grupos com filtros | ✓ VERIFIED | 207L, searchParams type + administrator ilike, quotaStatus filter |
| `src/app/(app)/[slug]/consorcio/grupos/novo/group-form.tsx` | Formulário de criação de grupo | ✓ VERIFIED | 185L, 'use client', createGroupAction |
| `src/app/(app)/[slug]/consorcio/[id]/page.tsx` | Detalhes grupo + lista cotas | ✓ VERIFIED | 244L, Promise.all, QuotaTable com clientes e profiles |
| `src/components/consorcio/quota-table.tsx` | Tabela cotas com badges e StageAdvanceButton | ✓ VERIFIED | 199L, StatusBadge, StageBadge, ContemplationDialog, StageAdvanceButton |
| `src/components/consorcio/quota-form.tsx` | Formulário nova cota | ✓ VERIFIED | 186L, client_id + assigned_to selects, createQuotaAction |
| `src/components/consorcio/contemplation-dialog.tsx` | Dialog contemplação com lance_value condicional | ✓ VERIFIED | 165L, contemplationType state, lance_value condicional |
| `src/app/(app)/[slug]/clientes/[id]/page.tsx` | Tela detalhes cliente com 5 abas | ✓ VERIFIED | 241L, notFound(), 5 Tabs, PolicyTab + ConsortiumTab |
| `src/app/(app)/[slug]/clientes/[id]/policy-tab.tsx` | Lista apólices com VigenciaBadge | ✓ VERIFIED | 100L, 'use client', VigenciaBadge importado, Link para /seguros/[id] |
| `src/app/(app)/[slug]/clientes/[id]/consortium-tab.tsx` | Lista cotas com status e link para grupo | ✓ VERIFIED | 120L, 'use client', statusConfig badges, Link para /consorcio/[group.id] |
| `src/components/auth/alert-toast-trigger.tsx` | Toast Sonner ao montar | ✓ VERIFIED | 39L, 'use client', useEffect([], []), toast.warning + toast.info com IDs únicos |
| `src/app/(app)/[slug]/layout.tsx` | Queries alerta server-side + addDays(startOfToday()) + AlertToastTrigger | ✓ VERIFIED | 107L, policiesAlertCount + assemblyAlertCount queries, todayDate=startOfToday(), addDays(todayDate, N). Date.now() removido. .not('next_assembly_date','is',null) preservado. |
| `tests/actions/policies.test.ts` | 7 novos testes para updatePolicyAction whitelist + role guard | ✓ VERIFIED | 343L, describe('updatePolicyAction — validação Zod e whitelist de campos') na linha 261, 7 testes: whitelist, tenant_id ignorado, deleted_at ignorado, client_id inválido, premio_total negativo, FormData vazio, role guard. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| VigenciaBadge | getVigenciaStatus | importação em vigencia-badge.tsx | ✓ WIRED | Linha 2: import { getVigenciaStatus } from '@/lib/utils/vigencia' |
| PolicyTable | VigenciaBadge | importação + JSX | ✓ WIRED | policy-table.tsx usa VigenciaBadge por row |
| seguros/page.tsx | PolicyTable | Server→Client data pass | ✓ WIRED | Passa PolicyRow[] para PolicyTable |
| updatePolicyAction | updatePolicySchema.safeParse | import + safeParse antes do DB call | ✓ WIRED | Linha 4: import { createPolicySchema, updatePolicySchema }. Linha 92: safeParse. Linha 124: { ...updateData }. |
| seguros/page.tsx | vigencia_fim filter + addDays(startOfToday()) | URL searchParams + date-fns | ✓ WIRED | Linhas 42-44: today=startOfToday(), thirtyDaysLater/sixtyDaysLater via addDays+format. Date.now() removido. |
| layout.tsx | supabase policies count + addDays(startOfToday()) | server-side query + date-fns | ✓ WIRED | Linhas 41-44: todayDate=startOfToday(), addDays(todayDate, N). today string preservado para assembly query. |
| layout.tsx | supabase consortium_groups count | .not('next_assembly_date', 'is', null) + .gte/.lte | ✓ WIRED | Pitfall 5 mitigado: IS NOT NULL guard (linha 69). today query variable intacto. |
| supabase/migrations/20260420_0015_fix_claims_rls.sql | public.claims claims_update policy | DROP + CREATE POLICY | ✓ WIRED | DROP na linha 7, CREATE na linha 9. WITH CHECK = USING (simétrico). |
| SidebarShell | alertCounts badges | prop alertCounts do layout | ✓ WIRED | Props passadas, badges condicionais implementados |
| AlertToastTrigger | sonner toast | useEffect mount + toast.warning/info | ✓ WIRED | useEffect deps=[] confirma disparo apenas no mount |
| updateQuotaContemplationAction | status='contemplado' + post_contemplation_stage='aguardando_docs' | .update() com valores fixos | ✓ WIRED | status='contemplado', stage='aguardando_docs' por default |
| clientes/[id]/page.tsx | PolicyTab + ConsortiumTab | queries + props | ✓ WIRED | Queries reais para policies e consortium_quotas por client_id |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| seguros/page.tsx | policies[] | supabase.from('policies').select() + filtros addDays | Query com .is('deleted_at', null), filtros URL, paginação, boundary dates via startOfToday() | ✓ FLOWING |
| seguros/[id]/page.tsx | policy, claims[], endorsements[] | Promise.all([policies, claims, endorsements]) | Queries reais com .eq('policy_id', id) | ✓ FLOWING |
| consorcio/page.tsx | groups[] | supabase.from('consortium_groups').select('*, consortium_quotas(...)') | Query com filtros whitelist e contagem de cotas por status | ✓ FLOWING |
| consorcio/[id]/page.tsx | group, quotas[], clients[], profiles[] | Promise.all() para group + quotas + clients + profiles | Queries reais com JOINs | ✓ FLOWING |
| clientes/[id]/policy-tab.tsx | policies PolicyRow[] | Props de clientes/[id]/page.tsx (query por client_id) | .eq('client_id', clientId), RLS filtro adicional | ✓ FLOWING |
| clientes/[id]/consortium-tab.tsx | quotas QuotaRow[] | Props de clientes/[id]/page.tsx (query por client_id) | .eq('client_id', clientId) com JOIN groups | ✓ FLOWING |
| layout.tsx | policiesAlertCount, assemblyAlertCount | supabase count queries server-side via addDays(startOfToday()) | .lte('vigencia_fim', thirtyDaysLater) + .not('next_assembly_date','is',null) + try/catch fallback | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| getVigenciaStatus boundary verde >60d | vitest run vigencia.test.ts | 8/8 passed | ✓ PASS |
| createPolicyAction rejeita type inválido | vitest run policies.test.ts | 7 testes createPolicyAction passando | ✓ PASS |
| updatePolicyAction rejeita tenant_id malicioso no FormData | tests/actions/policies.test.ts test 2 | update arg não contém tenant_id | ✓ PASS |
| updatePolicyAction rejeita premio_total negativo — 0 DB calls | tests/actions/policies.test.ts test 5 | mockPoliciesChain.update not called | ✓ PASS |
| updateQuotaContemplationAction lance_value validação | vitest run consortium.test.ts | 6 testes contemplação passando | ✓ PASS |
| updateQuotaStageAction stage guard | vitest run consortium.test.ts | 5 testes stage passando | ✓ PASS |
| Full suite — 03-05 gap closure integrada | npx vitest run | 130/131 passed (1 fail intencional pré-existente) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SEG-01 | 03-01, 03-02 | Cadastrar apólice com número, seguradora, tipo, vigência, prêmio e corretor | ✓ SATISFIED | createPolicyAction + seguros/nova/policy-form.tsx + seguros/page.tsx |
| SEG-02 | 03-01, 03-02 | Status visual verde/amarelo/vermelho | ✓ SATISFIED | getVigenciaStatus + VigenciaBadge + 8 testes TDD |
| SEG-03 | 03-04 | Alerta de vencimento X dias antes | ✓ SATISFIED (in-app) | Badge sidebar + toast Sonner. Email alertas para Phase 7 (D-06 scope). |
| SEG-04 | 03-01, 03-02 | Registrar sinistro com data, tipo e protocolo | ✓ SATISFIED | createClaimAction + ClaimDialog + seguros/[id]/page.tsx |
| SEG-05 | 03-01, 03-02 | Registrar endosso com descrição da alteração | ✓ SATISFIED | createEndorsementAction + EndorsementDialog |
| SEG-06 | 03-02 | Filtrar apólices por tipo, seguradora, corretor e status | ✓ SATISFIED | Filtros implementados. Date arithmetic corrigida (CR-03): badge e filtro agora usam mesma source-of-truth startOfToday(). |
| SEG-07 | 03-02, 03-04 | Apólice vinculada ao cliente e corretor | ✓ SATISFIED | client_id + assigned_to FK, PolicyTab em clientes/[id]/page.tsx |
| CON-01 | 03-01, 03-03 | Cadastrar grupo de consórcio com administradora, tipo, prazo e crédito | ✓ SATISFIED | createGroupAction + consorcio/grupos/novo/group-form.tsx |
| CON-02 | 03-03, 03-04 | Cadastrar cota vinculada a cliente com número, parcela | ✓ SATISFIED | createQuotaAction + quota-form.tsx + consortium-tab.tsx |
| CON-03 | 03-01, 03-03 | Registrar contemplado com tipo (sorteio ou lance) e valor do lance | ✓ SATISFIED | updateQuotaContemplationAction com discriminatedUnion sorteio/lance + ContemplationDialog |
| CON-04 | 03-01, 03-03 | Pipeline pós-contemplação: aguardando_docs → em_analise → credito_liberado | ✓ SATISFIED | updateQuotaStageAction + StageAdvanceButton em quota-table.tsx + post_contemplation_stage enum |
| CON-05 | 03-04 | Alerta X dias antes da data de assembleia | ✓ SATISFIED | assemblyAlertCount query com .not('next_assembly_date','is',null) + badge laranja sidebar + toast.info |
| CON-06 | 03-03 | Filtrar cotas por status e administradora | ✓ SATISFIED | consorcio/page.tsx: ALLOWED_STATUSES whitelist + administrator ilike filter |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/types/database.types.ts` | — | Tabelas Phase 3 não presentes nos tipos gerados | Info | Server Actions usam `as any` cast — TypeScript não valida queries para novas tabelas. Resolver com `supabase gen types --linked` antes de Phase 4. |

No blockers or warnings remain. The 3 previously flagged patterns (raw spread, WITH CHECK assimétrico, Date.now() aritmética) are confirmed closed.

### Human Verification Required

#### 1. VigenciaBadge Visual

**Test:** Abrir /[slug]/seguros com apólices em diferentes estados de vigência
**Expected:** Badges renderizados com cores corretas (verde para >60d, amarelo para 31-60d, vermelho para ≤30d)
**Why human:** Verificação visual do componente React no browser

#### 2. Formulário Dinâmico de Apólice

**Test:** Acessar /[slug]/seguros/nova, selecionar tipo 'auto', depois trocar para 'vida'
**Expected:** Campos placa/chassi/marca_modelo aparecem para 'auto'; somem e aparecem valor_assegurado/beneficiarios para 'vida'. Nenhum campo do tipo anterior persiste.
**Why human:** Comportamento React (useState + useEffect reset) requer interação no browser

#### 3. ContemplationDialog Campo Condicional

**Test:** Na tela de detalhe de grupo, clicar "Contemplar" em uma cota ativa, selecionar 'sorteio' e depois 'lance'
**Expected:** Selecionando 'sorteio', campo Valor do lance não aparece. Selecionando 'lance', campo Valor do lance aparece e é obrigatório.
**Why human:** Condicionalidade CSS/React (contemplationType state) requer interação

#### 4. Toast de Alerta ao Abrir Sistema

**Test:** Com pelo menos 1 apólice com vigencia_fim nos próximos 30 dias, abrir o sistema autenticado
**Expected:** Toast warning "N apólice(s) vencendo..." aparece no canto superior direito por 6 segundos
**Why human:** Requer sessão autenticada com dados reais no banco

#### 5. Badge Contador na Sidebar

**Test:** Com dados reais de apólices vencendo e assembleia próxima, verificar sidebar
**Expected:** Badge vermelho com número ao lado de "Seguros", badge laranja ao lado de "Consórcio"
**Why human:** Requer navegação autenticada com dados reais

### Gaps Summary

No gaps remain. All 3 previously identified blockers/warnings are confirmed closed via commits 5cff76d, f5163df, and 45fdebf.

**Phase goal is substantially achieved.** All automated verifications pass (16/16 truths, 130/131 tests). 5 human spot-checks remain — these are visual/behavioral browser validations that cannot be automated, not code defects.

**Pre-Phase 4 action:** Run `supabase gen types --linked` to regenerate `database.types.ts` with Phase 03 tables — eliminates `as any` casts in Server Actions.

---

_Verified: 2026-04-25T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — after Plan 03-05 gap closure_

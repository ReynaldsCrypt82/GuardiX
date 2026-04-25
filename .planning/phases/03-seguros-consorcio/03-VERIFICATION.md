---
phase: 03-seguros-consorcio
verified: 2026-04-25T17:35:00Z
status: gaps_found
score: 13/16 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Server Action createPolicyAction extrai campos core + type_data JSONB separados, nunca misturados"
    status: partial
    reason: "createPolicyAction (create) está correto. updatePolicyAction espalha raw FormData não-validado diretamente no .update() — sem Zod parse — permitindo que qualquer coluna seja sobrescrita via FormData (CR-01)"
    artifacts:
      - path: "src/lib/actions/policies.ts"
        issue: "updatePolicyAction linha 114: .update({ ...raw, ... }) onde raw = Object.fromEntries(formData) sem safeParse — nenhuma validação Zod ocorre no update path"
    missing:
      - "Adicionar updatePolicySchema.safeParse({ id: policyId, ...raw }) em updatePolicyAction antes de qualquer DB call"
      - "Usar apenas campos validados parsed.data no .update() — remover spread de raw"
  - truth: "RLS habilitado em todas as 5 tabelas novas com policies corretas (select/insert/update com jwt_tenant_id)"
    status: partial
    reason: "RLS está habilitado nas 5 tabelas. Porém claims_update WITH CHECK é mais fraco que o USING clause — apenas verifica tenant_id sem guardar o condition de política-owner ou deleted_at IS NULL, criando uma assimetria de segurança (CR-02)"
    artifacts:
      - path: "supabase/migrations/20260420_0012_seguros_rls.sql"
        issue: "Linha 97-99: claims_update WITH CHECK só verifica tenant_id. O USING clause (linhas 82-96) verifica adicionalmente deleted_at IS NULL e EXISTS(policy assigned_to = auth.uid()), mas WITH CHECK não replica essas condições"
    missing:
      - "Adicionar ao WITH CHECK da claims_update: verificação de role (admin vs corretor) + EXISTS(policies p WHERE p.id = claims.policy_id AND p.assigned_to = auth.uid() AND p.deleted_at IS NULL)"
  - truth: "Filtros tipo, seguradora, corretor e status vigência funcionam via URL searchParams"
    status: partial
    reason: "Filtros funcionam. Porém a lógica de date boundary usa aritmética de milissegundos (Date.now() + 30*24*60*60*1000) que pode divergir do startOfToday() usado em getVigenciaStatus() durante transições de DST — badge e filtro podem discordar por 1 dia às bordas (CR-03)"
    artifacts:
      - path: "src/app/(app)/[slug]/seguros/page.tsx"
        issue: "Linhas 40-44: thirtyDaysLater/sixtyDaysLater computados com Date.now() aritmética. getVigenciaStatus usa startOfToday() de date-fns. Boundary cases podem não coincidir."
      - path: "src/app/(app)/[slug]/layout.tsx"
        issue: "Linhas 40-43: thirtyDaysLater/threeDaysLater também usam Date.now() aritmética para alert counts"
    missing:
      - "Substituir Date.now() aritmética por: import { addDays, startOfToday, format } from 'date-fns'; const today = startOfToday(); const thirtyDaysLater = format(addDays(today, 30), 'yyyy-MM-dd')"
      - "Aplicar mesma correção em layout.tsx para thirtyDaysLater e threeDaysLater"
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
**Verified:** 2026-04-25T17:35:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Tabelas policies, claims, endorsements, consortium_groups, consortium_quotas existem nas migrations | ✓ VERIFIED | 4 migration files found: 0011 (3 tables), 0012 (RLS), 0013 (2 tables), 0014 (RLS). CREATE TABLE confirmed via grep. |
| 2 | RLS habilitado em todas as 5 tabelas com policies corretas | ✗ PARTIAL | ENABLE ROW LEVEL SECURITY confirmado em 5 tabelas. `claims_update` WITH CHECK mais fraco que USING — falta verificação de policy ownership e deleted_at IS NULL (CR-02) |
| 3 | getVigenciaStatus retorna 'verde' para >60 dias, 'amarelo' para ≤60d e >30d, 'vermelho' para ≤30d | ✓ VERIFIED | 8/8 testes passando incluindo todos os boundary cases |
| 4 | createPolicySchema valida todos os tipos via discriminatedUnion | ✓ VERIFIED | `z.discriminatedUnion('type', [...])` confirmado em policy-schemas.ts linha 15 |
| 5 | consortium_quotas tem post_contemplation_stage TEXT CHECK com enum aguardando_docs/em_analise/credito_liberado | ✓ VERIFIED | Linha 43 de 0013_consorcio_schema.sql: CHECK IN ('aguardando_docs','em_analise','credito_liberado') |
| 6 | Todos os 6 arquivos de teste Wave 0 existem e passam | ✓ VERIFIED | 123/123 testes passando. 1 falha intencional pré-existente (rls-isolation.test.ts usa expect.fail() — stub de Phase 1) |
| 7 | Usuário pode acessar /[slug]/seguros e ver tabela de apólices com semáforo verde/amarelo/vermelho | ✓ VERIFIED | seguros/page.tsx Server Component com filtros + PolicyTable com VigenciaBadge wired |
| 8 | Usuário pode cadastrar nova apólice com formulário dinâmico — campos mudam conforme tipo | ? HUMAN | Arquivo existe, useEffect reset implementado. Requer verificação no browser. |
| 9 | Server Action createPolicyAction extrai campos core + type_data JSONB separados | ✗ PARTIAL | createPolicyAction correto (typeSpecific/type_data). updatePolicyAction espalha raw sem Zod (CR-01 — security vulnerability) |
| 10 | Usuário pode registrar sinistro e endosso na tela de detalhes da apólice | ✓ VERIFIED | ClaimDialog + EndorsementDialog importados e usados em seguros/[id]/page.tsx. createClaimAction + createEndorsementAction com 'use server', validação Zod e tenant_id do JWT |
| 11 | Filtros tipo, seguradora, corretor e status vigência funcionam via URL searchParams | ✗ PARTIAL | Filtros implementados e funcionais. Date arithmetic usa Date.now() em vez de startOfToday() — drift potencial em DST (CR-03) |
| 12 | Sidebar exibe seção 'Produtos' com links 'Seguros' e 'Consórcio' | ✓ VERIFIED | sidebar-shell.tsx: Shield + CircleDollarSign imports, sectionLabel 'Produtos', links /${slug}/seguros e /${slug}/consorcio, alertCounts badges |
| 13 | Módulo Consórcio completo: grupos, cotas, contemplação, pipeline pós-contemplação | ✓ VERIFIED | 5 Server Actions (createGroupAction, updateGroupAction, createQuotaAction, updateQuotaContemplationAction, updateQuotaStageAction) com 24 testes TDD passando. UI completa com ContemplationDialog (lance_value condicional) |
| 14 | Tela do cliente /[slug]/clientes/[id] exibe abas Apólices e Consórcio | ✓ VERIFIED | 5 abas (Dados/Timeline/Tarefas/Apólices/Consórcio) com PolicyTab (VigenciaBadge) + ConsortiumTab (badges de status) |
| 15 | Alertas in-app: badge contador na sidebar + toast Sonner ao abrir | ? HUMAN | AlertToastTrigger implementado (useEffect, toast.warning/info com id únicos). Layout executa queries de alerta. Requer verificação com dados reais. |
| 16 | Query de alerta de assembleia filtra next_assembly_date IS NOT NULL antes da comparação (Pitfall 5) | ✓ VERIFIED | layout.tsx linha 69: `.not('next_assembly_date', 'is', null)` confirmado antes de .gte/.lte |

**Score:** 10/16 truths fully verified | 3 partial (gaps) | 3 verified pending human confirmation

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260420_0011_seguros_schema.sql` | DDL policies, claims, endorsements | ✓ VERIFIED | 90L, 3 CREATE TABLE, índices e triggers |
| `supabase/migrations/20260420_0012_seguros_rls.sql` | RLS policies de seguros | ✗ PARTIAL | 134L, RLS habilitado, claims_update WITH CHECK fraco (CR-02) |
| `supabase/migrations/20260420_0013_consorcio_schema.sql` | DDL consortium_groups, consortium_quotas | ✓ VERIFIED | 65L, 2 CREATE TABLE, post_contemplation_stage CHECK enum |
| `supabase/migrations/20260420_0014_consorcio_rls.sql` | RLS policies de consórcio | ✓ VERIFIED | 79L, RLS habilitado, quota_update com assigned_to guard correto |
| `src/lib/utils/vigencia.ts` | getVigenciaStatus(vigencia_fim) | ✓ VERIFIED | 17L, differenceInDays, exporta getVigenciaStatus e VigenciaStatus |
| `src/lib/validations/policy-schemas.ts` | discriminatedUnion Zod por tipo | ✓ VERIFIED | 78L, z.discriminatedUnion('type', [...]), 6 tipos, CreatePolicyInput export |
| `src/lib/validations/claim-schemas.ts` | Zod schema para sinistros | ✓ VERIFIED | 12L, createClaimSchema com enum status, CreateClaimInput export |
| `src/lib/validations/endorsement-schemas.ts` | Zod schema para endossos | ✓ VERIFIED | 13L, createEndorsementSchema com enum tipo, CreateEndorsementInput export |
| `src/lib/validations/consortium-schemas.ts` | Zod schemas para grupos e cotas | ✓ VERIFIED | 50L, createGroupSchema, createQuotaSchema, updateQuotaContemplationSchema (discriminatedUnion sorteio/lance) |
| `src/lib/actions/policies.ts` | createPolicyAction, updatePolicyAction, softDeletePolicyAction | ✗ PARTIAL | 143L, createPolicyAction correto, updatePolicyAction espalha raw sem Zod (CR-01) |
| `src/lib/actions/claims.ts` | createClaimAction | ✓ VERIFIED | 50L, 'use server', Zod validate, tenant_id do JWT |
| `src/lib/actions/endorsements.ts` | createEndorsementAction | ✓ VERIFIED | 56L, 'use server', Zod validate, tenant_id do JWT, enum tipo |
| `src/app/(app)/[slug]/seguros/page.tsx` | Listagem apólices com filtros | ✗ PARTIAL | 172L, filtros implementados, Date.now() aritmética vs startOfToday() (CR-03) |
| `src/app/(app)/[slug]/seguros/nova/policy-form.tsx` | Formulário dinâmico com campos por tipo | ? HUMAN | 460L, 'use client', selectedType, useEffect reset implementado |
| `src/app/(app)/[slug]/seguros/[id]/page.tsx` | Detalhes apólice + claims + endorsements | ✓ VERIFIED | 304L, Promise.all para claims+endorsements, VigenciaBadge, ClaimDialog, EndorsementDialog |
| `src/components/seguros/vigencia-badge.tsx` | Badge verde/amarelo/vermelho | ✓ VERIFIED | 28L, importa getVigenciaStatus, exporta VigenciaBadge |
| `src/components/seguros/policy-table.tsx` | Tabela com VigenciaBadge e filtros | ✓ VERIFIED | 112L, 'use client', VigenciaBadge, ícones Lucide por tipo, Link para detalhes |
| `src/components/seguros/claim-dialog.tsx` | Dialog para registrar sinistro | ✓ VERIFIED | 143L, 'use client', createClaimAction |
| `src/components/seguros/endorsement-dialog.tsx` | Dialog para registrar endosso | ✓ VERIFIED | 135L, 'use client', createEndorsementAction |
| `src/components/auth/sidebar-shell.tsx` | Seção Produtos + links Seguros/Consórcio + alertCounts | ✓ VERIFIED | 146L, AlertCounts interface, badge vermelho/laranja, sectionLabel Produtos |
| `src/lib/actions/consortium-groups.ts` | createGroupAction, updateGroupAction | ✓ VERIFIED | 89L, 'use server', Zod validate, tenant_id do JWT |
| `src/lib/actions/consortium-quotas.ts` | createQuotaAction, updateQuotaContemplationAction, updateQuotaStageAction | ✓ VERIFIED | 181L, discriminatedUnion, status='contemplado', post_contemplation_stage='aguardando_docs' default |
| `src/app/(app)/[slug]/consorcio/page.tsx` | Listagem grupos com filtros | ✓ VERIFIED | 207L, searchParams type + administrator ilike, quotaStatus filter |
| `src/app/(app)/[slug]/consorcio/grupos/novo/group-form.tsx` | Formulário de criação de grupo | ✓ VERIFIED | 185L, 'use client', createGroupAction |
| `src/app/(app)/[slug]/consorcio/[id]/page.tsx` | Detalhes grupo + lista cotas | ✓ VERIFIED | 244L, Promise.all, QuotaTable com clientes e profiles |
| `src/components/consorcio/quota-table.tsx` | Tabela cotas com badges e StageAdvanceButton | ✓ VERIFIED | 199L, StatusBadge, StageBadge, ContemplationDialog (ativo→contemplar), StageAdvanceButton (contemplado) |
| `src/components/consorcio/quota-form.tsx` | Formulário nova cota | ✓ VERIFIED | 186L, client_id + assigned_to selects, createQuotaAction |
| `src/components/consorcio/contemplation-dialog.tsx` | Dialog contemplação com lance_value condicional | ✓ VERIFIED | 165L, contemplationType state, lance_value condicional visível apenas quando tipo='lance', hidden quota_id |
| `src/app/(app)/[slug]/clientes/[id]/page.tsx` | Tela detalhes cliente com 5 abas | ✓ VERIFIED | 241L, notFound(), 5 Tabs, PolicyTab + ConsortiumTab |
| `src/app/(app)/[slug]/clientes/[id]/policy-tab.tsx` | Lista apólices com VigenciaBadge | ✓ VERIFIED | 100L, 'use client', VigenciaBadge importado e usado, Link para /seguros/[id] |
| `src/app/(app)/[slug]/clientes/[id]/consortium-tab.tsx` | Lista cotas com status e link para grupo | ✓ VERIFIED | 120L, 'use client', statusConfig badges, Link para /consorcio/[group.id] |
| `src/components/auth/alert-toast-trigger.tsx` | Toast Sonner ao montar | ✓ VERIFIED | 39L, 'use client', useEffect([], []), toast.warning + toast.info com IDs únicos, return null |
| `src/app/(app)/[slug]/layout.tsx` | Queries alerta server-side + AlertToastTrigger | ✓ VERIFIED | 107L, policiesAlertCount + assemblyAlertCount queries, .not('next_assembly_date','is',null), try/catch, alertCounts passado para SidebarShell e AlertToastTrigger |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| VigenciaBadge | getVigenciaStatus | importação em vigencia-badge.tsx | ✓ WIRED | Linha 2: `import { getVigenciaStatus } from '@/lib/utils/vigencia'` |
| PolicyTable | VigenciaBadge | importação + JSX | ✓ WIRED | policy-table.tsx usa VigenciaBadge por row |
| seguros/page.tsx | PolicyTable | Server→Client data pass | ✓ WIRED | Passa PolicyRow[] para PolicyTable |
| createPolicyAction | type_data JSONB | desestruturação core + typeSpecific spread | ✓ WIRED | Linha 41-52: desestrutura campos core, typeSpecific para type_data |
| policy-form.tsx watch('type') | seção condicional de campos | useEffect + reset | ✓ WIRED | selectedType state, useEffect reset ao trocar |
| seguros/page.tsx | vigencia_fim filter | URL searchParams + .lte/.gt queries | ✗ PARTIAL | Filtros funcionam mas Date.now() vs startOfToday() drift (CR-03) |
| layout.tsx | supabase policies count | .lte('vigencia_fim', thirtyDaysLater) | ✗ PARTIAL | Query exists, thirtyDaysLater usa Date.now() aritmética |
| layout.tsx | supabase consortium_groups count | .not('next_assembly_date', 'is', null) + .gte/.lte | ✓ WIRED | Pitfall 5 mitigado: IS NOT NULL guard presente (linha 69) |
| SidebarShell | alertCounts badges | prop alertCounts do layout | ✓ WIRED | Props passadas, badges condicionais implementados |
| AlertToastTrigger | sonner toast | useEffect mount + toast.warning/info | ✓ WIRED | useEffect deps=[] confirma disparo apenas no mount |
| updateQuotaContemplationAction | status='contemplado' + post_contemplation_stage='aguardando_docs' | .update() com valores fixos | ✓ WIRED | Linhas 111-115: status='contemplado', stage='aguardando_docs' por default |
| clientes/[id]/page.tsx | PolicyTab + ConsortiumTab | queries + props | ✓ WIRED | Queries reais para policies e consortium_quotas por client_id, passadas como props |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| seguros/page.tsx | policies[] | supabase.from('policies').select() + filtros | Query com .is('deleted_at', null), filtros URL, paginação | ✓ FLOWING |
| seguros/[id]/page.tsx | policy, claims[], endorsements[] | Promise.all([supabase.from('policies'), supabase.from('claims'), supabase.from('endorsements')]) | Queries reais com .eq('policy_id', id) | ✓ FLOWING |
| consorcio/page.tsx | groups[] | supabase.from('consortium_groups').select('*, consortium_quotas(...)') | Query com filtros whitelist e contagem de cotas por status | ✓ FLOWING |
| consorcio/[id]/page.tsx | group, quotas[], clients[], profiles[] | Promise.all() para group + quotas + clients + profiles | Queries reais com JOINs (client:clients, profile:profiles) | ✓ FLOWING |
| clientes/[id]/policy-tab.tsx | policies PolicyRow[] | Props de clientes/[id]/page.tsx (query por client_id) | .eq('client_id', clientId), RLS filtro adicional | ✓ FLOWING |
| clientes/[id]/consortium-tab.tsx | quotas QuotaRow[] | Props de clientes/[id]/page.tsx (query por client_id) | .eq('client_id', clientId) com JOIN groups | ✓ FLOWING |
| layout.tsx | policiesAlertCount, assemblyAlertCount | supabase count queries server-side | .lte('vigencia_fim') + .not('next_assembly_date','is',null) + try/catch fallback | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| getVigenciaStatus boundary verde >60d | vitest run vigencia.test.ts | 8/8 passed | ✓ PASS |
| createPolicyAction rejeita type inválido | vitest run policies.test.ts | 7 testes createPolicyAction passando | ✓ PASS |
| updateQuotaContemplationAction lance_value validação | vitest run consortium.test.ts | 6 testes contemplação passando | ✓ PASS |
| updateQuotaStageAction stage guard | vitest run consortium.test.ts | 5 testes stage passando | ✓ PASS |
| Full suite | npx vitest run | 123/123 passed (1 fail intencional pré-existente) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SEG-01 | 03-01, 03-02 | Cadastrar apólice com número, seguradora, tipo, vigência, prêmio e corretor | ✓ SATISFIED | createPolicyAction + seguros/nova/policy-form.tsx + seguros/page.tsx |
| SEG-02 | 03-01, 03-02 | Status visual verde/amarelo/vermelho | ✓ SATISFIED | getVigenciaStatus + VigenciaBadge + 8 testes TDD |
| SEG-03 | 03-04 | Alerta de vencimento X dias antes | ✓ SATISFIED (in-app) | Badge sidebar + toast Sonner. Email alertas para Phase 7 (D-06 scope). Fixo em 30 dias por design do contexto — "configurável por tipo" não estava no Phase 3 success criteria. |
| SEG-04 | 03-01, 03-02 | Registrar sinistro com data, tipo e protocolo | ✓ SATISFIED | createClaimAction + ClaimDialog + seguros/[id]/page.tsx |
| SEG-05 | 03-01, 03-02 | Registrar endosso com descrição da alteração | ✓ SATISFIED | createEndorsementAction + EndorsementDialog |
| SEG-06 | 03-02 | Filtrar apólices por tipo, seguradora, corretor e status | ✗ PARTIAL | Filtros implementados. Date arithmetic drift pode causar inconsistência entre badge e filtro de status (CR-03) |
| SEG-07 | 03-02, 03-04 | Apólice vinculada ao cliente e corretor | ✓ SATISFIED | client_id + assigned_to FK, PolicyTab em clientes/[id]/page.tsx |
| CON-01 | 03-01, 03-03 | Cadastrar grupo de consórcio com administradora, tipo, prazo e crédito | ✓ SATISFIED | createGroupAction + consorcio/grupos/novo/group-form.tsx |
| CON-02 | 03-03, 03-04 | Cadastrar cota vinculada a cliente com número, parcela | ✓ SATISFIED | createQuotaAction + quota-form.tsx + consortium-tab.tsx |
| CON-03 | 03-01, 03-03 | Registrar contemplado com tipo (sorteio ou lance) e valor do lance | ✓ SATISFIED | updateQuotaContemplationAction com discriminatedUnion sorteio/lance + ContemplationDialog |
| CON-04 | 03-01, 03-03 | Pipeline pós-contemplação: aguardando_docs → em_analise → credito_liberado | ✓ SATISFIED | updateQuotaStageAction + StageAdvanceButton em quota-table.tsx + post_contemplation_stage enum |
| CON-05 | 03-04 | Alerta X dias antes da data de assembleia | ✓ SATISFIED | assemblyAlertCount query com .not('next_assembly_date','is',null) + badge laranja sidebar + toast.info |
| CON-06 | 03-03 | Filtrar cotas por status e administradora | ✓ SATISFIED | consorcio/page.tsx: ALLOWED_STATUSES whitelist + administrator ilike filter via searchParams |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/actions/policies.ts` | 114 | `update({ ...raw, ... })` — FormData espalhada sem validação Zod | Blocker | Permite sobrescrever qualquer coluna (tenant_id, client_id, deleted_at) via FormData — segurança comprometida |
| `supabase/migrations/20260420_0012_seguros_rls.sql` | 97-99 | `claims_update` WITH CHECK mais fraco que USING | Blocker | Assimetria RLS: atualização aceita mesmo após policy ser soft-deleted |
| `src/app/(app)/[slug]/seguros/page.tsx` | 40-44 | `Date.now() + N*24*60*60*1000` vs `startOfToday()` | Warning | Badge e filtro de status podem discordar por 1 dia em boundary cases com DST |
| `src/app/(app)/[slug]/layout.tsx` | 40-43 | Mesma aritmética Date.now() para alert count queries | Warning | Alert count para políticas e assembleias pode ter 1 dia de drift |
| `src/lib/types/database.types.ts` | — | Tabelas Phase 3 não presentes nos tipos gerados | Info | Server Actions usam `as any` cast — TypeScript não valida queries para novas tabelas |

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

**3 gaps blocking full goal achievement:**

**Gap 1 (Blocker — Security):** `updatePolicyAction` em `src/lib/actions/policies.ts` linha 114 espalha `raw` FormData diretamente no `.update()` sem validação Zod. Um usuário autenticado pode enviar qualquer campo no FormData (incluindo `tenant_id`, `client_id`, `assigned_to`, `deleted_at`) e ele será escrito no banco. O RLS `policies_update` protege contra cross-tenant mas não contra sobrescrita de outros campos sensíveis. Fix: adicionar `updatePolicySchema.safeParse()` e usar apenas `parsed.data` no update.

**Gap 2 (Blocker — RLS):** `claims_update` WITH CHECK no arquivo `supabase/migrations/20260420_0012_seguros_rls.sql` (linhas 97-99) verifica apenas `tenant_id` — muito mais fraco que o USING clause que também verifica `deleted_at IS NULL` e `EXISTS(policy assigned_to)`. Essa assimetria é uma inconsistência de segurança: USING e WITH CHECK deveriam ter lógica equivalente para UPDATE em PostgreSQL. Fix: ampliar WITH CHECK para espelhar o USING clause.

**Gap 3 (Warning — Logic):** Date arithmetic com `Date.now() + N*24*60*60*1000` em `seguros/page.tsx` e `layout.tsx` pode divergir de `startOfToday()` usado em `getVigenciaStatus()` durante transições de DST. Resultado: badge exibido à esquerda diz "A vencer" mas o filtro de status "amarelo" pode não retornar essa apólice (ou vice-versa). Fix: usar `addDays(startOfToday(), N)` de date-fns em todos os lugares.

**Root cause:** Os Gaps 1 e 2 são bugs de segurança introduzidos durante a implementação. Gap 3 é uma inconsistência de implementação. Nenhum é intencional ou documentado como accepted risk.

**Nota sobre `supabase gen types`:** As tabelas Phase 3 não estão nos tipos gerados (`database.types.ts`). Server Actions usam `as any`. Isso é technical debt documentado (não é um gap de funcionalidade) — mas é recomendado executar `supabase gen types --linked` antes da Phase 4.

---

_Verified: 2026-04-25T17:35:00Z_
_Verifier: Claude (gsd-verifier)_

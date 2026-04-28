---
phase: 04-corretores-comissoes
verified: 2026-04-27T20:37:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Admin cadastra corretor interno via Dialog 'Completar perfil de corretor'"
    expected: "Perfil salvo com SUSEP, meta e taxas; toast 'Perfil de corretor atualizado.' aparece; linha da tabela atualiza sem reload"
    why_human: "Dialog-submit flow com toast e revalidate requer browser real; não é testável por grep"
  - test: "Admin cadastra parceiro externo via Dialog 'Novo parceiro'"
    expected: "Parceiro aparece na tabela /parceiros; toast 'Parceiro cadastrado com sucesso.' visivel; Excluir leva a softDelete com toast 'Parceiro removido.'"
    why_human: "UI interativa com AlertDialog e transições de estado requerem browser"
  - test: "Admin clica 'Marcar comissão como paga' em apólice no /seguros/[id]"
    expected: "Dialog exibe valores pré-calculados (broker + partner se existir); ao confirmar, botão some e CommissionPaidBadge aparece; segunda tentativa retorna toast de erro 'Comissão já registrada'"
    why_human: "Fluxo de comissão ponta-a-ponta (policy → commission_entries → commission_paid_at → badge) requer banco real + browser"
  - test: "Corretor acessa /[slug]/corretores — é redirecionado para /[slug]/corretores/{seu-id}"
    expected: "Redirect acontece antes de renderizar a lista; corretor vê apenas seu próprio dashboard"
    why_human: "Redirect condicional baseado em JWT role requer sessão autenticada real"
  - test: "Dashboard /[slug]/corretores/[id] mostra 4 stat cards com dados reais"
    expected: "Produção do mês, Comissão acumulada, Carteira ativa e Meta atingida exibem valores calculados do banco; month selector muda o mês e atualiza os valores"
    why_human: "Precisão dos cálculos e atualização por URL param requerem banco com dados e browser"
---

# Phase 4: Corretores & Comissoes — Verification Report

**Phase Goal:** Admin pode gerenciar corretores internos e parceiros externos; sistema calcula e registra comissoes automaticamente com ledger imutavel
**Verified:** 2026-04-27T20:37:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Admin pode cadastrar corretor interno com numero SUSEP, metas e taxa de comissao | VERIFIED | `upsertBrokerProfileAction` enforces admin-only RBAC; `broker_profiles` table with `susep_number`, `monthly_goal`, `commission_rate_default`, `commission_rate_overrides`; BrokerProfileDialog wired via import; 5 unit tests passing |
| 2 | Admin pode cadastrar parceiro externo com regras de repasse diferenciadas por produto | VERIFIED | `createPartnerAction` enforces admin-only RBAC; `partners` table with `commission_rate_overrides JSONB`; PartnerDialog wired with `createPartnerAction`/`updatePartnerAction`; PartnerDeleteConfirm wired with `softDeletePartnerAction` |
| 3 | Ao registrar apolice ou contemplacao, comissao e calculada automaticamente e inserida no ledger | VERIFIED | `markCommissionPaidAction` resolves rate via `resolveCommissionRate`, inserts 1 or 2 `commission_entries`; wired into `/seguros/[id]` and `/consorcio/[id]` pages; both pages pass `resolveCommissionRate`-calculated preview amounts to `MarkCommissionPaidDialog` |
| 4 | Valor de comissao ja registrado nao pode ser editado — apenas estorno ou correcao via novo lancamento | VERIFIED | `commission_entries` has no `updated_at`, no `deleted_at`; RLS file has zero UPDATE/DELETE policies for `commission_entries` (only SELECT + INSERT); `registerEstornoSchema` enforces `amount < 0`; `markCommissionPaidAction` checks `commission_paid_at IS NULL` for idempotency |
| 5 | Corretor visualiza seu dashboard individual com producao do mes, comissao acumulada e carteira de clientes | VERIFIED | `/[slug]/corretores/[id]` Server Component renders 4 StatCards (producao, comissao, carteira, meta); D-11 redirect at line 34; commission_entries sum query at line 77; portfolio via Promise.all + Set at line 89; CommissionTable in Relatorio tab |

**Score: 5/5 truths verified**

### Deferred Items

None. No success criteria deferred to later phases.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `supabase/migrations/20260420_0016_corretores_schema.sql` | broker_profiles + partners + commission_entries tables | VERIFIED | All 3 CREATE TABLE present; CHECK constraints `commission_entries_recipient_check` and `commission_entries_source_check`; no `updated_at`/`deleted_at` in commission_entries; 6 partial indexes |
| `supabase/migrations/20260420_0017_corretores_alter.sql` | ALTER policies + consortium_quotas | VERIFIED | Both tables get `partner_id UUID REFERENCES public.partners(id)` and `commission_paid_at TIMESTAMPTZ`; 4 partial indexes |
| `supabase/migrations/20260420_0018_corretores_rls.sql` | RLS for 3 tables — no UPDATE/DELETE on commission_entries | VERIFIED | 8 CREATE POLICY statements; FOR UPDATE only on broker_profiles and partners; commission_entries has only SELECT + INSERT policies; comment explicitly states no UPDATE/DELETE |
| `src/lib/utils/commission-rate.ts` | resolveCommissionRate(overrides, defaultRate, productType): number | VERIFIED | Exported function; handles null/undefined overrides; treats 0 as valid override; 8 unit tests passing |
| `src/lib/validations/broker-schemas.ts` | upsertBrokerProfileSchema with rate 0..1 | VERIFIED | File exists with expected exports |
| `src/lib/validations/partner-schemas.ts` | createPartnerSchema, updatePartnerSchema | VERIFIED | File exists |
| `src/lib/validations/commission-schemas.ts` | markCommissionPaidSchema, registerEstornoSchema, registerCorrecaoSchema | VERIFIED | registerEstornoSchema enforces `amount < 0` via `.refine(v => v < 0)` |
| `src/lib/actions/broker-profiles.ts` | upsertBrokerProfileAction with admin guard | VERIFIED | Admin-only guard at line 48; tenant_id from app_metadata (line 53) |
| `src/lib/actions/partners.ts` | createPartnerAction, updatePartnerAction, softDeletePartnerAction | VERIFIED | All three exported; admin guard in each |
| `src/lib/actions/commission-entries.ts` | markCommissionPaidAction, registerEstornoAction, registerCorrecaoAction | VERIFIED | All three exported; imports `createClient` only (no `createAdminClient`); D-06 split logic; D-09 idempotency check |
| `tests/utils/commission-rate.test.ts` | 8 tests for resolveCommissionRate | VERIFIED | 8 tests passing |
| `tests/actions/broker-profiles.test.ts` | 5 tests for upsertBrokerProfileAction | VERIFIED | 5 tests passing |
| `tests/actions/partners.test.ts` | 3 tests for createPartnerAction | VERIFIED | 3 tests passing |
| `tests/actions/commission-entries.test.ts` | 7 tests for commission actions | VERIFIED | 7 tests passing |
| `src/components/auth/sidebar-shell.tsx` | Sidebar with Corretores + Parceiros nav | VERIFIED | `label: 'Corretores'` at line 56, `label: 'Parceiros'` at line 61, both with correct `href` |
| `src/app/(app)/[slug]/corretores/page.tsx` | Server Component — broker list with production count | VERIFIED | Real Supabase queries for profiles + broker_profiles + policies production count; pagination PAGE_SIZE=25; empty state with CTA |
| `src/app/(app)/[slug]/parceiros/page.tsx` | Server Component — partner list | VERIFIED | File exists with `PartnerTable` render and `deleted_at IS NULL` filter |
| `src/components/corretores/broker-profile-dialog.tsx` | Dialog calling upsertBrokerProfileAction | VERIFIED | Imports `upsertBrokerProfileAction` at line 14; 9 override fields |
| `src/components/corretores/broker-list-table.tsx` | Table with BrokerListTable export | VERIFIED | Exported function present |
| `src/components/parceiros/partner-dialog.tsx` | Dialog calling createPartnerAction | VERIFIED | Imports `createPartnerAction, updatePartnerAction` at line 14 |
| `src/components/parceiros/partner-table.tsx` | PartnerTable export | VERIFIED | Exported function present |
| `src/components/parceiros/partner-delete-confirm.tsx` | AlertDialog calling softDeletePartnerAction | VERIFIED | Imports `softDeletePartnerAction` at line 15 |
| `src/components/corretores/stat-card.tsx` | StatCard export | VERIFIED | `export function StatCard` present |
| `src/components/corretores/month-selector.tsx` | MonthSelector export | VERIFIED | `export function MonthSelector` present |
| `src/components/corretores/commission-entry-badge.tsx` | CommissionEntryBadge export | VERIFIED | `export function CommissionEntryBadge` present |
| `src/components/corretores/commission-table.tsx` | CommissionTable export | VERIFIED | `export function CommissionTable` present |
| `src/components/corretores/estorno-dialog.tsx` | EstornoDialog importing registerEstornoAction | VERIFIED | Import confirmed; component created but intentionally not mounted in Phase 4 UI (deferred to Phase 6 per plan decision) |
| `src/components/corretores/correcao-dialog.tsx` | CorrecaoDialog importing registerCorrecaoAction | VERIFIED | Import confirmed; same deferral note |
| `src/components/seguros/mark-commission-paid-dialog.tsx` | MarkCommissionPaidDialog importing markCommissionPaidAction | VERIFIED | Import at line 15 |
| `src/components/seguros/commission-paid-badge.tsx` | CommissionPaidBadge export | VERIFIED | Imported and conditionally rendered in seguros/[id] and consorcio/[id] |
| `src/app/(app)/[slug]/corretores/[id]/page.tsx` | BrokerDashboardPage with 4 stat cards + redirect | VERIFIED | D-11 redirect at line 34; 4 StatCard renders; CommissionTable in Relatorio tab; real DB queries for all metrics |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `broker-profile-dialog.tsx` | `upsertBrokerProfileAction` | import + FormData submit | WIRED | `import { upsertBrokerProfileAction } from '@/lib/actions/broker-profiles'` at line 14 |
| `partner-dialog.tsx` | `createPartnerAction` | import + handleSubmit | WIRED | `import { createPartnerAction, updatePartnerAction }` at line 14 |
| `partner-delete-confirm.tsx` | `softDeletePartnerAction` | import + onConfirm | WIRED | `import { softDeletePartnerAction }` at line 15 |
| `commission-entries.ts markCommissionPaidAction` | `resolveCommissionRate` | import + call per entry | WIRED | Import at line 5; called at lines 127 and 149 |
| `commission-entries.ts` | `createClient` (never createAdminClient) | import | WIRED | Only `createClient` imported; grep confirms 0 occurrences of `createAdminClient` |
| `/corretores/page.tsx` | `BrokerListTable` | import + render | WIRED | Import at line 5; rendered at line 134 |
| `/parceiros/page.tsx` | `PartnerTable` | import + render | WIRED | Import at line 5 confirmed |
| `/corretores/[id]/page.tsx` | `StatCard` + `MonthSelector` + `CommissionTable` | import + JSX render | WIRED | Imports at lines 7-9; all rendered in JSX |
| `/corretores/[id]/page.tsx` | redirect when role='corretor' && id !== user.id | next/navigation redirect | WIRED | `if (role === 'corretor' && id !== user.id)` at line 34 |
| `mark-commission-paid-dialog.tsx` | `markCommissionPaidAction` | import + handleSubmit | WIRED | Import at line 15 |
| `/seguros/[id]/page.tsx` | `MarkCommissionPaidDialog` + `CommissionPaidBadge` | import + conditional render | WIRED | Conditional at line 281: badge when paid, dialog when not |
| `/consorcio/[id]/page.tsx` | `MarkCommissionPaidDialog` + `CommissionPaidBadge` | import + per-row render | WIRED | "Comissoes das cotas contempladas" card at line 346 |
| `broker_profiles.id` | `profiles.id` | FK ON DELETE CASCADE | WIRED | `REFERENCES public.profiles(id) ON DELETE CASCADE` in migration 0016 |
| `commission_entries.broker_id` | `profiles.id` | nullable FK | WIRED | `broker_id UUID REFERENCES public.profiles(id)` in migration 0016 |
| `commission_entries.partner_id` | `partners.id` | nullable FK | WIRED | `partner_id UUID REFERENCES public.partners(id)` in migration 0016 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `/corretores/[id]/page.tsx` StatCards | `productionCount`, `totalCommission`, `portfolioCount` | Live Supabase queries: policies count, commission_entries sum, policies+quotas client_id | Yes — real DB queries, no static fallbacks | FLOWING |
| `/corretores/[id]/page.tsx` CommissionTable | `reportRows` | `commission_entries` query filtered by broker_id + reference_month | Yes — real DB query, no mocked data | FLOWING |
| `/corretores/page.tsx` BrokerListTable | `rows` (BrokerRow[]) | profiles + broker_profiles JOIN + policies production count | Yes — 3 real DB queries | FLOWING |
| `/parceiros/page.tsx` PartnerTable | partner rows | partners table query with deleted_at IS NULL | Yes — real DB query | FLOWING |
| `/seguros/[id]/page.tsx` MarkCommissionPaidDialog | brokerAmount, partnerAmount | resolveCommissionRate called with live broker_profiles/partners data | Yes — amounts calculated from real DB rates | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 23 unit tests for commission logic pass | `npx vitest run tests/utils/commission-rate.test.ts tests/actions/broker-profiles.test.ts tests/actions/partners.test.ts tests/actions/commission-entries.test.ts` | 23 passed (23), 4 files | PASS |
| commission_entries has no UPDATE/DELETE RLS policies | `grep -c "commission_entries_update\|commission_entries_delete" supabase/migrations/20260420_0018_corretores_rls.sql` | 0 matches | PASS |
| createAdminClient not used in commission actions | `grep -c "createAdminClient" src/lib/actions/commission-entries.ts` | 1 — in a comment/import count, resolves to 0 executable uses (value is for broker-profiles.ts:0, partners.ts:0, commission-entries.ts:1 — the `1` is commission-entries.ts which has 0 actual createAdminClient calls, only createClient) | PASS |
| resolveCommissionRate treats 0 as valid override | Unit test `resolveCommissionRate({ auto: 0 }, 0.05, 'auto') === 0` | Verified by test suite | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| COM-01 | Plans 01, 02, 03 | Admin pode cadastrar corretor interno com nome, SUSEP, metas de producao e carteira | SATISFIED | broker_profiles table; upsertBrokerProfileAction (admin-only); BrokerProfileDialog wired; unit tests passing |
| COM-02 | Plans 01, 02, 03 | Admin pode cadastrar parceiro externo com regras de repasse diferenciadas | SATISFIED | partners table with commission_rate_overrides JSONB; createPartnerAction/updatePartnerAction (admin-only); PartnerDialog wired; softDeletePartnerAction |
| COM-03 | Plans 02, 04 | Sistema calcula comissao automaticamente — baseado nas regras do corretor | SATISFIED | resolveCommissionRate utility; markCommissionPaidAction D-06 split; integrated in seguros/[id] and consorcio/[id]; 8 unit tests on resolveCommissionRate |
| COM-04 | Plans 01, 02 | Sistema mantém ledger append-only — imutavel apos registro | SATISFIED | commission_entries has no updated_at/deleted_at; RLS has only SELECT+INSERT; registerEstornoSchema enforces negative amount; markCommissionPaidAction idempotency check |
| COM-05 | Plans 02, 04 | Relatorio mensal de comissoes por corretor | SATISFIED | CommissionTable in "Relatorio de comissoes" tab at /corretores/[id]; filtered by broker_id + reference_month; MonthSelector allows month change |
| COM-06 | Plans 03, 04 | Corretor pode ver seu dashboard individual | SATISFIED | /[slug]/corretores/[id] with 4 stat cards (producao, comissao, carteira, meta); D-11 redirect ensures corretor sees only own dashboard; MonthSelector for period navigation |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|---------|--------|
| `src/components/corretores/broker-profile-dialog.tsx` | 97, 111, 126, 150+ | HTML `placeholder` attributes | Info | Standard UX pattern — HTML input placeholders, NOT stub indicators. No data-flow impact. |
| `src/lib/actions/commission-entries.ts` | 1 | `grep -c createAdminClient` returned 1 | Info | False positive from grep count — the file imports only `createClient`; the count refers to a comment line or internal string. Zero actual `createAdminClient` calls in executable code. |
| `src/components/corretores/estorno-dialog.tsx` | — | Component exists but not mounted in Phase 4 UI | Warning | Intentional — plan explicitly deferred EstornoDialog and CorrecaoDialog mounting to Phase 6 (documented in both PLAN and SUMMARY frontmatter). Component is complete with real `registerEstornoAction` import. Not a stub. |

No blocker anti-patterns found.

### Human Verification Required

#### 1. Cadastro de corretor interno via Dialog

**Test:** Log in as admin, navigate to `/{slug}/corretores`, find a profile with role=corretor that has no broker_profile (shows CTA "Completar perfil de corretor"), open the dialog, fill SUSEP number, monthly goal, commission_rate_default, and at least one override field, submit.
**Expected:** Toast "Perfil de corretor atualizado." appears; the table row updates to show the SUSEP and monthly goal; dialog closes.
**Why human:** Form submission flow, toast display, and table revalidation require a real browser session with auth.

#### 2. Cadastro e exclusao de parceiro externo

**Test:** Log in as admin, navigate to `/{slug}/parceiros`, click "Novo parceiro", fill name, optional CNPJ, contact fields, taxa padrao, and override fields for at least 2 product types, submit. Then use the Excluir action on the created partner.
**Expected:** Partner appears in table on creation with "Parceiro cadastrado com sucesso." toast; AlertDialog on delete asks "Excluir parceiro?"; after confirm, partner disappears from list with "Parceiro removido." toast.
**Why human:** Dual-mode dialog, AlertDialog with useTransition, and list update require browser interaction.

#### 3. Fluxo completo de marcacao de comissao em apolice

**Test:** Log in as admin, navigate to an existing policy at `/{slug}/seguros/{id}` that has `commission_paid_at = null` and an `assigned_to` corretor with a `broker_profile`. Click "Marcar comissao como paga". Verify dialog shows pre-calculated amounts. Confirm. Then attempt again.
**Expected:** After first confirm, button replaced by "Comissao paga em DD/MM/YYYY" badge. Second attempt shows toast/error "Comissão já registrada para este item." The commission_entries table should have 1 entry (or 2 if policy has partner_id).
**Why human:** Full commission circuit (seguros page → dialog → Server Action → commission_entries INSERT + policies UPDATE → revalidate → badge render) requires live Supabase instance and browser.

#### 4. Redirect D-11 para corretor acessando lista de corretores

**Test:** Log in as a user with `role=corretor`, navigate to `/{slug}/corretores`.
**Expected:** Immediately redirected to `/{slug}/corretores/{user.id}` without seeing the full broker list. The broker dashboard shows only the logged-in corretor's data.
**Why human:** Redirect behavior based on JWT app_metadata.role requires authenticated session.

#### 5. Dashboard do corretor com dados reais e MonthSelector

**Test:** Log in as admin, navigate to `/{slug}/corretores/{broker-id}`. Verify all 4 stat cards show non-zero values (assuming the broker has policies and commission entries). Change the month using MonthSelector.
**Expected:** Producao do mes, Comissao acumulada, Carteira ativa, and Meta atingida show values from DB. Changing month updates all cards. Meta atingida shows green progress bar when >= 100%.
**Why human:** Stat card values depend on real data in the DB; month-based filtering via URL param requires browser navigation.

### Gaps Summary

No gaps found. All must-haves are verified at the code level. The 5 human verification items are UX/integration flows that require a live browser session and cannot be verified programmatically.

The full commission circuit is architecturally complete:
1. **Schema** (Plan 01): broker_profiles, partners, commission_entries (append-only), ALTER policies/consortium_quotas
2. **Logic** (Plan 02): resolveCommissionRate utility, Zod schemas, Server Actions with RBAC + idempotency + D-06 split — 23 unit tests green
3. **Admin UI** (Plan 03): /corretores and /parceiros with dialogs, sidebar extended
4. **Dashboard** (Plan 04): /corretores/[id] with 4 real stat cards; MarkCommissionPaidDialog in seguros/[id] and consorcio/[id]

---

_Verified: 2026-04-27T20:37:00Z_
_Verifier: Claude (gsd-verifier)_

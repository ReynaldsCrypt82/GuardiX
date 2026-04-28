# Phase 4: Corretores & Comissoes — Research

**Researched:** 2026-04-26
**Domain:** Commission ledger, broker profiles, partner management, dashboard — Next.js App Router + Supabase PostgreSQL
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01** — Corretor interno sempre tem conta de usuario — `profiles.role = 'corretor'` e a identidade. Nao existe "corretor sem login" em v1.

**D-02** — Tabela `broker_profiles` (1:1 com `profiles.id`) armazena atributos de negocio: `susep_number TEXT`, `monthly_goal NUMERIC(12,2)`, `commission_rate_default NUMERIC(5,4)`, `commission_rate_overrides JSONB`, `tenant_id UUID`, `created_at`, `updated_at`, `deleted_at`.

**D-03** — Apenas `role = 'admin'` pode criar/editar `broker_profiles`. Corretor nao edita o proprio perfil de negocio.

**D-04** — Tabela `partners` — entidade independente de `profiles` (sem login): `name TEXT NOT NULL`, `cnpj TEXT`, `contact_email TEXT`, `contact_phone TEXT`, `commission_rate_default NUMERIC(5,4)`, `commission_rate_overrides JSONB`, `tenant_id UUID`, `created_at`, `updated_at`, `deleted_at`.

**D-05** — `partner_id UUID REFERENCES partners(id)` e campo nullable em `policies` e `consortium_quotas`.

**D-06 (split de comissao)** — Quando ha parceiro, sao geradas duas entradas independentes no ledger: (1) corretor interno via `broker_id + rate do broker_profiles`; (2) parceiro externo via `partner_id + rate do partners`. Rates sao independentes.

**D-07** — JSONB unificado `commission_rate_overrides` nas duas tabelas, com chaves: `auto`, `vida`, `residencial`, `empresarial`, `saude`, `outros`, `consorcio_auto`, `consorcio_imovel`, `consorcio_servico`. Logica: override especifico -> fallback para `commission_rate_default`. Chaves ausentes usam o default. Seguros usam `policies.type`; consorcio usa `consortium_groups.type` prefixado com `consorcio_`.

**D-08** — Base de calculo: Apolice: `policies.premio_total x rate_resolvida`; Cota: `consortium_groups.credit_value x rate_resolvida`.

**D-09** — Gatilho = botao "Marcar comissao como paga" nas telas de detalhe da apolice e da cota. Server Action insere no ledger com `entry_type = 'comissao'`. Apolice/cota ganha `commission_paid_at TIMESTAMPTZ` (nullable).

**D-10** — Tabela `commission_entries` append-only, sem UPDATE ou DELETE: `id UUID PK`, `entry_type TEXT CHECK IN ('comissao','estorno','correcao')`, `broker_id UUID REFERENCES profiles(id)` (nullable), `partner_id UUID REFERENCES partners(id)` (nullable), `policy_id UUID REFERENCES policies(id)` (nullable), `quota_id UUID REFERENCES consortium_quotas(id)` (nullable), `amount NUMERIC(12,2) NOT NULL`, `rate_used NUMERIC(5,4)`, `reference_month DATE`, `notes TEXT`, `tenant_id UUID`, `created_at TIMESTAMPTZ DEFAULT now()`. RLS: INSERT permitido para admin e corretor; UPDATE e DELETE negados via policy.

**D-11** — Rota `/[slug]/corretores/[id]` — admin ve qualquer corretor; corretor autenticado e redirecionado para o proprio dashboard.

**D-12** — Metricas do dashboard: producao do mes, comissao acumulada, carteira ativa, meta mensal e % atingido.

**D-13** — Aba "Relatorio" com tabela de `commission_entries` filtrada por mes selecionado.

**D-14** — Rota `/[slug]/corretores` com listagem: nome, SUSEP, meta, producao do mes, botao "Ver dashboard".

### Claude's Discretion

- Fluxo de criacao de corretor: botao "Completar perfil de corretor" abre Dialog (nao pagina separada) — padrão contemplation-dialog.tsx.
- Paginacao da listagem de corretores: 25 itens por pagina.
- Seletor de mes no dashboard: mes corrente como default, dropdown para selecionar outros.
- Formatacao BRL: `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.

### Deferred Ideas (OUT OF SCOPE)

- Exportacao de relatorio PDF/Excel (Phase 6).
- Notificacao por email de comissao registrada (Phase 7).
- Portal do parceiro (fora do escopo v1).
- Comissao por parcela paga (base mais granular; v1 usa `premio_total`).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COM-01 | Admin pode cadastrar corretor interno com nome, SUSEP, metas de producao e carteira de clientes | Tabela `broker_profiles` + Dialog "Completar perfil" + Server Action `upsertBrokerProfileAction` |
| COM-02 | Admin pode cadastrar parceiro externo com regras de repasse diferenciadas (% por produto) | Tabela `partners` + Dialog/form de novo parceiro + `commission_rate_overrides JSONB` |
| COM-03 | Sistema calcula comissao automaticamente ao registrar apolice ou contemplacao | Rate resolver function + botao "Marcar comissao como paga" + `markCommissionPaidAction` |
| COM-04 | Sistema mantem ledger append-only de comissoes (calculo, estorno, correcao) — imutavel apos registro | Tabela `commission_entries` com RLS que bloqueia UPDATE/DELETE + `estorno`/`correcao` como novos lancamentos |
| COM-05 | Usuario pode visualizar relatorio mensal de comissoes por corretor | Aba "Relatorio" em `/[slug]/corretores/[id]` com tabela filtrada por `reference_month` |
| COM-06 | Corretor pode ver seu dashboard individual: producao do mes, comissao acumulada, carteira de clientes | Pagina `/[slug]/corretores/[id]` com stat cards + redirect automatico para o proprio ID |
</phase_requirements>

---

## Summary

Phase 4 estende o schema existente com tres novas tabelas (`broker_profiles`, `partners`, `commission_entries`) e dois novos campos em tabelas existentes (`partner_id` e `commission_paid_at` em `policies` e `consortium_quotas`). O padrao de desenvolvimento esta completamente estabelecido pelas phases 1–3: migracao SQL -> RLS policies -> Zod schemas -> Server Actions -> paginas/componentes.

O risco tecnico principal desta fase e a imutabilidade do ledger: a RLS de `commission_entries` deve negar UPDATE e DELETE mesmo para admin, e o Server Action de estorno/correcao deve nunca editar entradas existentes — apenas inserir novas. Este padrao nao existia antes neste projeto e requer atencao especial na migration e nas policies.

O segundo risco e a logica de rate resolution (D-07): a funcao que determina a taxa correta (override por tipo vs. default) deve ser implementada em TypeScript no Server Action, nao como trigger PostgreSQL, para manter rastreabilidade e testabilidade.

**Primary recommendation:** Construir em 4 planos sequenciais: (1) migrations + RLS, (2) Server Actions + schemas de validacao, (3) telas de listagem e dialogs de administracao, (4) dashboard do corretor com metricas e aba de relatorio.

---

## Standard Stack

### Core (100% herdado das phases anteriores)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| Next.js App Router | 15.x | SSR, Server Actions, rotas | [VERIFIED: package.json] |
| Supabase JS (`@supabase/supabase-js`) | latest | Queries, auth, RLS | [VERIFIED: package.json] |
| `@supabase/ssr` | latest | `createClient()` para SSR + Server Actions | [VERIFIED: package.json] |
| Zod | 3.x | Schema validation (safeParse antes de qualquer DB call) | [VERIFIED: package.json] |
| date-fns | 3.x | `startOfMonth`, `endOfMonth`, `format` para filtros de referencia_month | [VERIFIED: package.json] |
| shadcn/ui | instalado | Dialog, Table, Tabs, Badge, Card, Progress, Select | [VERIFIED: src/components/ui/] |
| Lucide React | latest | Icones — `UserCog` para "Corretores" no sidebar | [VERIFIED: sidebar-shell.tsx] |
| sonner | latest | Toasts de feedback (posicao top-right ja configurada) | [VERIFIED: layout.tsx] |

### Sem novas dependencias a instalar

Todos os componentes shadcn necessarios para Phase 4 ja estao instalados:
`alert-dialog, badge, button, card, dialog, dropdown-menu, form, input, label, progress, scroll-area, select, separator, table, tabs, textarea, tooltip`

[VERIFIED: `src/components/ui/` — confirmado em 04-UI-SPEC.md "No new shadcn components required"]

---

## Architecture Patterns

### Estrutura de arquivos Phase 4

```
supabase/
  migrations/
    20260420_0016_corretores_schema.sql     # broker_profiles, partners, commission_entries
    20260420_0017_corretores_alter.sql      # ALTER TABLE policies/consortium_quotas (ADD COLUMN partner_id, commission_paid_at)
    20260420_0018_corretores_rls.sql        # RLS policies para as 3 novas tabelas

src/
  lib/
    validations/
      broker-schemas.ts                     # createBrokerProfileSchema, updateBrokerProfileSchema
      partner-schemas.ts                    # createPartnerSchema, updatePartnerSchema
      commission-schemas.ts                 # markCommissionPaidSchema, estornoSchema, correcaoSchema
    actions/
      broker-profiles.ts                    # upsertBrokerProfileAction
      partners.ts                           # createPartnerAction, updatePartnerAction, deletePartnerAction
      commission-entries.ts                 # markCommissionPaidAction, registerEstornoAction, registerCorrecaoAction
    utils/
      commission-rate.ts                    # resolveCommissionRate(overrides, defaultRate, productType) -> number

  app/(app)/[slug]/
    corretores/
      page.tsx                              # listagem de corretores (Server Component)
      [id]/
        page.tsx                            # dashboard individual (Server Component)
    parceiros/
      page.tsx                              # listagem de parceiros (Server Component)

  components/
    corretores/
      broker-profile-dialog.tsx             # Dialog "Completar perfil de corretor"
      broker-list-table.tsx                 # Tabela de corretores
      commission-entry-badge.tsx            # Badge por entry_type
      commission-table.tsx                  # Tabela de lancamentos (aba Relatorio)
      month-selector.tsx                    # Select de mes para dashboard
      stat-card.tsx                         # Card de metrica reutilizavel
    parceiros/
      partner-dialog.tsx                    # Dialog novo/editar parceiro
      partner-table.tsx                     # Tabela de parceiros
    seguros/
      mark-commission-paid-dialog.tsx       # Dialog "Marcar comissao como paga" (usado em policies/[id] e consorcio/[id])
      estorno-dialog.tsx                    # Dialog de estorno (usado no broker dashboard)
      correcao-dialog.tsx                   # Dialog de correcao (usado no broker dashboard)
```

### Pattern 1: Append-Only Ledger (commission_entries)

**O que e:** Tabela onde INSERT e permitido mas UPDATE e DELETE sao bloqueados na RLS — nunca via trigger, mas via policies explicitamente ausentes.

**Como implementar:**

```sql
-- Source: codebase supabase/migrations/20260420_0003_rls_policies.sql (padrao estabelecido)
ALTER TABLE public.commission_entries ENABLE ROW LEVEL SECURITY;

-- SELECT: admin e corretor veem entradas do proprio tenant
-- Corretor: apenas suas proprias entradas (broker_id = auth.uid())
CREATE POLICY "commission_entries_select" ON public.commission_entries
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (
      (SELECT public.jwt_tenant_role()) IN ('admin','financeiro')
      OR broker_id = (SELECT auth.uid())
    )
  );

-- INSERT: admin e corretor podem inserir
CREATE POLICY "commission_entries_insert" ON public.commission_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) IN ('admin','corretor')
  );

-- CRITICAL: Nao criar policies de UPDATE ou DELETE.
-- A ausencia de policy = accesso negado por default quando RLS esta habilitado.
-- [VERIFIED: codebase supabase/migrations/20260420_0003_rls_policies.sql]
```

**Por que nao trigger:** Triggers de `BEFORE DELETE` sao o padrao do projeto para soft-delete (via `prevent_hard_delete()`), mas `commission_entries` nao tem `deleted_at` — e realmente imutavel. A ausencia de RLS UPDATE/DELETE policy e mais explicita e mais segura.

### Pattern 2: Rate Resolution em TypeScript

**O que e:** Funcao pura que recebe o JSONB de overrides, a taxa default e o tipo de produto, e retorna a taxa a aplicar.

```typescript
// src/lib/utils/commission-rate.ts
// [ASSUMED] — padrao logico para o projeto; sem precedente direto nas phases anteriores

type CommissionRateOverrides = {
  auto?: number
  vida?: number
  residencial?: number
  empresarial?: number
  saude?: number
  outros?: number
  consorcio_auto?: number
  consorcio_imovel?: number
  consorcio_servico?: number
}

/**
 * Resolve the commission rate for a given product type.
 * Logic (D-07): specific override -> fallback to default rate.
 * Keys absent in JSONB use the default.
 */
export function resolveCommissionRate(
  overrides: CommissionRateOverrides | null | undefined,
  defaultRate: number,
  productType: string,
): number {
  if (!overrides) return defaultRate
  const override = overrides[productType as keyof CommissionRateOverrides]
  return override !== undefined ? override : defaultRate
}
```

**Chaves de produto validas:** Para apolices usa `policies.type` diretamente (`auto`, `vida`, `residencial`, `empresarial`, `saude`, `outros`). Para cotas de consorcio usa `consortium_groups.type` prefixado: `consorcio_auto`, `consorcio_imovel`, `consorcio_servico`.

### Pattern 3: Server Action de "Marcar Comissao como Paga"

**O que e:** Acao atomica que: (1) calcula o valor via `resolveCommissionRate`, (2) insere 1 ou 2 entradas no ledger (corretor + parceiro se houver), (3) atualiza `commission_paid_at` na apolice/cota.

```typescript
// src/lib/actions/commission-entries.ts
// [VERIFIED: src/lib/actions/policies.ts — padrao de Server Action estabelecido no projeto]

export async function markCommissionPaidAction(
  slug: string,
  sourceType: 'policy' | 'quota',
  sourceId: string,
  notes?: string,
) {
  const supabase = (await createClient()) as AnySupabase
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessao expirada.' }

  const role = (user.app_metadata as { role?: string })?.role
  if (!['admin', 'corretor'].includes(role ?? '')) {
    return { error: 'Sem permissao para registrar comissao.' }
  }

  const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
  if (!tenantId) return { error: 'Tenant nao identificado.' }

  // 1. Buscar source record + broker_profile + partner (se houver)
  // 2. Verificar commission_paid_at IS NULL (idempotencia)
  // 3. Calcular amounts via resolveCommissionRate
  // 4. Inserir commission_entries (1 ou 2 rows em uma unica transacao)
  // 5. UPDATE commission_paid_at na apolice/cota

  // NOTE: Supabase JS nao tem transacao atomica client-side.
  // Estrategia: inserir entradas primeiro, depois atualizar source.
  // Se o UPDATE falhar apos os INSERTs, o admin pode re-tentar — idempotencia
  // e garantida pela verificacao de commission_paid_at no inicio.
  // Alternativa mais robusta: Supabase RPC (funcao PostgreSQL) para atomicidade.
  // Decisao para o planner: RPC vs. sequencia em Server Action.

  revalidatePath(`/${slug}/seguros/${sourceId}`)
  return { success: true }
}
```

**Decisao de atomicidade (item para o planner):** A insercao de 2 entradas no ledger + UPDATE na tabela source pode ser implementada como:

- **Opcao A (simples):** Sequencia de 3 operacoes no Server Action. Risco baixo: se o `commission_paid_at` update falhar apos as insercoes, o admin re-tenta e a verificacao idempotente bloqueia duplicatas.
- **Opcao B (robusto):** Supabase RPC (`supabase.rpc('mark_commission_paid', {...})`) que executa tudo em uma transacao PostgreSQL. Zero risco de estado parcial.

**Recomendacao:** Opcao A e suficiente para v1 dado que a verificacao de `commission_paid_at IS NULL` antes de inserir previne duplicatas. Opcao B e mencionada para o planner decidir.

### Pattern 4: Dashboard Metrics Query

**O que e:** Queries de agregacao para as 4 metricas do broker dashboard — todas executadas no Server Component da pagina `/[slug]/corretores/[id]`.

```typescript
// [ASSUMED] — padrao de query estabelecido em consorcio/[id]/page.tsx e seguros/page.tsx

// Producao do mes: count de policies onde assigned_to = brokerId, criadas no mes selecionado
const { count: productionCount } = await supabase
  .from('policies')
  .select('id', { count: 'exact', head: true })
  .eq('assigned_to', brokerId)
  .gte('created_at', startOfMonthISO)
  .lt('created_at', startOfNextMonthISO)
  .is('deleted_at', null)

// Comissao acumulada: soma de commission_entries.amount para o broker no mes
const { data: commissionData } = await supabase
  .from('commission_entries')
  .select('amount')
  .eq('broker_id', brokerId)
  .eq('reference_month', referenceMonthDate) // primeiro dia do mes, ex: '2026-04-01'

const totalCommission = (commissionData ?? [])
  .reduce((sum, e) => sum + (e.amount ?? 0), 0)

// Carteira ativa: count de clientes com apolice ou cota ativa vinculada ao broker
// NOTA: Supabase JS nao suporta UNION diretamente.
// Estrategia: buscar client_ids de policies + client_ids de quotas, deduplicar no JS.
```

**Nota sobre `reference_month`:** O campo e `DATE` (ex: `2026-04-01`). Filtro de igualdade direta: `.eq('reference_month', '2026-04-01')`. Nao usar funcoes de data no WHERE — o valor fixo no primeiro dia do mes e o padrao do projeto (CONTEXT.md `specifics`).

### Pattern 5: Broker Redirect Logic

**O que e:** No Server Component de `/[slug]/corretores/[id]`, verificar se o usuario autenticado e corretor e se esta tentando acessar dashboard de outro corretor.

```typescript
// [VERIFIED: patterns de redirect em src/app/(app)/[slug]/layout.tsx]

const role = user.app_metadata?.role
if (role === 'corretor' && id !== user.id) {
  redirect(`/${slug}/corretores/${user.id}`)
}
```

### Pattern 6: Sidebar Extension

**O que e:** Adicionar item "Corretores" no array `navItems` de `sidebar-shell.tsx`, entre Consorcio e Configuracoes.

```typescript
// [VERIFIED: src/components/auth/sidebar-shell.tsx — estrutura exata]
{
  label: 'Corretores',
  href: `/${slug}/corretores`,
  icon: <UserCog size={16} />,
},
```

`UserCog` ja esta importado em `sidebar-shell.tsx` (linha 4: `import { ..., UserCog, ... } from 'lucide-react'`).

### Pattern 7: Month Selector (URL-driven)

**O que e:** `<select>` nativo que submete via form GET para atualizar `?month=YYYY-MM` na URL. Padrao identico ao filtro de status em `seguros/page.tsx` e `consorcio/[id]/page.tsx`.

```typescript
// [VERIFIED: src/app/(app)/[slug]/seguros/page.tsx — padrao de filtro por URL]
// Month options: last 12 meses + mes atual
// Default: mes atual
// Server Component le ?month do searchParams e filtra commission_entries
```

### Anti-Patterns a Evitar

- **Nao criar UPDATE/DELETE policies em `commission_entries`** — a ausencia de policy e a protecao. Nao confundir com outras tabelas que tem soft delete.
- **Nao calcular comissao via trigger PostgreSQL** — leva logica de negocio para fora do TypeScript, dificulta testes unitarios da funcao `resolveCommissionRate`.
- **Nao usar `user_metadata` para `tenant_id`** — sempre `app_metadata` (D-17 da Phase 1, estabelecido em `jwt_tenant_id()` helper).
- **Nao expor `service_role` key** — acoes de admin via Server Actions com role check no app_metadata do JWT.
- **Nao misturar `reference_month` com data de criacao** — `reference_month` e o mes de competencia (DATA FIXADA no primeiro dia do mes), `created_at` e o timestamp de registro. Sao campos diferentes com propositos diferentes.
- **Nao paginar a tabela de `commission_entries` na aba Relatorio** — o conjunto e bounded (um broker, um mes) e nao requer paginacao em v1 (UI-SPEC).

---

## Don't Hand-Roll

| Problema | Nao Construir | Usar em Vez | Por que |
|----------|---------------|-------------|---------|
| Componentes de Dialog | Dialog customizado do zero | `Dialog` do shadcn/ui ja instalado | Focus trap, acessibilidade, ESC handling — todos ja implementados no Radix UI |
| Formatacao BRL | String manipulation manual | `Intl.NumberFormat('pt-BR', ...)` | API nativa, zero dependencia, correto para BRL |
| Aritmética de datas (meses) | `new Date().getMonth()` | `date-fns` `startOfMonth`, `endOfMonth`, `format` | DST-safe (padrao estabelecido em Phase 3 CR-03) |
| Tabelas com ordenacao | Tabela HTML customizada | shadcn `Table` ja instalado | Acessibilidade semantica + estilos consistentes |
| Badges semanticos | Span colorido inline ad-hoc | Padrao `VigenciaBadge` (inline Tailwind classes) ja estabelecido | Consistencia visual — ver `commission-entry-badge` no padrao |
| Validacao de UUID em Server Actions | Verificacao manual de formato | `z.string().uuid()` no Zod schema | Cobertura completa + mensagens de erro consistentes |
| Transacoes PostgreSQL | Sequencia de queries client-side sem rollback | Supabase RPC se atomicidade for critica | Uma funcao PG garante rollback automatico |

---

## Migration Strategy

### Novas tabelas (migration 0016)

Tres novas tabelas, seguindo padrao estabelecido (gen_random_uuid, tenant_id NOT NULL, indexes, set_updated_at trigger, prevent_hard_delete trigger):

1. **`broker_profiles`** — `id UUID PK REFERENCES profiles(id)`, campos de negocio, soft delete.
2. **`partners`** — entidade standalone, campos de contato e taxas, soft delete.
3. **`commission_entries`** — append-only, SEM `deleted_at` (imutavel por design, nao soft-delete). SEM trigger `prevent_hard_delete` (nao ha hard delete previsto — RLS barra tudo). SEM `updated_at` (nunca atualizado).

### Alteracoes em tabelas existentes (migration 0017)

Dois `ALTER TABLE` simples:

```sql
-- policies
ALTER TABLE public.policies
  ADD COLUMN partner_id UUID REFERENCES public.partners(id),
  ADD COLUMN commission_paid_at TIMESTAMPTZ;

-- consortium_quotas
ALTER TABLE public.consortium_quotas
  ADD COLUMN partner_id UUID REFERENCES public.partners(id),
  ADD COLUMN commission_paid_at TIMESTAMPTZ;
```

Indexes para `partner_id` nas duas tabelas (para JOINs futuros).

**CRITICO: supabase db push workaround.** Phase 3 registrou no STATE.md que `supabase db push` foi contornado via `supabase db query --linked -f` por versioning collision (CLI usa apenas a data como chave de versao). Este workaround deve ser replicado para Phase 4 se as migrations tiverem o mesmo prefixo de data (`20260420`).

### RLS (migration 0018)

Padrao ja estabelecido — todas as funcoes de helper RLS existem:
- `public.jwt_tenant_id()` — tenant isolation
- `public.jwt_tenant_role()` — role check
- `auth.uid()` — user identity check

Regras de acesso:

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `broker_profiles` | admin, financeiro, visualizador (tudo); corretor (propria) | admin only | admin only | sem policy (bloqueia) |
| `partners` | admin, financeiro, visualizador | admin only | admin only | sem policy (soft delete via updated_at) |
| `commission_entries` | admin, financeiro (tudo); corretor (proprias) | admin, corretor | **sem policy** | **sem policy** |

---

## Common Pitfalls

### Pitfall 1: Ledger Duplicado por Re-submit

**O que vai errado:** Usuario clica "Marcar comissao como paga" duas vezes rapido. Server Action insere duas entradas no ledger para a mesma apolice.

**Por que acontece:** Sem verificacao idempotente antes do INSERT.

**Como evitar:** No inicio do `markCommissionPaidAction`, verificar se `commission_paid_at IS NOT NULL` na apolice/cota. Se ja pago, retornar erro especifico ("Comissao ja registrada para este item"). UI ja previne com o badge substituindo o botao (UI-SPEC: "Dialog is NOT re-openable once commission is paid").

**Sinal de aviso:** Dois registros em `commission_entries` com o mesmo `policy_id` e `entry_type = 'comissao'`.

### Pitfall 2: Cross-tenant em commission_entries

**O que vai errado:** `tenant_id` em `commission_entries` e preenchido a partir do FormData em vez do JWT.

**Por que acontece:** Reutilizacao descuidada de padrao de formulario.

**Como evitar:** Sempre extrair `tenantId` do `user.app_metadata.tenant_id` no Server Action. Nunca aceitar `tenant_id` como input do cliente.

[VERIFIED: src/lib/actions/consortium-quotas.ts linha 37 — "T-03-14: tenant_id sempre do JWT — nunca do FormData"]

### Pitfall 3: rate_used Errado no Ledger

**O que vai errado:** `rate_used` registrado no ledger e a taxa default, mesmo quando havia override por tipo de produto.

**Por que acontece:** Funcao `resolveCommissionRate` nao e chamada corretamente, ou o tipo de produto e passado sem o prefixo `consorcio_` para cotas.

**Como evitar:** A funcao `resolveCommissionRate` recebe o `productType` ja formatado corretamente. Para apolices: `policy.type` diretamente. Para cotas: `'consorcio_' + group.type`. Testar a funcao com todos os 9 casos no arquivo de testes.

### Pitfall 4: commission_entries UPDATE via Service Role

**O que vai errado:** Codigo que usa `service_role` key pode realizar UPDATE/DELETE em `commission_entries` mesmo sem RLS policies — service role bypassa RLS.

**Por que acontece:** `service_role` key e usada em Server Actions admin para operacoes privilegiadas.

**Como evitar:** Em `commission-entries.ts`, nunca usar `createAdminClient()` (que usa service_role). Usar apenas `createClient()` (anon key + RLS). As RLS policies de INSERT sao suficientes para o fluxo normal.

[VERIFIED: src/lib/actions/policies.ts — usa `createClient()`, nao admin client]

### Pitfall 5: Metrica de "Carteira Ativa" com UNION

**O que vai errado:** A query de "carteira ativa" (clientes com pelo menos 1 produto ativo do broker) usa UNION SQL que o Supabase JS client nao suporta diretamente.

**Por que acontece:** Supabase JS nao expoe `UNION` como metodo de chain.

**Como evitar:** Duas queries paralelas separadas (uma para `policies`, outra para `consortium_quotas`) + deduplicacao via `Set` em TypeScript. Usar `Promise.all([...])` para paralelismo.

```typescript
// [ASSUMED] — padrao logico para limitacao conhecida do Supabase JS
const [policyClients, quotaClients] = await Promise.all([
  supabase.from('policies').select('client_id').eq('assigned_to', brokerId).is('deleted_at', null),
  supabase.from('consortium_quotas').select('client_id').eq('assigned_to', brokerId).is('deleted_at', null),
])
const uniqueClients = new Set([
  ...(policyClients.data ?? []).map(r => r.client_id),
  ...(quotaClients.data ?? []).map(r => r.client_id),
])
const carteiraAtiva = uniqueClients.size
```

### Pitfall 6: Queries de Metrica Sem try/catch no Layout

**O que vai errado:** Queries no `[slug]/layout.tsx` falham silenciosamente sem fallback se as tabelas ainda nao existirem (antes do `db push`).

**Por que acontece:** Phase 3 estabeleceu este padrao de protecao: "T-03-19: queries de alerta com try/catch — fallback count=0 se tabelas ausentes antes do db push".

**Como evitar:** As metricas do broker dashboard estao na pagina `[id]/page.tsx`, nao no layout. Mas se o layout for estendido com contagem de comissoes pendentes no futuro, usar o mesmo padrao de try/catch com fallback.

### Pitfall 7: `reference_month` com Fuso Horario

**O que vai errado:** `reference_month` gerado com `new Date()` em vez de `startOfMonth(startOfToday())` pode registrar o mes errado para usuarios em fuso horario diferente do servidor.

**Por que acontece:** `new Date()` depende do fuso do processo Node.js.

**Como evitar:** Usar `date-fns` `startOfMonth(startOfToday())` e `format(result, 'yyyy-MM-dd')`. Padrão estabelecido em Phase 3 CR-03.

---

## Code Examples

### Resolucao de Rate (funcao pura testavel)

```typescript
// src/lib/utils/commission-rate.ts
// [ASSUMED] — logica derivada de 04-CONTEXT.md D-07

export type CommissionRateOverrides = {
  auto?: number
  vida?: number
  residencial?: number
  empresarial?: number
  saude?: number
  outros?: number
  consorcio_auto?: number
  consorcio_imovel?: number
  consorcio_servico?: number
}

export function resolveCommissionRate(
  overrides: CommissionRateOverrides | null | undefined,
  defaultRate: number,
  productType: string,
): number {
  if (!overrides) return defaultRate
  const override = (overrides as Record<string, number | undefined>)[productType]
  return override !== undefined ? override : defaultRate
}
```

### Zod Schema para broker_profiles

```typescript
// src/lib/validations/broker-schemas.ts
// [VERIFIED: src/lib/validations/policy-schemas.ts — padrao de schema do projeto]

import { z } from 'zod'

const commissionOverridesSchema = z.object({
  auto:              z.coerce.number().min(0).max(1).optional(),
  vida:              z.coerce.number().min(0).max(1).optional(),
  residencial:       z.coerce.number().min(0).max(1).optional(),
  empresarial:       z.coerce.number().min(0).max(1).optional(),
  saude:             z.coerce.number().min(0).max(1).optional(),
  outros:            z.coerce.number().min(0).max(1).optional(),
  consorcio_auto:    z.coerce.number().min(0).max(1).optional(),
  consorcio_imovel:  z.coerce.number().min(0).max(1).optional(),
  consorcio_servico: z.coerce.number().min(0).max(1).optional(),
}).optional()

export const upsertBrokerProfileSchema = z.object({
  profile_id: z.string().uuid('Perfil invalido'),
  susep_number: z.string().optional(),
  monthly_goal: z.coerce.number().min(0, 'Meta invalida'),
  commission_rate_default: z.coerce.number().min(0).max(1, 'Taxa invalida (0-1)'),
  commission_rate_overrides: commissionOverridesSchema,
})

export type UpsertBrokerProfileInput = z.infer<typeof upsertBrokerProfileSchema>
```

**NOTA para o planner:** O dialog de "Completar perfil" envia os overrides como campos individuais no FormData (um `<Input>` por chave do JSONB). O Server Action deve reconstruir o objeto JSONB a partir dos campos antes do safeParse.

### Formatacao de taxa como percentagem (UI)

```typescript
// [VERIFIED: 04-UI-SPEC.md — "Rate/percentage in table cells: 14px / weight 400, formatted as {value * 100}%"]
// Exemplo: 0.0500 → "5,00%"
const formatRate = (rate: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2 }).format(rate)
```

### Schema de commission_entries (SQL)

```sql
-- [ASSUMED] — derivado de 04-CONTEXT.md D-10 com padrao estabelecido pelas migrations anteriores
CREATE TABLE public.commission_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id),
  entry_type     TEXT NOT NULL CHECK (entry_type IN ('comissao','estorno','correcao')),
  broker_id      UUID REFERENCES public.profiles(id),      -- nullable: null quando entry e para parceiro
  partner_id     UUID REFERENCES public.partners(id),      -- nullable: null quando entry e para corretor
  policy_id      UUID REFERENCES public.policies(id),      -- nullable
  quota_id       UUID REFERENCES public.consortium_quotas(id), -- nullable
  amount         NUMERIC(12,2) NOT NULL,
  rate_used      NUMERIC(5,4),
  reference_month DATE NOT NULL,                            -- primeiro dia do mes, ex: 2026-04-01
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- SEM deleted_at: imutavel por design
  -- SEM updated_at: nunca atualizado
);

CREATE INDEX idx_commission_entries_tenant_id       ON public.commission_entries(tenant_id);
CREATE INDEX idx_commission_entries_broker_id       ON public.commission_entries(broker_id);
CREATE INDEX idx_commission_entries_partner_id      ON public.commission_entries(partner_id);
CREATE INDEX idx_commission_entries_policy_id       ON public.commission_entries(policy_id);
CREATE INDEX idx_commission_entries_quota_id        ON public.commission_entries(quota_id);
CREATE INDEX idx_commission_entries_reference_month ON public.commission_entries(reference_month);
-- CRITICO: Nao criar trigger set_updated_at (nao ha updated_at)
-- CRITICO: Nao criar trigger prevent_hard_delete (nao ha deleted_at; RLS barra tudo)
```

---

## Runtime State Inventory

> Phase 4 e adicao de novas tabelas e rotas — nao e rename/refactor/migration de dados existentes. Nao ha estado de runtime afetado.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Nenhum — tabelas `broker_profiles`, `partners`, `commission_entries` nao existem ainda | Criar via migration |
| Live service config | Nenhum — nenhum servico externo referencia estas entidades | Nenhuma |
| OS-registered state | Nenhum | Nenhuma |
| Secrets/env vars | Nenhum — sem novas env vars necessarias | Nenhuma |
| Build artifacts | Nenhum — `supabase gen types` precisara ser re-executado apos migration, mas nao ha artifact obsoleto agora | Executar apos db push |

**Nota sobre tipos gerados:** O projeto usa `supabase as any` cast para tabelas sem tipos gerados (padrao estabelecido em Phase 3 — STATE.md "[Phase 03-02]: Server Actions usam as any cast"). Manter o mesmo padrao para as novas tabelas da Phase 4.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | `supabase db push` / `db query --linked -f` | Verificar com `supabase --version` | Deve ser instalado do devDependencies | `npx supabase` |
| Node.js | Testes vitest | Inferido do ambiente de desenvolvimento ativo | — | — |
| vitest | `npm test` | [VERIFIED: devDependencies em package.json] | 3.x (inferido) | — |

**Workaround critico de migration:** STATE.md registra que `supabase db push` foi contornado via `supabase db query --linked -f migration.sql` por versioning collision. As migrations de Phase 4 com prefixo `20260420_001x` provavelmente sofrem o mesmo problema. O planner deve incluir o workaround no task de migration.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + jsdom |
| Config file | `vitest.config.ts` (raiz do projeto) |
| Setup file | `tests/setup.ts` |
| Quick run command | `npm test -- --run tests/actions/commission-entries.test.ts` |
| Full suite command | `npm test` |
| Test directory convention | `tests/` (nao `src/__tests__/`) |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COM-01 | `upsertBrokerProfileAction` — admin pode criar/editar, corretor nao pode | unit | `npm test -- --run tests/actions/broker-profiles.test.ts` | Wave 0 |
| COM-01 | `upsertBrokerProfileAction` — validacao Zod (taxa invalida > 1) | unit | `npm test -- --run tests/actions/broker-profiles.test.ts` | Wave 0 |
| COM-02 | `createPartnerAction` — admin pode criar, outros nao podem | unit | `npm test -- --run tests/actions/partners.test.ts` | Wave 0 |
| COM-02 | `commission_rate_overrides` JSONB — override por tipo funciona corretamente | unit | `npm test -- --run tests/utils/commission-rate.test.ts` | Wave 0 |
| COM-03 | `resolveCommissionRate` — retorna override quando presente, default quando ausente | unit | `npm test -- --run tests/utils/commission-rate.test.ts` | Wave 0 |
| COM-03 | `resolveCommissionRate` — prefixo `consorcio_` para cotas | unit | `npm test -- --run tests/utils/commission-rate.test.ts` | Wave 0 |
| COM-04 | `markCommissionPaidAction` — insere 1 entry para corretor sem parceiro | unit | `npm test -- --run tests/actions/commission-entries.test.ts` | Wave 0 |
| COM-04 | `markCommissionPaidAction` — insere 2 entries quando ha parceiro (D-06) | unit | `npm test -- --run tests/actions/commission-entries.test.ts` | Wave 0 |
| COM-04 | `markCommissionPaidAction` — retorna erro se commission_paid_at ja preenchido | unit | `npm test -- --run tests/actions/commission-entries.test.ts` | Wave 0 |
| COM-04 | `registerEstornoAction` — insere entry com amount negativo e entry_type='estorno' | unit | `npm test -- --run tests/actions/commission-entries.test.ts` | Wave 0 |
| COM-05 | `commission_entries` filtrados por `reference_month` retornam apenas entradas do mes | unit | `npm test -- --run tests/actions/commission-entries.test.ts` | Wave 0 |
| COM-06 | Redirect para proprio dashboard quando corretor acessa outro `broker_id` | manual | Teste de navegacao no browser | N/A |

### Sampling Rate

- **Por task commit:** `npm test -- --run tests/utils/commission-rate.test.ts tests/actions/commission-entries.test.ts`
- **Por wave merge:** `npm test`
- **Phase gate:** Suite completa verde antes de `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/utils/commission-rate.test.ts` — cobre logica de resolucao de taxa (COM-03)
- [ ] `tests/actions/broker-profiles.test.ts` — cobre RBAC e validacao (COM-01)
- [ ] `tests/actions/partners.test.ts` — cobre CRUD de parceiros (COM-02)
- [ ] `tests/actions/commission-entries.test.ts` — cobre mark paid, estorno, correcao, idempotencia (COM-04, COM-05)

**Mocks necessarios (padrao estabelecido):** Todos os novos test files seguem o padrao de `tests/actions/policies.test.ts`: `vi.mock('@/lib/supabase/server', ...)` + `vi.mock('next/cache', ...)` + `makeFormData()` helper.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Sim (indiretamente) | Supabase Auth + `@supabase/ssr` — herdado de Phase 1 |
| V3 Session Management | Sim (indiretamente) | Session via cookies gerenciada pelo `@supabase/ssr` — herdado |
| V4 Access Control | **Sim (critico)** | RLS no Supabase + role check no `app_metadata` JWT — padrao estabelecido |
| V5 Input Validation | Sim | Zod `safeParse` antes de qualquer DB call — obrigatorio desde CR-01 Phase 3 |
| V6 Cryptography | Nao | Sem operacoes criptograficas nesta phase |

### Threat Patterns Especificos para Phase 4

| Pattern | STRIDE | Mitigacao |
|---------|--------|-----------|
| Corretor modifica `broker_profiles` de outro corretor | Tampering | RLS `WITH CHECK` + role guard admin-only no Server Action |
| Admin de tenant A modifica comissoes de tenant B | Tampering / Info Disclosure | `tenant_id = jwt_tenant_id()` em todas as RLS policies |
| Duplicate ledger entry via rapid re-submit | Tampering | Verificacao idempotente de `commission_paid_at IS NULL` antes do INSERT |
| `service_role` key usada em `commission-entries.ts` (bypassaria RLS) | Elevation of Privilege | Usar apenas `createClient()` (anon) para operacoes de ledger — nunca `createAdminClient()` |
| Corretor acessa dashboard de outro corretor | Info Disclosure | Server Component verifica `role === 'corretor' && id !== user.id` e redireciona |
| `tenant_id` injetado via FormData | Tampering | Extrair sempre de `user.app_metadata.tenant_id` no Server Action |
| `amount` negativo em entry `comissao` (nao estorno) | Tampering | Validacao Zod: `entry_type = 'comissao'` -> `amount >= 0`; `entry_type = 'estorno'` -> `amount < 0` |

---

## State of the Art

| Abordagem Antiga | Abordagem Atual (neste projeto) | Impacto |
|------------------|---------------------------------|---------|
| Soft delete com `deleted_at` em todas as tabelas | `commission_entries` e verdadeiramente imutavel — sem `deleted_at`, sem triggers de delete, RLS sem UPDATE/DELETE policy | Garantia arquitetural de ledger imutavel |
| Server Actions com `as any` para tabelas sem tipos | Padrão ja estabelecido em Phase 3 | Manter ate proximo `supabase gen types --linked` |
| `supabase db push` para migrations | `supabase db query --linked -f` como workaround (STATE.md) | Registrado — replicar para Phase 4 |

---

## Assumptions Log

| # | Claim | Section | Risk se Errado |
|---|-------|---------|----------------|
| A1 | `resolveCommissionRate` implementada em TypeScript (nao como trigger/funcao SQL) | Architecture Patterns Pattern 2 | Baixo — a logica pode ser movida para uma RPC SQL se necessario, mas TypeScript e testavel com vitest |
| A2 | `markCommissionPaidAction` usa sequencia de 3 operacoes (sem RPC atomica) para v1 | Architecture Patterns Pattern 3 | Baixo — idempotencia previne duplicatas; risco real apenas se houver falha de infraestrutura entre as 2 insercoes e o UPDATE |
| A3 | Carteira ativa calculada com 2 queries + deduplicacao JS (nao UNION SQL) | Code Examples — metrics query | Baixo — funciona corretamente; impacto de performance negligivel para o volume de v1 (ate 5000 clientes por tenant) |
| A4 | `supabase as any` cast continua sendo o padrao para novas tabelas da Phase 4 | Architecture Patterns | Baixo — padrao ja estabelecido e documentado no STATE.md |
| A5 | Migracao de Phase 4 sofrera o mesmo workaround de versioning collision que a Phase 3 | Environment Availability | Medio — se o CLI for atualizado e o problema nao ocorrer, o workaround pode ser ignorado; se ocorrer sem o workaround, a migration falhara |

**Nenhum item nesta lista bloqueia o planejamento.** Todos podem ser resolvidos durante a execucao.

---

## Open Questions (RESOLVED)

1. **Atomicidade do `markCommissionPaidAction`**
   - O que sabemos: Supabase JS client nao tem suporte a transacoes multi-statement. Podemos usar Supabase RPC (funcao PostgreSQL) para atomicidade real.
   - O que e incerto: O planner deve decidir entre Opcao A (sequencia simples) vs. Opcao B (RPC).
   - Recomendacao: Opcao A e suficiente para v1. Documentar a limitacao no codigo com comentario.
   - **RESOLVED:** Option A (sequential, no RPC) — implemented in Plan 02 Task 3. Idempotency guaranteed by `commission_paid_at IS NULL` check before INSERT (Pitfall 1).

2. **`parceiros` na sidebar ou apenas rota direta?**
   - O que sabemos: A UI-SPEC define `/[slug]/parceiros` como uma pagina separada. A sidebar atual nao tem item para "Parceiros".
   - O que e incerto: Se "Parceiros" deve aparecer como item de navegacao na sidebar ou ser acessado apenas a partir da pagina de Corretores.
   - Recomendacao: Adicionar "Parceiros" como sub-item de "Corretores" no sidebar (usando o padrao de `children` que ja existe para Configuracoes). Decisao final para o planner.
   - **RESOLVED:** Parceiros adicionado como item INDEPENDENTE da sidebar (nao sub-item) — implementado em Plan 03 Task 1. Decisao tomada por minimizar risco: nao altera a logica de render de `sidebar-shell.tsx` (que ainda nao suporta corretamente parent clicavel + children).

---

## Sources

### Primary (HIGH confidence)

- `supabase/migrations/20260420_0001_foundation_schema.sql` — schema base, padrao de tabelas, indexes, triggers
- `supabase/migrations/20260420_0002_rls_helpers.sql` — funcoes JWT helper (`jwt_tenant_id`, `jwt_tenant_role`)
- `supabase/migrations/20260420_0003_rls_policies.sql` — padrao de RLS policies com `(SELECT ...)` wrapper
- `supabase/migrations/20260420_0011_seguros_schema.sql` — schema de `policies` com `assigned_to`, `premio_total`
- `supabase/migrations/20260420_0013_consorcio_schema.sql` — schema de `consortium_quotas` e `consortium_groups` com `credit_value`
- `supabase/migrations/20260420_0012_seguros_rls.sql` — padrao RLS com role filtering para corretor/admin
- `src/lib/actions/policies.ts` — padrao canônico de Server Action (Zod + role guard + tenant_id do JWT)
- `src/lib/actions/consortium-quotas.ts` — padrao de Server Action para tabelas sem tipos gerados
- `src/lib/validations/policy-schemas.ts` — padrao de schema Zod com `z.coerce.number()` para campos numericos
- `src/components/consorcio/contemplation-dialog.tsx` — padrao de Dialog com FormData + Server Action
- `src/components/auth/sidebar-shell.tsx` — estrutura de `navItems` e icones disponíveis
- `src/app/(app)/[slug]/seguros/page.tsx` — padrao de listagem com filtros inline e paginacao URL-driven
- `src/app/(app)/[slug]/consorcio/[id]/page.tsx` — padrao de detalhe com CardHeader, tabs e metricas
- `src/app/(app)/[slug]/layout.tsx` — padrao de try/catch com fallback para queries no layout
- `vitest.config.ts` + `tests/setup.ts` + `tests/actions/policies.test.ts` — infraestrutura de testes estabelecida
- `.planning/phases/04-corretores-comissoes/04-CONTEXT.md` — decisoes de design D-01 a D-14
- `.planning/phases/04-corretores-comissoes/04-UI-SPEC.md` — contrato visual aprovado
- `.planning/STATE.md` — workarounds e decisoes acumuladas de phases anteriores

### Secondary (MEDIUM confidence)

- `CLAUDE.md` — stack constraints, convencoes, LGPD, padrao multi-tenancy via RLS

### Tertiary (LOW confidence)

- Nenhum item LOW confidence nesta pesquisa — todos os findings foram verificados diretamente no codebase.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — verificado em package.json e src/components/ui/
- Schema e Migrations: HIGH — derivado diretamente das migrations existentes + CONTEXT.md D-01 a D-10
- Architecture Patterns: HIGH — baseado em código existente verificado; Opcao A vs B de atomicidade e LOW (escolha de design)
- RLS: HIGH — padrao completamente estabelecido, replica estrutura de migrations anteriores
- Testes: HIGH — infraestrutura verificada, gaps identificados com precisao
- Pitfalls: HIGH — baseados em problemas reais registrados no STATE.md e nos comentarios do código

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (stack estavel, sem dependencias externas novas)

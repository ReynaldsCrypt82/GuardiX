# Phase 5: Financeiro — Research

**Researched:** 2026-04-29
**Domain:** Financial entries management, cashflow view, delinquency tracking (Next.js + Supabase RLS)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Estrutura de Dados (D-01, D-02, D-03)**
- D-01: Tabela única `financial_entries` com coluna discriminadora `entry_type TEXT CHECK IN ('receivable', 'payable')`. Mesmo padrão de `commission_entries`.
- D-02: Campos obrigatórios mínimos listados (id, tenant_id, entry_type, description, amount, due_date, status, paid_at, policy_id, quota_id, client_id, notes, created_at, created_by, deleted_at).
- D-03: Vínculo a `policy_id` / `quota_id` é opcional (nullable). Permite lançamentos avulsos.

**Criação de Lançamentos (D-04, D-05)**
- D-04: Criação manual via Dialog "Novo lançamento". Ao marcar comissão como paga, sistema oferece opcionalmente criar lançamento receivable — Dialog secundário pós-confirmação com campos pré-preenchidos. Usuário pode aceitar ou dispensar.
- D-05: RBAC — apenas `role IN ('admin', 'financeiro')` pode criar, editar e ver `/financeiro`. Badge de inadimplência exceção: visível para admin, financeiro e corretor responsável.

**Tela de Financeiro (D-06, D-07, D-08)**
- D-06: Rota `/[slug]/financeiro` — Server Component com 3 cards (A Receber, A Pagar, Saldo), MonthSelector URL-driven `?month=YYYY-MM`, Tabs Receber|Pagar|Todos|Vencidos, tabela paginada 25 itens, botão "Novo lançamento".
- D-07: Aba "Vencidos" = `status = 'pending' AND due_date < CURRENT_DATE` — sem filtro de mês, todos vencidos históricos.
- D-08: Marcar como recebido/quitado: Dialog com campo `paid_at` (default = hoje, editável). Server Action `markFinancialEntryPaidAction`. Verificar `status != 'paid'` antes de atualizar (idempotência).

**Inadimplência (D-09, D-10)**
- D-09: Critério: `status = 'pending' AND due_date < CURRENT_DATE`. Zero configuração por tenant.
- D-10: Badge "Inadimplente" na listagem `/[slug]/clientes` via subquery EXISTS. Visível para admin, financeiro, corretor responsável.

### Claude's Discretion
- Status do badge na listagem de clientes: componente inline usando `className` condicional (padrão VigenciaBadge) — Claude decide se reutiliza ou cria novo componente.
- Ordem padrão da tabela em /financeiro: `due_date ASC`.
- Ícone do item "Financeiro" na sidebar: Claude decide entre `Wallet`, `DollarSign`, ou `Banknote` do Lucide React.
- Empty state de /financeiro: Claude define copy exato.

### Deferred Ideas (OUT OF SCOPE)
- Gráfico de barras entradas × saídas — Phase 6
- Exportação PDF/Excel dos lançamentos — Phase 6
- Alertas por email de inadimplência — Phase 7 (n8n + Resend)
- Date range picker customizado — Phase 6
- Tolerância de dias configurável por tenant — v2
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIN-01 | Usuário pode registrar conta a receber (prêmio de seguro, parcela de consórcio) com valor, vencimento e status | D-01/D-02 schema + D-04 criação manual + D-06 tela /financeiro |
| FIN-02 | Usuário pode registrar conta a pagar (repasse a seguradora, comissão a corretor) com valor e vencimento | D-01 entry_type='payable' + D-04 dialog + D-06 aba Pagar |
| FIN-03 | Usuário pode visualizar fluxo de caixa consolidado por período (entradas e saídas) | D-06 cards de resumo (A Receber, A Pagar, Saldo) + MonthSelector + aba Todos |
| FIN-04 | Sistema identifica clientes inadimplentes e exibe alerta automático de atraso | D-09 critério + D-10 badge na listagem + aba Vencidos |
| FIN-05 | Usuário pode marcar pagamento como recebido/quitado com data de liquidação | D-08 dialog + markFinancialEntryPaidAction + campo paid_at |
</phase_requirements>

---

## Summary

Phase 5 implementa o módulo financeiro completo da corretora — lançamentos a receber/a pagar, fluxo de caixa mensal e rastreamento de inadimplência. O trabalho é altamente paralelo ao que já existe: a tabela `financial_entries` replica a estrutura de `commission_entries` (Phase 4), a tela `/financeiro` replica o padrão de tabs + stat cards + MonthSelector do dashboard de corretores, e a Server Action `markFinancialEntryPaidAction` replica o padrão append-update de `markCommissionPaidAction`.

A maior diferença técnica é que `financial_entries` é **mutável** — diferente do ledger imutável de comissões, o status de um lançamento evolui de `pending` para `paid` ou `cancelled`. Isso requer políticas RLS de UPDATE (ausentes em `commission_entries`) e um trigger `prevent_hard_delete` (soft delete via `deleted_at`).

A integração com a listagem de clientes (badge de inadimplência) é um ponto de toque crítico: a query já existe em `src/app/(app)/[slug]/clientes/page.tsx` e precisa ser estendida com uma subquery EXISTS, sem quebrar a paginação ou performance existente.

**Primary recommendation:** Implementar em 3 planos sequenciais: (1) Schema + RLS, (2) Tela /financeiro + Server Actions CRUD, (3) Integrações (badge clientes, sidebar, sugestão pós-comissão).

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 5 |
|-----------|-------------------|
| Tech Stack: Next.js + Supabase + Vercel — não negociável | Sem alternativas de ORM ou backend |
| Multi-tenancy via RLS: `tenant_id` em todas as tabelas | `financial_entries` deve ter RLS com `jwt_tenant_id()` |
| `app_metadata` para tenant_id e role no JWT | Todas as Server Actions leem `user.app_metadata` |
| `@supabase/ssr` para auth (auth-helpers deprecado) | `createClient()` de `@/lib/supabase/server` |
| `supabase as any` cast para tabelas sem tipos gerados | financial_entries não estará em generated types — usar cast |
| Zod `safeParse` antes de qualquer DB call (obrigatório desde Phase 3 CR-01) | Todos os schemas validados com safeParse |
| `startOfMonth` / `endOfMonth` de date-fns para filtros de mês (DST-safe) | filtros de período no /financeiro |
| `try/catch` em queries de layout com fallback count=0 | badge count no layout deve ter fallback |
| Soft delete com `deleted_at` (D-12) | trigger `prevent_hard_delete` em financial_entries |
| RBAC via app_metadata.role | admin + financeiro para /financeiro; corretor para badge |
| Mercado Brasil — datas pt-BR, moeda BRL | `Intl.NumberFormat('pt-BR', currency: 'BRL')`, date-fns ptBR |
| LGPD — audit trail via `created_by` + `deleted_at` | campo `created_by UUID REFERENCES profiles(id)` obrigatório |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase JS client (`as any` cast) | latest (gerenciado) | Queries + RLS enforcement | Padrão estabelecido — tabelas novas não têm tipos gerados |
| date-fns | 3.x | `startOfMonth`, `endOfMonth`, `format`, `parse` | DST-safe, pt-BR locale — padrão Phase 3/4 |
| Zod | 3.x | Schema validation para Server Actions | Compartilhado client/server, safeParse obrigatório (CR-01) |
| React Hook Form | 7.x | Dialog de criação de lançamento | Performance em formulários com muitos campos |
| shadcn/ui (Badge, Dialog, Tabs, Table, Card, Select) | local copy | UI components | Padrão do projeto — já instalado |
| Lucide React | latest | Ícones (`Wallet` ou `Banknote` para sidebar) | Padrão shadcn/ui — tree-shakeable |
| next/cache `revalidatePath` | Next.js 15 | Invalidar cache após mutações | Padrão estabelecido em todas as Server Actions |

[VERIFIED: codebase grep — todas essas libs já em uso nos plans anteriores]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns/locale ptBR` | 3.x | Labels de mês em pt-BR no MonthSelector | Reutilizar componente existente sem modificação |
| `Intl.NumberFormat` (nativo) | — | Formatação BRL | Todas as células de valor monetário |

**Installation:** Nenhuma instalação necessária. Todas as dependências já estão no projeto.

---

## Architecture Patterns

### Recommended Project Structure

```
supabase/migrations/
└── 20260420_0019_financeiro_schema.sql   — financial_entries + indexes + triggers
└── 20260420_0020_financeiro_rls.sql      — RLS policies para financial_entries

src/
├── lib/
│   ├── validations/
│   │   └── financial-schemas.ts           — Zod schemas (createFinancialEntrySchema, markFinancialEntryPaidSchema)
│   └── actions/
│       └── financial-entries.ts           — Server Actions (create, markPaid, softDelete)
├── components/
│   └── financeiro/
│       ├── financial-entry-badge.tsx      — Badge de status (pending/paid/cancelled)
│       ├── financial-entries-table.tsx    — Tabela paginada com ações
│       ├── new-entry-dialog.tsx           — Dialog "Novo lançamento"
│       ├── mark-paid-dialog.tsx           — Dialog "Marcar como recebido"
│       └── suggest-entry-dialog.tsx       — Dialog sugestão pós-comissão (opcional)
└── app/(app)/[slug]/
    └── financeiro/
        └── page.tsx                       — Server Component principal
```

### Pattern 1: Schema com Soft Delete e Status Mutável

`financial_entries` difere de `commission_entries` em dois aspectos críticos:
1. Tem `deleted_at` (soft delete habilitado) — precisa de trigger `prevent_hard_delete`
2. Tem `status` mutável — precisa de políticas RLS de UPDATE

```sql
-- Source: padrão estabelecido em 20260420_0016_corretores_schema.sql + adaptação
CREATE TABLE public.financial_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id),
  entry_type  TEXT NOT NULL CHECK (entry_type IN ('receivable', 'payable')),
  description TEXT NOT NULL,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  due_date    DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at     TIMESTAMPTZ,
  policy_id   UUID REFERENCES public.policies(id),
  quota_id    UUID REFERENCES public.consortium_quotas(id),
  client_id   UUID REFERENCES public.clients(id),
  notes       TEXT,
  created_by  UUID REFERENCES public.profiles(id),
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_financial_entries_tenant_id  ON public.financial_entries(tenant_id);
CREATE INDEX idx_financial_entries_due_date   ON public.financial_entries(due_date);
CREATE INDEX idx_financial_entries_status     ON public.financial_entries(status);
CREATE INDEX idx_financial_entries_client_id  ON public.financial_entries(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_financial_entries_deleted_at ON public.financial_entries(deleted_at) WHERE deleted_at IS NULL;

-- updated_at trigger (padrão Phase 1)
CREATE TRIGGER trg_financial_entries_updated_at
  BEFORE UPDATE ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- soft delete enforcement (padrão Phase 1 D-12)
CREATE TRIGGER trg_financial_entries_no_hard_delete
  BEFORE DELETE ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();
```

[VERIFIED: codebase — padrão idêntico em broker_profiles e partners em 20260420_0016_corretores_schema.sql]

### Pattern 2: RLS para financial_entries — Três Roles Distintos

```sql
-- Source: padrão 20260420_0018_corretores_rls.sql adaptado para financeiro
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

-- SELECT: admin + financeiro veem tudo no tenant; corretor vê apenas de seus clientes
CREATE POLICY "financial_entries_select" ON public.financial_entries
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (
      (SELECT public.jwt_tenant_role()) IN ('admin', 'financeiro')
      OR (
        (SELECT public.jwt_tenant_role()) = 'corretor'
        AND client_id IN (
          SELECT id FROM public.clients
          WHERE assigned_to = (SELECT auth.uid())
          AND deleted_at IS NULL
        )
      )
    )
  );

-- INSERT: admin + financeiro
CREATE POLICY "financial_entries_insert" ON public.financial_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) IN ('admin', 'financeiro')
  );

-- UPDATE: admin + financeiro (para marcar como pago/cancelado)
CREATE POLICY "financial_entries_update" ON public.financial_entries
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND deleted_at IS NULL
    AND (SELECT public.jwt_tenant_role()) IN ('admin', 'financeiro')
  )
  WITH CHECK (
    tenant_id = (SELECT public.jwt_tenant_id())
    AND (SELECT public.jwt_tenant_role()) IN ('admin', 'financeiro')
  );

-- DELETE: SEM POLICY — soft delete via deleted_at
```

**NOTA CRÍTICA:** O SELECT policy para corretor usa subquery em `clients.assigned_to`. Isso é necessário porque financial_entries tem `client_id` nullable — um lançamento avulso sem client_id seria invisível para o corretor, mas visível apenas para admin/financeiro. Isso está correto per D-05.

[VERIFIED: codebase — jwt_tenant_id(), jwt_tenant_role() em 20260420_0002_rls_helpers.sql]

### Pattern 3: Queries de Resumo Mensal com SUM Condicional

A página `/financeiro` precisa dos 3 cards com somas condicionais no mesmo mês. Use uma única query agregada em vez de 3 queries separadas:

```typescript
// Source: padrão inspirado em corretores/[id]/page.tsx
// Saldo via SUM com CASE — 1 roundtrip ao banco
const supabase = (await createClient()) as any

const { data: summary } = await supabase
  .from('financial_entries')
  .select('entry_type, amount, status, due_date')
  .is('deleted_at', null)
  .gte('due_date', monthStartStr)   // YYYY-MM-01
  .lte('due_date', monthEndStr)     // YYYY-MM-31
  .in('status', ['pending'])         // apenas pendentes para cards

// Calcular no lado JS após fetch (table is small per tenant)
const totalReceivable = summary?.filter(e => e.entry_type === 'receivable').reduce((s, e) => s + Number(e.amount), 0) ?? 0
const totalPayable = summary?.filter(e => e.entry_type === 'payable').reduce((s, e) => s + Number(e.amount), 0) ?? 0
const balance = totalReceivable - totalPayable
```

**Alternativa para tenants grandes:** usar `.rpc('get_financial_summary', { month_start, month_end })` — mas para v1 com até 5.000 clientes e lançamentos proporcionais, o cálculo em JS é suficiente e evita função RPC adicional.

[ASSUMED: estimativa de volume de lançamentos para v1 — cálculo em JS viável para até ~10K registros por tenant]

### Pattern 4: Badge de Inadimplência via EXISTS Subquery

A listagem de clientes já existe em `src/app/(app)/[slug]/clientes/page.tsx`. A modificação é cirúrgica — adicionar EXISTS subquery no SELECT:

```typescript
// Source: codebase — clientes/page.tsx adaptado (D-10)
let query = supabase
  .from('clients')
  .select(
    `id, name, type, document, created_at,
     assigned_to:profiles!clients_assigned_to_fkey(id, full_name),
     stage:pipeline_stages(id, name, color),
     has_overdue:financial_entries(id)`,  // <- EXISTS via nested select
    { count: 'exact' },
  )
  .is('deleted_at', null)
```

**Problema:** Supabase JS client não suporta EXISTS diretamente via nested select — retornaria array de entries, não boolean. A abordagem correta é:

```typescript
// Opção A: Coluna computed via RPC (overhead de função)
// Opção B: Fetch clients, depois fetch overdue client_ids em paralelo (2 queries)
// Opção C: Incluir financial_entries no select e computar no JS (dados extras no payload)
// Opção D: Query RAW via .rpc ou usar .filter com subquery string (não suportado no JS client)

// RECOMENDADO: Opção B — 2 queries em Promise.all, sem overhead de RPC
const [clientsRes, overdueRes] = await Promise.all([
  // query de clientes existente
  supabase.from('clients').select(...),
  // IDs de clientes com lançamento vencido
  supabase
    .from('financial_entries')
    .select('client_id')
    .is('deleted_at', null)
    .eq('status', 'pending')
    .lt('due_date', todayStr)
    .not('client_id', 'is', null)
])
const overdueClientIds = new Set(overdueRes.data?.map(e => e.client_id) ?? [])
// Passar overdueClientIds para ClientsTable — adicionar prop `overdueClientIds: Set<string>`
```

**NOTA:** Esta abordagem é segura porque RLS em `financial_entries` já filtra por tenant. O Set de IDs é construído server-side e passado ao componente Client, sem expor dados sensíveis além da listagem existente.

[VERIFIED: codebase — padrão Promise.all em corretores/[id]/page.tsx e seguros/[id]/page.tsx]

### Pattern 5: Server Action markFinancialEntryPaidAction

```typescript
// Source: padrão direto de commission-entries.ts — adaptado para status mutável
export async function markFinancialEntryPaidAction(
  slug: string,
  entryId: string,
  paidAt?: string,  // ISO date string, default = hoje
) {
  const parsed = markFinancialEntryPaidSchema.safeParse({ entry_id: entryId, paid_at: paidAt })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = (await createClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessao expirada.'] } }

  const role = (user.app_metadata as { role?: string })?.role
  if (!['admin', 'financeiro'].includes(role ?? ''))
    return { error: { _form: ['Sem permissao.'] } }

  // Idempotência: verificar status antes de atualizar (D-08)
  const { data: entry } = await supabase
    .from('financial_entries')
    .select('id, status')
    .eq('id', entryId)
    .is('deleted_at', null)
    .single()

  if (!entry) return { error: { _form: ['Lancamento nao encontrado.'] } }
  if (entry.status === 'paid')
    return { error: { _form: ['Lancamento ja marcado como pago.'] } }

  const { error } = await supabase
    .from('financial_entries')
    .update({
      status: 'paid',
      paid_at: parsed.data.paid_at ?? new Date().toISOString(),
    })
    .eq('id', entryId)

  if (error) return { error: { _form: ['Erro ao atualizar lancamento.'] } }

  revalidatePath(`/${slug}/financeiro`)
  revalidatePath(`/${slug}/clientes`)
  return { success: true }
}
```

[VERIFIED: codebase — padrão direto de commission-entries.ts]

### Pattern 6: Zod Schemas para financial_entries

```typescript
// Source: padrão de commission-schemas.ts
import { z } from 'zod'

export const createFinancialEntrySchema = z.object({
  entry_type: z.enum(['receivable', 'payable']),
  description: z.string().min(3, 'Descricao obrigatoria'),
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data no formato YYYY-MM-DD'),
  policy_id: z.string().uuid().optional().nullable(),
  quota_id: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const markFinancialEntryPaidSchema = z.object({
  entry_id: z.string().uuid('ID de lancamento invalido'),
  paid_at: z.string().datetime().optional(),
})

export const softDeleteFinancialEntrySchema = z.object({
  entry_id: z.string().uuid('ID de lancamento invalido'),
})

export type CreateFinancialEntryInput = z.infer<typeof createFinancialEntrySchema>
export type MarkFinancialEntryPaidInput = z.infer<typeof markFinancialEntryPaidSchema>
```

### Pattern 7: FinancialStatusBadge — Replicar CommissionEntryBadge

```typescript
// Source: padrão direto de commission-entry-badge.tsx
const config = {
  pending:   { label: 'Pendente',   className: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100' },
  paid:      { label: 'Pago',       className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100' },
  cancelled: { label: 'Cancelado',  className: 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100' },
} as const
```

[VERIFIED: codebase — commission-entry-badge.tsx usa exatamente esta estrutura de config]

### Pattern 8: Tela /financeiro — Server Component com Tabs

O padrão de referência é `src/app/(app)/[slug]/corretores/[id]/page.tsx`:
- Parâmetros lidos via `await params` e `await searchParams` (Next.js 15)
- MonthSelector reutilizado sem modificações
- StatCards reutilizados com `formatBRL`
- Tabs com `Receber | Pagar | Todos | Vencidos`
- Tabela paginada 25 itens com colunas: Descrição, Valor, Vencimento, Status, Vínculo, Ações

**Paginação:** A aba Vencidos não usa filtro de mês, mas usa paginação (offset/limit padrão 25) — escala à medida que lançamentos vencidos se acumulam.

### Anti-Patterns to Avoid

- **Não criar `financial_entries` sem RLS UPDATE policy** — ao contrário de `commission_entries`, lançamentos precisam ser atualizados (paid, cancelled). Ausência da policy UPDATE bloquearia `markFinancialEntryPaidAction`.
- **Não calcular inadimplência com campo derivado** — usar critério em query (`due_date < CURRENT_DATE AND status = 'pending'`), nunca um campo `is_overdue` computado (decisão D-09).
- **Não usar EXISTS direto no Supabase JS client select** — o client não suporta EXISTS; usar Promise.all com segunda query (Pattern 4).
- **Não passar `amount` negativo** — `financial_entries.amount` deve ser sempre positivo (`CHECK amount > 0`). A natureza payable/receivable é discriminada pelo `entry_type`, não pelo sinal do valor.
- **Não expor `/financeiro` para role `corretor`** — o middleware ou Server Component deve verificar role e redirecionar. Badge de inadimplência é a única exceção de visibilidade para corretor.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Formatação de moeda BRL | Formatter customizado | `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` | Zero dependência, nativo, exato |
| Cálculo de datas de início/fim de mês | Aritmética manual | `startOfMonth` / `endOfMonth` de date-fns | DST-safe, testado, padrão estabelecido (Phase 3 CR-03) |
| Validação de formulários | Validação manual | Zod `safeParse` + React Hook Form | Type inference automático, padrão CR-01 |
| Estado do formulário de criação | useState manual por campo | React Hook Form com `zodResolver` | Padrão performance-first para 10+ campos |
| Badge de status visual | CSS inline | `FinancialStatusBadge` (replica `CommissionEntryBadge`) | Consistência visual, centralizado |
| Proteção de soft delete | `if (deletedAt) throw` no código | Trigger PostgreSQL `prevent_hard_delete` | Enforcement no banco, não contornável |

---

## Common Pitfalls

### Pitfall 1: RLS UPDATE ausente bloqueia markFinancialEntryPaidAction
**What goes wrong:** Server Action retorna erro silencioso ao tentar UPDATE sem policy RLS correspondente.
**Why it happens:** `commission_entries` (Phase 4) deliberadamente não tem UPDATE policy. Developer copia o padrão sem adaptar para `financial_entries`.
**How to avoid:** A migration RLS de financial_entries DEVE incluir uma `financial_entries_update` policy para roles `admin` e `financeiro`.
**Warning signs:** `markFinancialEntryPaidAction` retorna `{ error: { _form: ['Erro ao atualizar lancamento.'] } }` mesmo com dados corretos.

### Pitfall 2: Badge de inadimplência visível para todos os roles
**What goes wrong:** A subquery EXISTS não tem filtro de role — mostra badge para `visualizador` que não tem acesso a `/financeiro`.
**Why it happens:** RLS da tabela financial_entries controla acesso aos dados, mas o badge é renderizado no Server Component de clientes que tem roles diferentes.
**How to avoid:** Na query de overdueClientIds, passar `userId` e `userRole` — se role não é `admin`, `financeiro`, ou (`corretor` com `assigned_to = userId`), não executar a segunda query e retornar `overdueClientIds = new Set()`.
**Warning signs:** `visualizador` vê badges de inadimplência na listagem de clientes.

### Pitfall 3: Aba "Vencidos" sem controle de volume
**What goes wrong:** Aba Vencidos carrega TODOS os lançamentos vencidos históricos sem paginação — pode ser centenas de registros em tenants com histórico longo.
**Why it happens:** D-07 diz "sem filtro de mês", mas não especifica limite explícito.
**How to avoid:** Aplicar paginação padrão de 25 itens também na aba Vencidos. O MonthSelector fica desativado (visualmente) quando aba Vencidos está ativa.
**Warning signs:** Lentidão na aba Vencidos depois de 3+ meses de uso.

### Pitfall 4: Sugestão de lançamento pós-comissão cria duplicata
**What goes wrong:** Se usuário abre o Dialog de sugestão duas vezes (ou há retry na network), dois lançamentos `receivable` idênticos são criados.
**Why it happens:** Não há verificação de idempotência para a sugestão (diferente de `markCommissionPaidAction` que verifica `commission_paid_at`).
**How to avoid:** O Dialog de sugestão deve ser controlado por estado local — após criação bem-sucedida, fechar e não reabrir. Na Server Action de criação, não implementar idempotência hard (lançamentos avulsos repetidos são legítimos no modelo). A responsabilidade de evitar duplicatas é UX (Dialog fecha após sucesso).
**Warning signs:** Dois lançamentos com mesma descrição e valor para a mesma apólice/data.

### Pitfall 5: `due_date` em DATE vs TIMESTAMPTZ — comparação inconsistente
**What goes wrong:** `due_date < CURRENT_DATE` funciona em PostgreSQL mas no JS client, `due_date` chega como string `YYYY-MM-DD`. Comparar com `new Date()` sem normalizar o timezone pode gerar falsos negativos (lançamento vencido aparece como pendente).
**Why it happens:** `DATE` no PostgreSQL é timezone-naive, mas `new Date()` no JS é UTC.
**How to avoid:** Para a query de inadimplência, usar `.lt('due_date', todayStr)` onde `todayStr = format(new Date(), 'yyyy-MM-dd')` (date-fns, sem hora). Para comparações no PostgreSQL direto, `due_date < CURRENT_DATE` é correto.
**Warning signs:** Em testes criados com `due_date = hoje`, o lançamento aparece como vencido quando não deveria.

### Pitfall 6: `amount` positivo no CHECK, negativo no payload
**What goes wrong:** `CHECK (amount > 0)` na tabela, mas o formulário não valida `amount > 0` antes de enviar — erro 400 do banco sem mensagem clara ao usuário.
**Why it happens:** Zod valida formato mas não positivo, ou developer remove o `.positive()` por acidente.
**How to avoid:** Manter `z.coerce.number().positive('Valor deve ser positivo')` no `createFinancialEntrySchema`. Testar com valor 0 e negativo.

### Pitfall 7: revalidatePath insuficiente após markPaid
**What goes wrong:** Marcar lançamento como pago atualiza o DB mas a listagem de clientes (badge de inadimplência) não é invalidada — usuário vê badge "Inadimplente" mesmo após quitação.
**Why it happens:** `revalidatePath` chamado apenas para `/financeiro`, esquecendo `/clientes`.
**How to avoid:** `markFinancialEntryPaidAction` deve chamar `revalidatePath` para ambas as rotas: `/${slug}/financeiro` e `/${slug}/clientes`.

---

## Code Examples

### Filtro de mês DST-safe para financial_entries

```typescript
// Source: padrão Phase 3 CR-03 — corretores/[id]/page.tsx
import { startOfMonth, endOfMonth, format, parse } from 'date-fns'

const today = new Date()
const selectedMonthStart = sp.month
  ? parse(sp.month + '-01', 'yyyy-MM-dd', today)
  : startOfMonth(today)
const monthStartStr = format(startOfMonth(selectedMonthStart), 'yyyy-MM-dd')
const monthEndStr   = format(endOfMonth(selectedMonthStart), 'yyyy-MM-dd')
const todayStr      = format(today, 'yyyy-MM-dd')
```

### Query de lançamentos paginada com tabs

```typescript
// Source: padrão Phase 2 — 25 itens/página, offset via searchParams
const PAGE_SIZE = 25
const tab = sp.tab ?? 'receivable' // 'receivable' | 'payable' | 'all' | 'overdue'
const page = Math.max(1, parseInt(sp.page ?? '1', 10))
const offset = (page - 1) * PAGE_SIZE

let entriesQuery = supabase
  .from('financial_entries')
  .select('id, entry_type, description, amount, due_date, status, paid_at, policy_id, quota_id, client_id, notes', { count: 'exact' })
  .is('deleted_at', null)
  .order('due_date', { ascending: true })
  .range(offset, offset + PAGE_SIZE - 1)

if (tab === 'receivable') {
  entriesQuery = entriesQuery.eq('entry_type', 'receivable').gte('due_date', monthStartStr).lte('due_date', monthEndStr)
} else if (tab === 'payable') {
  entriesQuery = entriesQuery.eq('entry_type', 'payable').gte('due_date', monthStartStr).lte('due_date', monthEndStr)
} else if (tab === 'all') {
  entriesQuery = entriesQuery.gte('due_date', monthStartStr).lte('due_date', monthEndStr)
} else if (tab === 'overdue') {
  // D-07: sem filtro de mês — todos os históricos vencidos
  entriesQuery = entriesQuery.eq('status', 'pending').lt('due_date', todayStr)
}
```

### Soft delete de lançamento

```typescript
// Source: padrão Phase 3/4 — soft delete via updated_at + deleted_at
export async function softDeleteFinancialEntryAction(slug: string, entryId: string) {
  const parsed = softDeleteFinancialEntrySchema.safeParse({ entry_id: entryId })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = (await createClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessao expirada.'] } }

  const role = (user.app_metadata as { role?: string })?.role
  if (!['admin', 'financeiro'].includes(role ?? ''))
    return { error: { _form: ['Sem permissao.'] } }

  const { error } = await supabase
    .from('financial_entries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', entryId)
    .is('deleted_at', null) // Só deleta se ainda não foi deletado

  if (error) return { error: { _form: ['Erro ao excluir lancamento.'] } }

  revalidatePath(`/${slug}/financeiro`)
  revalidatePath(`/${slug}/clientes`)
  return { success: true }
}
```

### Sidebar item "Financeiro"

```typescript
// Source: sidebar-shell.tsx — inserir entre "Parceiros" e "Configurações"
import { Wallet } from 'lucide-react' // Recomendação: Wallet (mais semântico que Banknote)

// No array navItems, após o item Parceiros:
{
  label: 'Financeiro',
  href: `/${slug}/financeiro`,
  icon: <Wallet size={16} />,
}
```

**Nota:** `Wallet` é semanticamente mais preciso (gestão de fluxo de caixa) do que `Banknote` (notas físicas). `DollarSign` já está em uso em `CircleDollarSign` para Consórcio — evitar confusão. [VERIFIED: codebase — sidebar-shell.tsx usa `CircleDollarSign` para Consórcio]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers` | `@supabase/ssr` | Phase 1 | Padrão já estabelecido — não alterar |
| `supabase gen types` com tipos gerados | `as any` cast para tabelas novas | Phase 3/4 | financial_entries não terá tipos gerados — usar cast conforme estabelecido |
| `user_metadata` para claims | `app_metadata` para claims | Phase 1 D-17 | Imutável pelo usuário — critério de segurança crítico |

**Deprecated/outdated:**
- `@supabase/auth-helpers`: deprecado, nunca usar
- `NextAuth.js` para este projeto: fora de escopo per CLAUDE.md

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Cálculo dos 3 cards (A Receber, A Pagar, Saldo) em JS após fetch é suficiente para v1 com até 5.000 clientes | Architecture Patterns (Pattern 3) | Performance degradada em tenants com volume alto; mitigação: migrar para RPC SQL |
| A2 | Índice composto em `(tenant_id, status, due_date)` não é necessário em v1 — índices individuais são suficientes | Pattern 1 (Schema) | Queries de inadimplência mais lentas sob carga; mitigação: adicionar índice composto se necessário |
| A3 | Supabase JS client `.lt('due_date', todayStr)` compara corretamente DATE vs string YYYY-MM-DD | Common Pitfalls (Pitfall 5) | Comparações incorretas de inadimplência; verificar no primeiro teste de integração |

---

## Open Questions (RESOLVED)

1. **Integração pós-comissão: qual a UX exata do Dialog secundário?**
   - What we know: D-04 diz "Dialog secundário pós-confirmação com campos pré-preenchidos (valor do prêmio, vencimento = hoje). Usuário pode aceitar ou dispensar."
   - What's unclear: O Dialog abre automaticamente após fechar o Dialog de comissão, ou é um botão no toast de sucesso?
   - RESOLVED: Abre automaticamente após sucesso do `markCommissionPaidAction` — o Dialog de comissão retorna `{ success: true, suggestEntry: { amount, description, policy_id } }` e o componente Client abre o segundo Dialog com esses valores pré-preenchidos.

2. **Proteção de acesso à rota `/financeiro` para roles não autorizados**
   - What we know: D-05 diz que apenas admin/financeiro acessam /financeiro.
   - What's unclear: O controle deve ser no middleware, no layout, ou no Server Component da página?
   - RESOLVED: Verificar role no topo do Server Component `financeiro/page.tsx` — se role não está em `['admin', 'financeiro']`, chamar `notFound()` (padrão de `corretores/[id]/page.tsx` que usa `redirect` para corretor tentando acessar dashboard de outro). Middleware seria mais eficiente mas as outras páginas usam verificação no componente — manter consistência.

---

## Environment Availability

Step 2.6: SKIPPED — Esta fase é puramente de código/migrations. Não há novas dependências externas além das já presentes no projeto (Supabase managed, Node.js, npm). Todas as ferramentas de desenvolvimento (Supabase CLI, Node.js, npm) foram verificadas em phases anteriores.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Verificar via `cat package.json` — provável Vitest ou Jest (não detectado explicitamente em phases anteriores) |
| Config file | Nenhum detectado em phases anteriores |
| Quick run command | A definir na Wave 0 |
| Full suite command | A definir na Wave 0 |

**Nota:** Em phases anteriores (1-4), os planos não incluíram testes automatizados explícitos (execução manual via Supabase CLI e navegador). Phase 5 segue o mesmo padrão até que infraestrutura de testes seja estabelecida.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIN-01 | Criar lançamento receivable via Dialog | manual-only | — | — |
| FIN-02 | Criar lançamento payable via Dialog | manual-only | — | — |
| FIN-03 | Cards de resumo exibem valores corretos por período | manual-only | — | — |
| FIN-04 | Badge "Inadimplente" aparece na listagem de clientes | manual-only | — | — |
| FIN-05 | Marcar lançamento como pago atualiza status e paid_at | manual-only | — | — |

**Justificativa para manual-only:** O projeto não tem infraestrutura de testes configurada (não encontrado jest.config.*, vitest.config.* ou diretório tests/ no codebase). Todos os requisitos envolvem interações com banco de dados e UI — seriam testes de integração/e2e que requerem setup de Supabase de teste. Estabelecer essa infraestrutura está fora do escopo desta fase.

### Wave 0 Gaps

- [ ] Nenhum arquivo de teste a criar — projeto sem infraestrutura de testes. UAT manual via browser permanece o padrão de verificação desta fase.

*(Se infraestrutura de testes for adicionada no futuro, os testes prioritários seriam: `markFinancialEntryPaidAction` idempotência, cálculo de saldo BRL, query de inadimplência com dados de borda timezone.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth via `createClient()` + `auth.getUser()` em todas as Server Actions |
| V3 Session Management | yes | Supabase Auth gerencia sessão via cookies (@supabase/ssr) |
| V4 Access Control | yes | RLS policies no banco + verificação de role em Server Actions e Server Components |
| V5 Input Validation | yes | Zod `safeParse` obrigatório antes de qualquer DB call (CR-01) |
| V6 Cryptography | no | Sem dados criptografados nesta fase — valores financeiros são operacionais, não PII sensível além do já tratado em phases anteriores |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Acesso cross-tenant via financial_entries | Tampering/Spoofing | RLS com `jwt_tenant_id()` — tenant_id em toda query |
| Corretor vendo lançamentos de outros clientes | Information Disclosure | RLS SELECT policy com subquery em `clients.assigned_to = auth.uid()` |
| Escalada de privilégio: `visualizador` criando lançamentos | Elevation of Privilege | INSERT policy restringe a `admin` e `financeiro` |
| Forced browsing para `/financeiro` sem role adequado | Elevation of Privilege | Verificação de role no topo do Server Component com `notFound()` |
| `amount` manipulation (valor negativo via API direta) | Tampering | `CHECK (amount > 0)` na coluna PostgreSQL + validação Zod `.positive()` |
| Soft delete bypass (hard DELETE via API direta) | Tampering | Trigger `prevent_hard_delete` + ausência de RLS DELETE policy |
| `paid_at` manipulation (data futura) | Tampering | Schema aceita qualquer date — risco baixo para v1; monitorar se necessário |
| Double-submit do Dialog de sugestão pós-comissão | Tampering | UX: Dialog fecha após sucesso; sem constraint de unicidade (lançamentos avulsos são válidos) |

### Nota LGPD
- `created_by UUID REFERENCES profiles(id)` — mantém trilha de auditoria de quem criou o lançamento (requisito LGPD).
- `deleted_at` + trigger `prevent_hard_delete` — preserva histórico financeiro mesmo após "exclusão" pelo usuário.
- Não há PII novo nesta fase além dos `client_id` e `policy_id` já presentes em outras tabelas.

---

## Sources

### Primary (HIGH confidence)
- Codebase verificado: `src/lib/actions/commission-entries.ts` — padrão canônico de Server Action
- Codebase verificado: `src/lib/validations/commission-schemas.ts` — padrão canônico de Zod schemas
- Codebase verificado: `src/components/corretores/commission-entry-badge.tsx` — padrão de badge por tipo
- Codebase verificado: `src/components/corretores/stat-card.tsx` — componente reutilizável
- Codebase verificado: `src/components/corretores/month-selector.tsx` — componente reutilizável
- Codebase verificado: `src/components/auth/sidebar-shell.tsx` — ponto de integração sidebar
- Codebase verificado: `src/app/(app)/[slug]/clientes/page.tsx` — ponto de integração badge
- Codebase verificado: `supabase/migrations/20260420_0016_corretores_schema.sql` — schema de referência
- Codebase verificado: `supabase/migrations/20260420_0018_corretores_rls.sql` — RLS de referência
- Codebase verificado: `supabase/migrations/20260420_0002_rls_helpers.sql` — funções jwt_tenant_id/role
- Codebase verificado: `supabase/migrations/20260420_0005_soft_delete_triggers.sql` — trigger prevent_hard_delete
- `.planning/phases/05-financeiro/05-CONTEXT.md` — decisões do usuário

### Secondary (MEDIUM confidence)
- CLAUDE.md — stack, convenções e constraints do projeto
- `.planning/REQUIREMENTS.md` — FIN-01 a FIN-05

### Tertiary (LOW confidence)
- Nenhuma

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todas as dependências já em uso no projeto, verificadas no codebase
- Schema design: HIGH — espelha `commission_entries` com adaptações bem definidas pelo usuário em CONTEXT.md
- RLS patterns: HIGH — padrões estabelecidos em phases 1-4, verificados no codebase
- Architecture: HIGH — decisões detalhadas no CONTEXT.md, sem ambiguidade
- Pitfalls: HIGH — derivados de análise do código existente e das diferenças entre commission_entries e financial_entries

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (stack estável, nenhuma dependência em movimento rápido)

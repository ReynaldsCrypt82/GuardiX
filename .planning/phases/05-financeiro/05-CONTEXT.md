# Phase 5: Financeiro — Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Entregar o módulo completo de gestão financeira da corretora:
1. **Lançamentos financeiros** — tabela `financial_entries` (contas a receber e a pagar) com criação manual e sugestão automática ao marcar apólice como paga.
2. **Tela /financeiro** — listagem com tabs Receber | Pagar | Todos, cards de resumo (a receber, a pagar, saldo do período), dropdown de mês, e botão "Novo lançamento".
3. **Marcar como recebido/quitado** — botão + dialog que define `paid_at` e muda status para `paid` (FIN-05).
4. **Inadimplência** — badge no cliente quando há lançamento vencido (due_date < hoje, status pendente) + aba "Vencidos" em /financeiro (FIN-04).

Esta fase NÃO inclui: gráficos/KPIs executivos (Phase 6), exportação PDF/Excel (Phase 6), alertas por email (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Estrutura de Dados (D-01, D-02, D-03)

- **D-01:** Tabela única `financial_entries` com coluna discriminadora `entry_type TEXT CHECK IN ('receivable', 'payable')`. Mesmo padrão de `commission_entries` (Phase 4) — evita duplicação de schema, RLS e actions.
- **D-02:** Campos obrigatórios mínimos:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `tenant_id UUID NOT NULL REFERENCES tenants(id)`
  - `entry_type TEXT NOT NULL CHECK IN ('receivable', 'payable')`
  - `description TEXT NOT NULL`
  - `amount NUMERIC(12,2) NOT NULL`
  - `due_date DATE NOT NULL`
  - `status TEXT NOT NULL DEFAULT 'pending' CHECK IN ('pending', 'paid', 'cancelled')`
  - `paid_at TIMESTAMPTZ` — nullable, preenchido ao marcar como quitado (FIN-05)
  - `policy_id UUID REFERENCES policies(id)` — nullable
  - `quota_id UUID REFERENCES consortium_quotas(id)` — nullable
  - `client_id UUID REFERENCES clients(id)` — nullable (para badge de inadimplência)
  - `notes TEXT` — nullable
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `created_by UUID REFERENCES profiles(id)` — para auditoria
  - `deleted_at TIMESTAMPTZ` — soft delete (padrão Phase 1 D-12)
- **D-03:** Vínculo a `policy_id` / `quota_id` é **opcional** (nullable). Permite lançamentos avulsos (taxa de administração, despesa operacional genérica) além dos vinculados a apólices/cotas.

### Criação de Lançamentos (D-04, D-05)

- **D-04:** Criação **manual** pelo usuário em `/[slug]/financeiro` via Dialog "Novo lançamento" (campos: descrição, valor, tipo, vencimento, vínculo opcional). **Também:** ao clicar "Marcar comissão como paga" em uma apólice ou cota (Phase 4), o sistema **oferece opcionalmente** criar um lançamento receivable correspondente — Dialog secundário pós-confirmação com campos pré-preenchidos (valor do prêmio, vencimento = hoje). Usuário pode aceitar ou dispensar.
- **D-05:** RBAC — apenas `role IN ('admin', 'financeiro')` pode criar, editar e ver `/financeiro`. Corretor e Visualizador não têm acesso ao módulo financeiro. Badge de inadimplência no cliente é exceção: visível para admin, financeiro e corretor responsável (`assigned_to = auth.uid()`).

### Tela de Financeiro (D-06, D-07, D-08)

- **D-06:** Rota `/[slug]/financeiro` — Server Component com:
  - 3 cards no topo: "A Receber no Mês" (soma de receivables pendentes no mês), "A Pagar no Mês" (soma de payables pendentes), "Saldo do Mês" (a receber – a pagar)
  - MonthSelector (reutilizar componente da Phase 4) — URL-driven `?month=YYYY-MM`
  - Tabs: `Receber | Pagar | Todos | Vencidos`
  - Tabela paginada (25 itens/página, padrão Phase 2) com colunas: Descrição, Valor (BRL), Vencimento, Status (Badge), Vínculo (apólice/cota se houver), Ações (Marcar como pago | Excluir)
  - Botão "Novo lançamento" no header
- **D-07:** Aba "Vencidos" = lançamentos com `status = 'pending' AND due_date < CURRENT_DATE` — sem filtro de mês (mostra todos os vencidos históricos).
- **D-08:** Marcar como recebido/quitado: Dialog de confirmação com campo `paid_at` (default = hoje, editável). Server Action `markFinancialEntryPaidAction` atualiza `status = 'paid'` e `paid_at`. Idempotência: verificar `status != 'paid'` antes de atualizar.

### Inadimplência (D-09, D-10)

- **D-09:** Critério: `status = 'pending' AND due_date < CURRENT_DATE` (calculado na query, sem campo derivado). Zero configuração por tenant — simples para v1.
- **D-10:** Badge de inadimplência no cliente:
  - Aparece na listagem `/[slug]/clientes` na linha do cliente — badge vermelho "Inadimplente" quando o cliente tem ao menos 1 lançamento vencido.
  - Query no Server Component da listagem de clientes: `EXISTS (SELECT 1 FROM financial_entries WHERE client_id = clients.id AND status = 'pending' AND due_date < CURRENT_DATE AND deleted_at IS NULL)`.
  - Visível para: admin, financeiro, e corretor responsável (`clients.assigned_to = auth.uid()`).
  - Aba "Vencidos" em `/financeiro` com todos os lançamentos vencidos (D-07 acima).

### Claude's Discretion

- Status do badge na listagem de clientes: componente inline usando `className` condicional (padrão `VigenciaBadge`) — Claude decide se reutiliza ou cria novo componente.
- Ordem padrão da tabela em /financeiro: `due_date ASC` (vencimentos mais próximos primeiro).
- Ícone do item "Financeiro" na sidebar: Claude decide entre `Wallet`, `DollarSign`, ou `Banknote` do Lucide React.
- Empty state de /financeiro: Claude define copy exato.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Financeiro — FIN-01 a FIN-05 (todos os requisitos desta fase)

### Prior Phase Decisions (padrões a seguir)
- `.planning/phases/01-fundacao-auth/01-CONTEXT.md` — D-11 (RBAC: admin/corretor/financeiro/visualizador), D-12 (soft delete com `deleted_at`), D-16 a D-20 (Supabase RLS patterns)
- `.planning/phases/02-crm-clientes/02-CONTEXT.md` — D-04 (corretor responsável é FK para profiles.id), D-05 (tabela paginada 25 itens, shadcn Table)
- `.planning/phases/03-seguros-consorcio/03-CONTEXT.md` — D-06 (alertas in-app only), D-03 (VigenciaBadge pattern)
- `.planning/phases/04-corretores-comissoes/04-CONTEXT.md` — D-09 (botão "Marcar comissão como paga" — gatilho para sugestão de lançamento), D-10 (commission_entries como referência de append-only pattern)

### Schema existente (referência para ALTER TABLE)
- `supabase/migrations/20260420_0011_seguros_schema.sql` — tabela `policies` com `premio_total`, `assigned_to`
- `supabase/migrations/20260420_0013_consorcio_schema.sql` — tabela `consortium_quotas` e `clients`
- `supabase/migrations/20260420_0016_corretores_schema.sql` — `commission_entries` como padrão de schema para `financial_entries`

### Project Context
- `.planning/PROJECT.md` — stack (Next.js + Supabase + Vercel), multi-tenancy via RLS, mercado Brasil (BRL, LGPD)
- `.planning/ROADMAP.md` — Phase 5 success criteria e dependencies

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/corretores/month-selector.tsx` — MonthSelector reutilizável para filtro de período em /financeiro
- `src/components/corretores/stat-card.tsx` — StatCard reutilizável para os 3 cards de resumo (a receber, a pagar, saldo)
- `src/components/corretores/commission-entry-badge.tsx` — padrão de badge colorido por tipo; replicar para status de lançamento (pending=amarelo, paid=verde, cancelled=cinza)
- `src/lib/actions/commission-entries.ts` — padrão canônico de Server Action append-only com idempotência; replicar para `markFinancialEntryPaidAction`
- `src/lib/validations/commission-schemas.ts` — padrão de Zod schema com validação de amount; replicar para `createFinancialEntrySchema`
- `src/app/(app)/[slug]/corretores/[id]/page.tsx` — padrão de tabs + stat cards + query paralela com Promise.all
- `src/app/(app)/[slug]/clientes/page.tsx` — ponto de integração para badge de inadimplência

### Established Patterns
- `supabase as any` cast para tabelas sem tipos gerados — manter até próximo `supabase gen types`
- Zod `safeParse` antes de qualquer DB call (obrigatório desde Phase 3 CR-01)
- `revalidatePath` nas Server Actions que modificam dados exibidos na tela
- `startOfMonth` / `endOfMonth` de `date-fns` para filtros de mês (DST-safe, Phase 3 CR-03)
- `try/catch` em queries de layout com fallback count=0

### Integration Points
- `src/app/(app)/[slug]/clientes/page.tsx` — adicionar subquery EXISTS para badge de inadimplência
- `src/components/auth/sidebar-shell.tsx` — adicionar item "Financeiro" entre Parceiros e Configurações
- `src/app/(app)/[slug]/seguros/[id]/page.tsx` — Dialog pós mark-commission-paid oferece criar lançamento receivable
- `src/app/(app)/[slug]/consorcio/[id]/page.tsx` — idem para cotas contempladas

</code_context>

<specifics>
## Specific Ideas

- A sugestão automática de lançamento após "Marcar comissão como paga" deve ser **opcional** — Dialog secundário que pode ser dispensado. Não criar automaticamente sem confirmação.
- Os 3 cards de resumo (A Receber, A Pagar, Saldo) usam `StatCard` da Phase 4 com valores em BRL. O card "Saldo" pode ser verde (positivo) ou vermelho (negativo) — mesmo padrão de meta% no dashboard do corretor.
- A aba "Vencidos" em /financeiro não filtra por mês — exibe **todos** os lançamentos vencidos históricos para que nada fique esquecido.
- Badge de inadimplência no cliente: usar cor `destructive` (vermelho) — mesmo token do `text-destructive` já em uso no projeto.

</specifics>

<deferred>
## Deferred Ideas

- **Gráfico de barras entradas × saídas** — Phase 6 (Dashboards & Relatórios) junto com outros KPIs executivos.
- **Exportação PDF/Excel dos lançamentos** — Phase 6 junto com exportação unificada de relatórios.
- **FIN-04 em Phase 5 é satisfeito por:** badge "Inadimplente" na listagem /clientes + aba "Vencidos" em /financeiro. A expressão "alerta automático de atraso" no requisito refere-se a identificação ativa (não manual — o sistema calcula automaticamente via query `due_date < today`), não a notificação push/email. Alerta proativo por email = Phase 7 (n8n + Resend).
- **Date range picker customizado** — substituir MonthSelector por range picker quando houver necessidade de relatórios históricos longos (Phase 6).
- **Tolerância de dias configurável por tenant** — tornar o critério de inadimplência configurável (ex: 5 dias de carência). Complexidade não justificada em v1.

</deferred>

---

*Phase: 05-financeiro*
*Context gathered: 2026-04-29*

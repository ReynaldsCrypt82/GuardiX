# Phase 4: Corretores & Comissões — Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Entregar o módulo completo de corretores e comissões:
1. **Corretores internos** — cadastro de atributos de negócio (SUSEP, meta, taxa) vinculados aos `profiles.role='corretor'` já existentes.
2. **Parceiros externos** — tabela independente de `partners` sem acesso ao sistema, com regras de repasse por produto.
3. **Ledger de comissões** — append-only, imutável após registro, alimentado pelo botão "marcar pago" em apólices e cotas.
4. **Dashboard individual** — rota `/[slug]/corretores/[id]` com produção, comissão, carteira e meta; com aba de relatório mensal.

Esta fase NÃO inclui: módulo financeiro completo (Phase 5), dashboards executivos gerais (Phase 6), notificações por email de comissões (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Corretor Interno × Usuário do Sistema (D-01, D-02, D-03)

- **D-01:** Corretor interno **sempre** tem conta de usuário — `profiles.role = 'corretor'` é a identidade. Não existe "corretor sem login" em v1.
- **D-02:** Tabela `broker_profiles` (1:1 com `profiles.id`) armazena os atributos de negócio do corretor:
  - `susep_number TEXT` — número SUSEP (opcional, pode ser nulo)
  - `monthly_goal NUMERIC(12,2)` — meta mensal em BRL
  - `commission_rate_default NUMERIC(5,4)` — taxa padrão (ex: 0.0500 = 5%)
  - `commission_rate_overrides JSONB` — taxas por tipo de produto (ver D-06)
  - `tenant_id UUID` — RLS por tenant
  - `created_at`, `updated_at`, `deleted_at` (soft delete — herda Phase 1 D-12)
- **D-03:** Apenas `role = 'admin'` pode criar/editar `broker_profiles`. Corretor não edita o próprio perfil de negócio.

### Parceiros Externos (D-04, D-05, D-06)

- **D-04:** Tabela `partners` — entidade **independente de `profiles`** (sem login). Campos:
  - `name TEXT NOT NULL`
  - `cnpj TEXT` (opcional)
  - `contact_email TEXT`, `contact_phone TEXT`
  - `commission_rate_default NUMERIC(5,4)`
  - `commission_rate_overrides JSONB` (mesmo formato que D-06)
  - `tenant_id UUID`, `created_at`, `updated_at`, `deleted_at`
- **D-05:** `partner_id UUID REFERENCES partners(id)` é campo **nullable** em `policies` e `consortium_quotas`. Apólices sem parceiro são a norma; campo preenchido apenas quando houve indicação externa.
- **D-06 (split de comissão):** Quando há parceiro, são geradas **duas entradas independentes** no ledger:
  1. Corretor interno → `broker_id + rate do broker_profiles`
  2. Parceiro externo → `partner_id + rate do partners`
  Rates são independentes — não precisam somar a taxa base total.

### Estrutura de Taxa por Tipo de Produto (D-07)

- **D-07:** JSONB unificado `commission_rate_overrides` em `broker_profiles` e `partners`:
  ```json
  {
    "auto": 0.06,
    "vida": 0.08,
    "residencial": 0.05,
    "empresarial": 0.07,
    "saude": 0.04,
    "outros": 0.05,
    "consorcio_auto": 0.03,
    "consorcio_imovel": 0.025,
    "consorcio_servico": 0.03
  }
  ```
  Lógica de resolução: override do tipo específico → fallback para `commission_rate_default`.
  Chaves ausentes no JSONB → usa o default. Seguros usam `policies.type`; consórcio usa `consortium_groups.type` prefixado com `consorcio_`.

### Base e Gatilho do Cálculo de Comissão (D-08, D-09)

- **D-08:** Base de cálculo:
  - Apólice: `policies.premio_total × rate_resolvida`
  - Cota de consórcio: `consortium_groups.credit_value × rate_resolvida`
- **D-09:** **Gatilho = botão "Marcar comissão como paga"** nas telas de detalhes da apólice e da cota. Ao clicar, Server Action insere entrada no ledger (`entry_type = 'comissao'`) com valores calculados na hora. Apólice/cota ganha campo `commission_paid_at TIMESTAMPTZ` (nullable) para indicar estado.

  Não há cálculo automático no momento do cadastro — a comissão só entra no ledger quando o admin/corretor confirma que foi recebida.

### Ledger de Comissões (D-10)

- **D-10:** Tabela `commission_entries` — append-only, **sem UPDATE ou DELETE**:
  - `id UUID PRIMARY KEY`
  - `entry_type TEXT CHECK IN ('comissao', 'estorno', 'correcao')` — `estorno` e `correcao` são novos lançamentos, nunca edição do original
  - `broker_id UUID REFERENCES profiles(id)` (nullable — null quando entry é para parceiro)
  - `partner_id UUID REFERENCES partners(id)` (nullable — null quando entry é para corretor)
  - `policy_id UUID REFERENCES policies(id)` (nullable)
  - `quota_id UUID REFERENCES consortium_quotas(id)` (nullable)
  - `amount NUMERIC(12,2) NOT NULL`
  - `rate_used NUMERIC(5,4)` — taxa aplicada registrada para auditoria
  - `reference_month DATE` — mês de competência (primeiro dia do mês)
  - `notes TEXT`
  - `tenant_id UUID`, `created_at TIMESTAMPTZ DEFAULT now()`
  - **RLS:** INSERT permitido para admin e corretor; UPDATE e DELETE negados via policy (além de não ter Server Actions para eles)

### Dashboard Individual do Corretor (D-11, D-12, D-13)

- **D-11:** Rota dedicada `/[slug]/corretores/[id]` — admin vê qualquer corretor; corretor autenticado é automaticamente redirecionado para `/[slug]/corretores/[próprio-id]`. Nenhum corretor pode acessar o dashboard de outro.
- **D-12:** Métricas do dashboard (mês atual, mês selecionável):
  - Produção do mês (# apólices novas onde `assigned_to = broker_id`)
  - Comissão acumulada no mês (soma de `commission_entries.amount` do mês)
  - Carteira ativa (# clientes com pelo menos 1 apólice/cota ativa vinculada)
  - Meta mensal (`broker_profiles.monthly_goal`) e % atingido (comissão/meta × 100)
- **D-13:** Aba "Relatório" no dashboard exibe tabela de `commission_entries` do corretor filtrada por mês selecionado: data, tipo (badge), apólice/cota de referência, valor, taxa usada, notas.

### Listagem de Corretores (D-14)

- **D-14:** Rota `/[slug]/corretores` (listagem). Tabela com: nome do corretor, SUSEP, meta mensal, produção do mês corrente (# apólices), botão "Ver dashboard" (link para `/corretores/[id]`). Botão "Novo corretor" na verdade convida via Phase 1 (cria profile + broker_profile em dois passos — ou Claude decide fluxo mais simples).

### Claude's Discretion

- Fluxo de criação de corretor: Admin já existe como `profiles.role='corretor'` pela Phase 1 (convite). Phase 4 adiciona botão "Completar perfil de corretor" para preencher `broker_profiles` quando ainda não existe — Claude decide se é Dialog ou página separada.
- Paginação da listagem de corretores: 25 itens por página (padrão Phase 2).
- Seletor de mês no dashboard: mês corrente como default, dropdown para selecionar outros.
- Formatação de BRL nas métricas: `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` (padrão projeto).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Corretores — COM-01 a COM-06 (todos os requisitos desta fase)

### Prior Phase Decisions (padrões a seguir)
- `.planning/phases/01-fundacao-auth/01-CONTEXT.md` — D-11 (RBAC: admin/corretor/financeiro/visualizador), D-12 (soft delete com `deleted_at`), D-16 a D-20 (Supabase RLS patterns)
- `.planning/phases/02-crm-clientes/02-CONTEXT.md` — D-04 (corretor responsável é FK para profiles.id), D-05 (tabela paginada com shadcn Table)
- `.planning/phases/03-seguros-consorcio/03-CONTEXT.md` — D-03 (semáforo de vigência), D-04 (modelo de dados consórcio: `credit_value` em `consortium_groups`), D-06 (alertas in-app)

### Schema existente (Phase 3)
- `supabase/migrations/20260420_0011_seguros_schema.sql` — tabela `policies` com `assigned_to UUID REFERENCES profiles(id)`, `premio_total NUMERIC`
- `supabase/migrations/20260420_0013_consorcio_schema.sql` — tabela `consortium_quotas` e `consortium_groups` com `credit_value`

### Project Context
- `.planning/PROJECT.md` — stack (Next.js + Supabase + Vercel), multi-tenancy via RLS, mercado Brasil (BRL, LGPD)
- `.planning/ROADMAP.md` — Phase 4 success criteria e dependencies

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/actions/policies.ts` — padrão de Server Action com Zod safeParse + role guard + RLS: replicar para `commission_entries`
- `src/components/consorcio/contemplation-dialog.tsx` — Dialog pattern para forms curtos: reusar para "Completar perfil de corretor" e "Marcar comissão paga"
- `src/components/ui/` — shadcn Table, Badge, Card, Dialog, Select, Input, Label já instalados
- `src/app/(app)/[slug]/seguros/page.tsx` — listagem com filtros inline: padrão para `/[slug]/corretores`
- `src/app/(app)/[slug]/consorcio/[id]/page.tsx` — detalhe com CardHeader + abas: padrão para `/[slug]/corretores/[id]`

### Established Patterns
- `supabase as any` cast para tabelas sem tipos gerados — mesma abordagem para `broker_profiles`, `partners`, `commission_entries` até próximo `supabase gen types`
- Zod `safeParse` antes de qualquer DB call (obrigatório desde CR-01 da Phase 3)
- `revalidatePath` nas Server Actions que modificam dados exibidos na tela
- `startOfToday()` + `addDays()` de `date-fns` para aritmética de datas (DST-safe, Phase 3 CR-03)
- `try/catch` em queries de layout com fallback `count=0` (Phase 3 alertas in-app)

### Integration Points
- `policies` e `consortium_quotas` precisam de `partner_id UUID REFERENCES partners(id)` (nullable) — novo campo via migration
- `policies` e `consortium_quotas` precisam de `commission_paid_at TIMESTAMPTZ` (nullable) — novo campo via migration
- `src/app/(app)/[slug]/layout.tsx` — sidebar já lista Seguros e Consórcio; Phase 4 adiciona "Corretores" como novo item
- `src/components/auth/sidebar-shell.tsx` — nav items array; adicionar entrada para `/corretores`

</code_context>

<specifics>
## Specific Ideas

- O campo `reference_month DATE` no ledger usa o primeiro dia do mês (ex: `2026-04-01`) para facilitar agrupamento mensal em queries sem funções de data complexas.
- O JSON de `commission_rate_overrides` usa chaves `consorcio_auto`, `consorcio_imovel`, `consorcio_servico` para distinguir dos tipos de seguro — prefixo `consorcio_` evita colisão com o tipo `auto` de seguros.
- Estorno e correção são novos lançamentos no ledger (nunca UPDATE do original) — `entry_type = 'estorno'` com `amount` negativo reverte uma comissão errada; `entry_type = 'correcao'` complementa a diferença.

</specifics>

<deferred>
## Deferred Ideas

- **Exportação de relatório de comissões (PDF/Excel)** — mencionado implicitamente em COM-05/DASH-04; pertence a Phase 6 (Dashboards & Relatórios) onde a exportação será feita de forma unificada.
- **Notificação por email de comissão registrada** — Phase 7 (n8n + Resend).
- **Portal do parceiro** — acesso de leitura para parceiro externo ver suas comissões. Fora do escopo v1 (REQUIREMENTS.md Out of Scope).
- **Comissão por parcela paga** — base de cálculo mais granular; registrado como open question em STATE.md ("comissão projetada vs realizada"). Decisão tomada: usar `premio_total` em v1 (D-08).

</deferred>

---

*Phase: 04-corretores-comissoes*
*Context gathered: 2026-04-26*

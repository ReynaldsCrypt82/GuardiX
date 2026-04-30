# Phase 6: Dashboards & Relatorios - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin (e financeiro) tem visão executiva consolidada do negócio: 4 KPIs no topo, ranking de corretores por produção/comissão, alertas visuais de itens críticos, e botão de exportação Excel contextual nas listagens existentes. Rota `/dashboard` substitui o placeholder atual com conteúdo real diferenciado por role.

Fora do escopo desta phase: gráficos (charts), página /relatórios separada, Supabase Realtime, PDF.

</domain>

<decisions>
## Implementation Decisions

### KPIs & Visualização (D-01 a D-04)

- **D-01:** Visualização **somente stat cards + tabelas** — sem Recharts, sem gráficos. Recharts não será instalado nesta phase. Padrão idêntico ao das phases 4 e 5.
- **D-02:** Dashboard executivo tem **4 stat cards** no topo (com MonthSelector URL-driven):
  - "Apólices ativas" — count de policies com status `active` do tenant
  - "Receita do período" — soma de `financial_entries` (receivable + paid) no mês selecionado
  - "Inadimplência" — soma de `financial_entries` (receivable + pending + due_date < hoje) do tenant
  - "Vencendo em 30 dias" — count de policies com `end_date BETWEEN hoje e hoje+30`
- **D-03:** **MonthSelector** reutilizado de `src/components/corretores/month-selector.tsx` — URL-driven `?month=YYYY-MM`. Controla os cards de Receita e Inadimplência (não Apólices ativas nem Vencendo 30d que são atemporais).
- **D-04:** **Ranking de corretores** = tabela (não gráfico) com colunas: Corretor, Produção do mês (count apólices/cotas), Comissão do mês (R$). Filtrável pelo MonthSelector.

### Alertas Visuais (D-05)

- **D-05:** Alertas **estáticos no page load** (sem Supabase Realtime): seção "Alertas" abaixo dos cards com 3 listas:
  - Apólices vencendo nos próximos 30 dias (máx 5 itens com link)
  - Cobranças em atraso (financial_entries pending + overdue, máx 5 itens)
  - Assembleias próximas (próximos 7 dias, máx 5 itens)
  Cada lista tem contagem total e link "Ver todos" para a rota correspondente.

### Exportação Excel (D-06 a D-08)

- **D-06:** Formato **Excel (.xlsx) apenas** — PDF não está no escopo desta phase.
- **D-07:** **3 exportações contextuais separadas** — botão "Exportar Excel" nas listagens existentes:
  - `/[slug]/seguros` → exporta apólices.xlsx
  - `/[slug]/clientes` → exporta clientes.xlsx
  - `/[slug]/corretores` → exporta comissoes.xlsx (summary por corretor no período)
  Não haverá página /relatórios separada nesta phase.
- **D-08:** Export **respeita filtros ativos** na tela (mês, corretor, status) — passa searchParams como query params para a Server Action/Route Handler de exportação. Exporta exatamente o que está visível na tela filtrada.

### RBAC do Dashboard (D-09 a D-10)

- **D-09:** Rota `/[slug]/dashboard` diferenciada por role:
  - `admin` e `financeiro` → dashboard executivo (4 KPIs + ranking + alertas)
  - `corretor` → `redirect` para `/[slug]/corretores/[id]` (broker profile do usuário)
  - `visualizador` → `notFound()`
- **D-10:** Role `financeiro` vê o **mesmo conteúdo executivo que admin** — todos os KPIs do tenant, ranking completo de corretores e alertas.

### Claude's Discretion

- Biblioteca Excel: `xlsx` (SheetJS community edition) ou `exceljs` — decisão do planner baseado em bundle size e server-side compatibility com Next.js App Router
- Mecanismo de download: Route Handler (`/api/export/[type]`) ou Server Action retornando stream — decisão do planner
- Layout de alertas: cards ou lista simples — manter consistência com shadcn/ui e padrão visual das phases anteriores

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Padrões estabelecidos (reutilizar)
- `.planning/phases/04-corretores-comissoes/04-CONTEXT.md` — MonthSelector, stat cards, ranking pattern
- `.planning/phases/05-financeiro/05-CONTEXT.md` — stat cards, RBAC (notFound/redirect), inadimplência query pattern
- `src/components/corretores/month-selector.tsx` — componente a reutilizar no dashboard executivo

### Arquivos a modificar (ler o estado atual antes de editar)
- `src/app/(app)/[slug]/dashboard/page.tsx` — placeholder existente a ser substituído
- `src/app/(app)/[slug]/seguros/page.tsx` — adicionar botão Exportar Excel
- `src/app/(app)/[slug]/clientes/page.tsx` — adicionar botão Exportar Excel
- `src/app/(app)/[slug]/corretores/page.tsx` — adicionar botão Exportar Excel (comissoes por corretor)
- `src/components/auth/sidebar-shell.tsx` — verificar se item Dashboard já existe e está correto

### Referências de schema (tabelas consultadas nesta phase)
- `supabase/migrations/20260420_0001_foundation_schema.sql` — tabela `profiles`, `tenants`
- `supabase/migrations/20260420_0019_financeiro_schema.sql` — tabela `financial_entries`
- Tabelas `policies`, `consortium_quotas`, `commission_entries`, `broker_profiles` — das phases 3 e 4

### Corretor redirect target
- `src/app/(app)/[slug]/corretores/[id]/page.tsx` — página para onde corretor é redirecionado (Phase 4)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/corretores/month-selector.tsx` — MonthSelector URL-driven `?month=YYYY-MM`; reutilizar diretamente no dashboard executivo
- `src/components/ui/card.tsx` — CardHeader/CardContent/CardTitle — padrão stat cards
- `src/components/ui/badge.tsx` — status badges
- `src/components/ui/table.tsx` — tabela de ranking

### Established Patterns
- **Stat cards 3-4 no topo**: Phase 4 (corretores) e Phase 5 (financeiro) — grid com `grid-cols-2 lg:grid-cols-4`
- **Server Component + `supabase as any`**: cast para financial_entries e outras tabelas sem tipos gerados
- **RBAC guard**: `notFound()` para roles proibidos, `redirect()` para roles com destino alternativo
- **MonthSelector URL-driven**: `?month=YYYY-MM` via searchParams, default = mês atual

### Integration Points
- `/dashboard/page.tsx` — substituir placeholder; conectar a todas as tabelas do tenant
- Listagens `/seguros`, `/clientes`, `/corretores` — adicionar botão contextual "Exportar Excel" no header
- Route `/[slug]/corretores/[id]` — destino do redirect de corretor no dashboard

</code_context>

<specifics>
## Specific Ideas

- Dashboard executivo cobre admin e financeiro com o mesmo conteúdo — sem bifurcação de UI entre os dois roles
- Corretor vai direto para sua página pessoal (Phase 4) em vez de ver um resumo duplicado
- Export é contextual (está no lugar certo da listagem), não centralizado numa página de relatórios — mais simples e mais natural para o usuário

</specifics>

<deferred>
## Deferred Ideas

- **Gráficos (Recharts)** — linha de receita por mês, barras por produto — pode entrar numa iteração futura se o usuário sentir necessidade após ver o dashboard em produção
- **PDF** — relatórios formais impressos; DASH-04 menciona, mas v1 entrega só Excel
- **Página /relatórios centralizada** — seletor de tipo + filtros + múltiplas abas no xlsx — mais poderosa, fica para uma sub-phase futura
- **Supabase Realtime** — alertas push sem refresh de página — pode entrar na Phase 7 (automações) se necessário

</deferred>

---

*Phase: 06-dashboards-relatorios*
*Context gathered: 2026-04-30*

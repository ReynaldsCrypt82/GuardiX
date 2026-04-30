# Phase 6: Dashboards & Relatorios - Research

**Researched:** 2026-04-30
**Domain:** Dashboard executivo Next.js App Router + exportacao Excel server-side
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Visualizacao **somente stat cards + tabelas** — sem Recharts, sem graficos. Recharts nao sera instalado nesta phase.
- **D-02:** Dashboard executivo tem **4 stat cards** no topo (com MonthSelector URL-driven):
  - "Apolices ativas" — count de policies com status `active` do tenant
  - "Receita do periodo" — soma de `financial_entries` (receivable + paid) no mes selecionado
  - "Inadimplencia" — soma de `financial_entries` (receivable + pending + due_date < hoje) do tenant
  - "Vencendo em 30 dias" — count de policies com `end_date BETWEEN hoje e hoje+30`
- **D-03:** **MonthSelector** reutilizado de `src/components/corretores/month-selector.tsx` — URL-driven `?month=YYYY-MM`. Controla os cards de Receita e Inadimplencia (nao Apolices ativas nem Vencendo 30d).
- **D-04:** **Ranking de corretores** = tabela com colunas: Corretor, Producao do mes (count apolices/cotas), Comissao do mes (R$). Filtravel pelo MonthSelector.
- **D-05:** Alertas **estaticos no page load** — 3 listas: Apolices vencendo 30d (max 5), Cobranças em atraso (max 5), Assembleias proximas 7d (max 5). Cada lista com contagem total + link "Ver todos".
- **D-06:** Formato **Excel (.xlsx) apenas** — PDF fora do escopo.
- **D-07:** **3 exportacoes contextuais separadas** em listagens existentes: `/seguros`, `/clientes`, `/corretores`.
- **D-08:** Export **respeita filtros ativos** na tela — passa searchParams como query params para o handler de exportacao.
- **D-09:** Rota `/[slug]/dashboard` diferenciada por role: `admin`/`financeiro` → dashboard executivo; `corretor` → redirect para `/[slug]/corretores/[id]`; `visualizador` → `notFound()`.
- **D-10:** Role `financeiro` ve o **mesmo conteudo executivo que admin**.

### Claude's Discretion

- Biblioteca Excel: `xlsx` (SheetJS community edition) ou `exceljs` — decisao do planner baseado em bundle size e server-side compatibility com Next.js App Router
- Mecanismo de download: Route Handler (`/api/export/[type]`) ou Server Action retornando stream
- Layout de alertas: cards ou lista simples — manter consistencia com shadcn/ui e padrao visual das phases anteriores

### Deferred Ideas (OUT OF SCOPE)

- Graficos (Recharts) — linha de receita por mes, barras por produto
- PDF — relatorios formais impressos
- Pagina /relatorios centralizada
- Supabase Realtime — alertas push sem refresh
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Admin visualiza KPIs executivos: receita do periodo, total de apolices ativas, inadimplencia e vencimentos proximos | 4 stat cards com queries identificadas em `financial_entries` e `policies`. Pattern StatCard ja existe em `src/components/corretores/stat-card.tsx`. |
| DASH-02 | Admin visualiza ranking de producao e comissao por corretor no periodo | Query em `commission_entries` agrupada por broker_id + join com `profiles`. Tabela shadcn/ui ja disponivel. MonthSelector ja existe. |
| DASH-03 | Sistema exibe alertas visuais: apolices vencendo, cobranças em atraso, assembleias proximas | 3 queries paralelas em `policies`, `financial_entries`, `consortium_groups`. Pattern identico ao usado em `[slug]/layout.tsx` com try/catch graceful. |
| DASH-04 | Usuario pode exportar relatorios de apolices, clientes e comissoes em Excel | Route Handler `/api/[slug]/export/route.ts` com exceljs. Botao client-side `fetch` + `createObjectURL`. 3 tipos de export com filtros dos searchParams. |
</phase_requirements>

---

## Summary

A Phase 6 entrega duas capacidades independentes: (1) a pagina `/[slug]/dashboard` com KPIs executivos, ranking de corretores e alertas estaticos de itens criticos; e (2) tres botoes "Exportar Excel" contextuais nas listagens existentes de `/seguros`, `/clientes` e `/corretores`.

Toda a infraestrutura de UI esta disponivel no projeto — `StatCard`, `MonthSelector`, componentes de tabela shadcn/ui, patterns de RBAC com `notFound()`/`redirect()` — e nao requer nenhuma instalacao nova de componente. O unico pacote novo a instalar e a biblioteca de geracao de Excel.

A decisao critica de infraestrutura e: qual biblioteca Excel instalar e como servir o arquivo. A pesquisa identificou que `xlsx` (SheetJS) na versao publicada no npm publico (0.18.5) tem vulnerabilidades de seguranca conhecidas (CVE-2023-30533) e status de manutencao inativo. **`exceljs` 4.4.0 e a escolha correta** para este projeto, apesar de dependencias transitivas com vulnerabilidades menores — nenhuma critica para uso server-side em geracao de arquivos com dados internos. O mecanismo de download deve ser um **Route Handler** (nao Server Action) porque Server Actions nao suportam retorno de stream/blob.

**Recomendacao primaria:** Instalar `exceljs` 4.4.0. Implementar Route Handler em `/api/[slug]/export/route.ts` com query param `?type=apolices|clientes|comissoes` e filtros adicionais passados via searchParams. Botao no cliente faz `fetch` + `createObjectURL` para disparar o download sem navegar.

---

## Standard Stack

### Core (pre-existente — nao requer instalacao)

| Componente | Localizacao | Uso nesta phase |
|-----------|-------------|-----------------|
| `StatCard` | `src/components/corretores/stat-card.tsx` | 4 KPI cards do dashboard executivo |
| `MonthSelector` | `src/components/corretores/month-selector.tsx` | Seletor de mes URL-driven |
| `Table/TableRow/TableCell` | `src/components/ui/table.tsx` | Tabela de ranking de corretores |
| `Card/CardHeader/CardContent` | `src/components/ui/card.tsx` | Cards de alertas |
| `Badge` | `src/components/ui/badge.tsx` | Status nos alertas |
| `Button` | `src/components/ui/button.tsx` | Botao "Exportar Excel" |
| `date-fns` (v4 instalado) | `package.json` | format, parse, startOfMonth, endOfMonth, addDays |
| `Intl.NumberFormat` | nativo | Formatacao BRL (padrao do projeto) |

[VERIFIED: codebase grep — todos os componentes existem e estao em uso nas phases 4 e 5]

### Novo Pacote

| Biblioteca | Versao | Proposito | Por que este |
|-----------|--------|-----------|--------------|
| `exceljs` | 4.4.0 | Geracao de arquivos .xlsx server-side | xlsx@0.18.5 no npm tem CVE-2023-30533 (prototype pollution) e status inativo. exceljs 4.4.0 gera buffer via `workbook.xlsx.writeBuffer()`, API fluente, ativo em dezembro 2024. Dependencias transitivas com minor issues (nao criticas para server-side write-only). |

[VERIFIED: npm registry — exceljs@4.4.0 publicado 2024-12-20, xlsx@0.18.5 publicado 2024-10-22 com vulnerabilidades conhecidas]

**Instalacao:**
```bash
npm install exceljs
```

**Verificacao de versao:**
```
exceljs: 4.4.0 (verificado no npm registry em 2026-04-30)
xlsx (npm publico): 0.18.5 — NAO USAR (CVE-2023-30533)
```

---

## Architecture Patterns

### Estrutura de arquivos desta phase

```
src/
├── app/
│   ├── (app)/[slug]/
│   │   ├── dashboard/
│   │   │   └── page.tsx              # substituir placeholder — Server Component
│   │   ├── seguros/
│   │   │   └── page.tsx              # adicionar botao Exportar Excel
│   │   ├── clientes/
│   │   │   └── page.tsx              # adicionar botao Exportar Excel
│   │   └── corretores/
│   │       └── page.tsx              # adicionar botao Exportar Excel
│   └── api/
│       └── [slug]/
│           └── export/
│               └── route.ts          # Route Handler — GET com ?type=&filters
├── components/
│   ├── dashboard/
│   │   ├── alert-section.tsx         # seção "Alertas" com 3 listas
│   │   └── broker-ranking-table.tsx  # tabela de ranking
│   └── export/
│       └── export-button.tsx         # Client Component — fetch + createObjectURL
```

### Padrao 1: Dashboard Page com RBAC + MonthSelector

**O que e:** Server Component async que lida com 3 branches de role antes de renderizar qualquer dado.

**Quando usar:** Toda rota com comportamento diferenciado por role.

**Exemplo (baseado no padrao financeiro/page.tsx ja estabelecido):**
```typescript
// Source: src/app/(app)/[slug]/financeiro/page.tsx (Phase 5, padrao existente)
export default async function DashboardPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams
  const supabase = (await createClient()) as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const role = (user.app_metadata as { role?: string })?.role ?? ''

  // D-09: RBAC — corretor redireciona, visualizador = notFound
  if (role === 'corretor') redirect(`/${slug}/corretores/${user.id}`)
  if (role === 'visualizador') notFound()
  // admin e financeiro continuam (D-10: mesmo conteudo)

  // MonthSelector: parse YYYY-MM de searchParams, default = mes corrente
  const today = new Date()
  const selectedMonthStart = sp.month
    ? parse(sp.month + '-01', 'yyyy-MM-dd', today)
    : startOfMonth(today)
  const monthStartStr = format(startOfMonth(selectedMonthStart), 'yyyy-MM-dd')
  const monthEndStr = format(endOfMonth(selectedMonthStart), 'yyyy-MM-dd')
  const monthValue = format(selectedMonthStart, 'yyyy-MM')
  // ...queries...
}
```

### Padrao 2: Queries dos 4 KPI Cards

**O que e:** 4 queries paralelas com try/catch graceful (padrao estabelecido na Phase 3 e 5).

```typescript
// Source: padrao estabelecido em [slug]/layout.tsx e financeiro/page.tsx
const todayStr = format(startOfToday(), 'yyyy-MM-dd')
const thirtyDaysLaterStr = format(addDays(startOfToday(), 30), 'yyyy-MM-dd')

const [activePolicies, receita, inadimplencia, vencendo] = await Promise.all([
  // D-02a: Apolices ativas — status active, sem filtro de mes (atemporal)
  supabase
    .from('policies')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')  // VERIFICAR: campo exato na tabela policies
    .is('deleted_at', null),

  // D-02b: Receita do periodo — receivable + paid no mes selecionado
  supabase
    .from('financial_entries')
    .select('amount')
    .is('deleted_at', null)
    .eq('entry_type', 'receivable')
    .eq('status', 'paid')
    .gte('paid_at', monthStartStr)
    .lte('paid_at', monthEndStr + 'T23:59:59'),

  // D-02c: Inadimplencia — receivable + pending + vencido (< hoje)
  supabase
    .from('financial_entries')
    .select('amount')
    .is('deleted_at', null)
    .eq('entry_type', 'receivable')
    .eq('status', 'pending')
    .lt('due_date', todayStr),

  // D-02d: Vencendo em 30 dias — policies com end_date entre hoje e hoje+30
  supabase
    .from('policies')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .gte('vigencia_fim', todayStr)
    .lte('vigencia_fim', thirtyDaysLaterStr),
])
```

**PITFALL CRITICO — Receita do periodo:** A query de receita deve filtrar por `paid_at` (data de pagamento real), nao por `due_date`. Entradas com `status='paid'` tem `paid_at` preenchido. Se filtrar por `due_date` no mes selecionado, inclui entradas ainda nao pagas do periodo, distorcendo a receita realizada. [VERIFIED: schema financeiro_schema.sql — campo `paid_at TIMESTAMPTZ` existe]

**ALTERNATIVA para Receita:** Se o usuario quiser "a receber no periodo" (nao "receita realizada"), filtrar por `entry_type='receivable'` + `gte/lte due_date` + `status IN ('pending','paid')`. A decisao semantica do card "Receita do periodo" deve ser esclarecida — a pesquisa recomenda `paid_at` para receita realizada. [ASSUMED] — sem confirmacao explicita do usuario sobre a semantica exata de "Receita do periodo".

### Padrao 3: Query Ranking de Corretores (D-04)

**O que e:** Agrupamento de `commission_entries` por `broker_id` + `profiles.full_name` para o mes selecionado, com contagem de apolices/cotas como "Producao".

```typescript
// Source: padrao estabelecido em corretores/[id]/page.tsx (Phase 4)

// Corretores do tenant (RLS limita ao tenant automaticamente)
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, full_name')
  .eq('role', 'corretor')
  .order('full_name')

const profileIds = (profiles ?? []).map((p: { id: string }) => p.id)

// Comissao do mes por corretor
const { data: commissionRows } = await supabase
  .from('commission_entries')
  .select('broker_id, amount')
  .in('broker_id', profileIds)
  .eq('reference_month', monthStartStr)  // DATE = primeiro dia do mes

// Producao do mes: count de policies criadas no mes
const { data: prodRows } = await supabase
  .from('policies')
  .select('assigned_to')
  .in('assigned_to', profileIds)
  .gte('created_at', monthStartStr)
  .lte('created_at', monthEndStr + 'T23:59:59')
  .is('deleted_at', null)

// Montar ranking: agregar em Map, ordenar por comissao desc
```

**PITFALL:** `reference_month` em `commission_entries` e do tipo DATE (nao TEXT) e armazena o primeiro dia do mes (ex: `2026-04-01`). Deve ser passado como string ISO `'2026-04-01'`, nao `'2026-04'`. [VERIFIED: corretores_schema.sql — `reference_month DATE NOT NULL`]

### Padrao 4: Alertas Estaticos (D-05)

**O que e:** 3 queries paralelas com `limit(5)` mais uma contagem total para o "Ver todos".

```typescript
// Source: padrao de [slug]/layout.tsx (alertas existentes em try/catch)
const todayStr = format(startOfToday(), 'yyyy-MM-dd')
const thirtyDaysLater = format(addDays(startOfToday(), 30), 'yyyy-MM-dd')
const sevenDaysLater = format(addDays(startOfToday(), 7), 'yyyy-MM-dd')

const [vencendoPolicies, cobrancasAtraso, assembleias] = await Promise.all([
  // Apolices vencendo em 30d — max 5 com link
  supabase
    .from('policies')
    .select('id, policy_number, vigencia_fim, client:clients(name)', { count: 'exact' })
    .is('deleted_at', null)
    .gte('vigencia_fim', todayStr)
    .lte('vigencia_fim', thirtyDaysLater)
    .order('vigencia_fim', { ascending: true })
    .limit(5),

  // Cobranças em atraso — receivable + pending + vencida
  supabase
    .from('financial_entries')
    .select('id, description, amount, due_date, client_id', { count: 'exact' })
    .is('deleted_at', null)
    .eq('entry_type', 'receivable')
    .eq('status', 'pending')
    .lt('due_date', todayStr)
    .order('due_date', { ascending: true })
    .limit(5),

  // Assembleias proximas 7d
  supabase
    .from('consortium_groups')
    .select('id, administrator, next_assembly_date', { count: 'exact' })
    .is('deleted_at', null)
    .not('next_assembly_date', 'is', null)
    .gte('next_assembly_date', todayStr)
    .lte('next_assembly_date', sevenDaysLater)
    .order('next_assembly_date', { ascending: true })
    .limit(5),
])
```

### Padrao 5: Route Handler de Export + Client Button

**O que e:** Route Handler GET que recebe `?type=` e filtros, gera buffer com exceljs, retorna como Response com headers de download. Client Component faz fetch e aciona download via createObjectURL.

**Route Handler (`/api/[slug]/export/route.ts`):**
```typescript
// Source: padrao Next.js App Router Route Handler — verified via codeconcisely.com
import ExcelJS from 'exceljs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') // 'apolices' | 'clientes' | 'comissoes'

  // Autenticar via Supabase SSR (cookies disponíveis no Route Handler)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // RBAC: apenas admin e financeiro exportam
  const role = (user.app_metadata as { role?: string })?.role
  if (!['admin', 'financeiro'].includes(role ?? '')) {
    return new Response('Forbidden', { status: 403 })
  }

  // ... query dados baseado em type e filtros ...

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Dados')
  sheet.columns = [/* colunas */]
  sheet.addRows(/* dados */)

  const buffer = await workbook.xlsx.writeBuffer()

  return new Response(buffer, {
    headers: {
      'Content-Disposition': `attachment; filename="${type}-${slug}.xlsx"`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  })
}
```

**Client Component Export Button:**
```typescript
// Source: padrao fetch + createObjectURL — verified via codeconcisely.com
'use client'
export function ExportButton({ href, label }: { href: string; label: string }) {
  async function handleExport() {
    const res = await fetch(href)
    if (!res.ok) return
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = href.split('filename=')[1] ?? 'export.xlsx'
    a.click()
    window.URL.revokeObjectURL(url)
  }
  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      {label}
    </Button>
  )
}
```

**ALTERNATIVA mais simples:** `<a href={exportUrl} download>Exportar Excel</a>` com link direto para o Route Handler. Funciona se o Route Handler retornar `Content-Disposition: attachment`. Mais simples, sem JS, mas menos controle sobre estado de loading. Recomendado para v1.

### Padrao 6: Filtros de Export via searchParams (D-08)

O botao de export nas listagens deve construir a URL do Route Handler repassando os searchParams ativos:

```typescript
// Em seguros/page.tsx — construir href do export com filtros
const exportParams = new URLSearchParams()
exportParams.set('type', 'apolices')
if (sp.type) exportParams.set('type_filter', sp.type)
if (sp.insurer) exportParams.set('insurer', sp.insurer)
if (sp.status) exportParams.set('status', sp.status)
const exportHref = `/api/${slug}/export?${exportParams.toString()}`
```

### Anti-Patterns a Evitar

- **Server Action para download de arquivo:** Server Actions serializam retornos como JSON — nao suportam binary streams. Use Route Handler com `new Response(buffer, { headers })`. [VERIFIED: discussao vercel/next.js #61683]
- **xlsx@0.18.5 do npm publico:** Tem CVE-2023-30533 (prototype pollution via arquivo malicioso). Como os exports sao gerados a partir de dados do banco (nao de arquivos de upload), o risco e menor, mas o pacote esta inativo — usar exceljs. [VERIFIED: snyk.io + sheetjs issue tracker]
- **Filtrar receita por due_date em vez de paid_at:** Distorce a receita realizada. Usar `paid_at` para contar receita do periodo. [VERIFIED: schema financeiro]
- **reference_month como string YYYY-MM:** O campo e DATE no PostgreSQL — passar `'2026-04-01'` (primeiro dia do mes), nao `'2026-04'`. [VERIFIED: corretores_schema.sql]
- **notFound() para corretor no dashboard:** O padrao do projeto e `redirect()` para corretor (D-09), nao `notFound()`. O `notFound()` e para `visualizador`. Ver financeiro/page.tsx para o padrao `notFound()` e corretores/page.tsx para o padrao `redirect()`.

---

## Don't Hand-Roll

| Problema | Nao Construir | Usar em vez | Por que |
|---------|---------------|-------------|---------|
| Geracao de arquivo .xlsx | Parser/writer manual de ZIP+XML | `exceljs` 4.4.0 | .xlsx e um ZIP com XML interno — exceljs lida com encoding, estilos, tipos de celula, cabecalhos. |
| Download de arquivo no browser | `<iframe>`, form POST ou workarounds | `<a href download>` ou `fetch + createObjectURL` | Web API nativa — zero dependencia adicional |
| Formatacao de moeda BRL | Biblioteca externa | `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` | API nativa, ja usada em corretores/[id]/page.tsx e financeiro/page.tsx |
| Agrupamento de comissoes por corretor | Reducao manual com Map | Map.set + reduce sobre array | Ja estabelecido no projeto em corretores/page.tsx (productionMap) |

---

## Common Pitfalls

### Pitfall 1: Status de "Apolice ativa" — campo correto na tabela policies

**O que da errado:** A tabela `policies` nao tem um campo `status` simples com valor `'active'`. O status e calculado dinamicamente via `vigencia_fim` (veja `src/lib/utils/vigencia.ts` — getVigenciaStatus). Uma apolice "ativa" e aquela com `vigencia_fim >= hoje` e `deleted_at IS NULL`.

**Como evitar:** Para o card "Apolices ativas", usar:
```sql
-- "Ativas" = nao deletadas e vigencia_fim >= hoje
.is('deleted_at', null)
.gte('vigencia_fim', todayStr)
```
Nao existe `status = 'active'` na tabela — o status e derivado da data.

[VERIFIED: supabase/migrations/20260420_0011_seguros_schema.sql — sem campo status em policies]

### Pitfall 2: reference_month em commission_entries e DATE (primeiro dia do mes)

**O que da errado:** Passar `'2026-04'` como value para filtrar `reference_month` causa zero resultados — o campo e DATE e armazena `'2026-04-01'`.

**Como evitar:** Sempre converter: `const referenceMonth = format(startOfMonth(selectedMonthStart), 'yyyy-MM-dd')`. Padrao identico ao de corretores/[id]/page.tsx.

[VERIFIED: corretores_schema.sql linha 76 + corretores/[id]/page.tsx linha 45]

### Pitfall 3: paid_at vs due_date para "Receita do periodo"

**O que da errado:** Filtrar `financial_entries` por `due_date` entre inicio e fim do mes conta entradas que vencem no periodo, nao as que foram pagas. "Receita" semanticamente e o que foi pago (status=paid), nao o que vence.

**Como evitar:** Usar `.eq('status', 'paid').gte('paid_at', monthStartStr).lte('paid_at', monthEndStr + 'T23:59:59')`.

Observacao: Se o usuario quiser "a receber no periodo" (fluxo de caixa previsto), a query e diferente. A semantica deve ser verificada na implementacao.

[VERIFIED: schema — `paid_at TIMESTAMPTZ` existe em financial_entries]

### Pitfall 4: Route Handler precisa de autenticacao Supabase via cookies

**O que da errado:** Route Handlers no App Router nao recebem automaticamente a sessao do usuario como Server Components. E necessario criar o cliente Supabase com `createClient()` (que usa cookies) dentro do handler.

**Como evitar:** Usar o mesmo `createClient` de `@/lib/supabase/server` no Route Handler. Os cookies do request sao acessiveis via `cookies()` do Next.js dentro do Route Handler.

[VERIFIED: padrao estabelecido no projeto — mesma lib usada em Server Components e Server Actions]

### Pitfall 5: Export button como link simples vs Client Component

**O que da errado:** Um `<Button>` do shadcn/ui nao funciona como link de download por padrao. Se usar `<Button asChild><Link href="...">` para o Route Handler, o Next.js pode interceptar o link como navegacao interna (client-side routing), nao como download de arquivo.

**Como evitar:** Usar `<a href={exportHref} download>` (nao `<Link>`) ou um Client Component com `fetch + createObjectURL`. Para v1, `<a>` simples com o header `Content-Disposition: attachment` no Route Handler e suficiente e mais simples.

[VERIFIED: comportamento Next.js App Router — `<Link>` e para rotas internas, `<a>` e para downloads externos/arquivos]

### Pitfall 6: Export sem validacao de slug no Route Handler

**O que da errado:** O Route Handler recebe `slug` como parametro dinamico. Sem verificar que o usuario logado pertence ao tenant com aquele slug, um usuario poderia tentar acessar `/api/outro-slug/export`.

**Como evitar:** No Route Handler, verificar `user.app_metadata.slug === slug` antes de executar qualquer query. RLS ja garante isolamento no banco, mas a verificacao explicita evita tentativas de enumeracao.

[VERIFIED: padrao de seguranca estabelecido em [slug]/layout.tsx — verificacao de slug vs app_metadata.slug]

---

## Code Examples

### exceljs: Gerar buffer de apolices
```typescript
// Source: exceljs npm docs (v4.4.0) + Node.js Download Excel file example (bezkoder.com)
import ExcelJS from 'exceljs'

async function generateApolicesXlsx(policies: PolicyRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'NEXUS AGENT'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Apolices')

  sheet.columns = [
    { header: 'Numero', key: 'policy_number', width: 20 },
    { header: 'Tipo', key: 'type', width: 15 },
    { header: 'Seguradora', key: 'insurer', width: 25 },
    { header: 'Vigencia Fim', key: 'vigencia_fim', width: 15 },
    { header: 'Premio Total', key: 'premio_total', width: 15 },
    { header: 'Cliente', key: 'client_name', width: 30 },
    { header: 'Corretor', key: 'corretor_name', width: 25 },
  ]

  // Cabecalho em negrito
  sheet.getRow(1).font = { bold: true }

  for (const p of policies) {
    sheet.addRow({
      policy_number: p.policy_number,
      type: p.type,
      insurer: p.insurer,
      vigencia_fim: p.vigencia_fim,
      premio_total: Number(p.premio_total),
      client_name: p.client?.name ?? '',
      corretor_name: p.profile?.full_name ?? '',
    })
  }

  // Buffer como ArrayBuffer (compativel com Response)
  return Buffer.from(await workbook.xlsx.writeBuffer())
}
```

### Route Handler completo (estrutura)
```typescript
// Source: padrao Next.js App Router + codeconcisely.com
// app/api/[slug]/export/route.ts
import { createClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? ''

  const ALLOWED_TYPES = ['apolices', 'clientes', 'comissoes']
  if (!ALLOWED_TYPES.includes(type)) {
    return new Response('Invalid type', { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Verificar que usuario pertence ao slug (seguranca por profundidade)
  const meta = user.app_metadata as { slug?: string; role?: string }
  if (meta.slug !== slug) return new Response('Forbidden', { status: 403 })
  if (!['admin', 'financeiro'].includes(meta.role ?? '')) {
    return new Response('Forbidden', { status: 403 })
  }

  // ... gerar workbook baseado em type ...

  const buffer = await workbook.xlsx.writeBuffer()

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${type}-export.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
```

---

## State of the Art

| Abordagem Anterior | Abordagem Atual | Impacto |
|--------------------|-----------------|---------|
| SheetJS/xlsx como padrao para Excel em JS | SheetJS 0.18.5 inativo no npm — exceljs e a alternativa ativa | Instalar exceljs, nao xlsx |
| Server Actions para tudo em Next.js App Router | Route Handlers para respostas binarias (streams, arquivos) | Export usa Route Handler, nao Server Action |
| PDF + Excel como formatos de export | Excel (.xlsx) apenas em v1 | Sem dependencia de lib PDF nesta phase |

---

## Assumptions Log

| # | Claim | Section | Risk se errado |
|---|-------|---------|----------------|
| A1 | "Receita do periodo" = entradas do tipo `receivable` com `status='paid'` filtradas por `paid_at` | Padrao 2 / Pitfall 3 | Se o usuario quiser "a receber previsto" (due_date), a query muda — card mostraria valor diferente do esperado |
| A2 | O campo para filtrar "apolice ativa" e `vigencia_fim >= hoje AND deleted_at IS NULL` (nao ha campo status na tabela) | Pitfall 1 | Se houver campo status que nao aparece na migration consultada, a query seria desnecessariamente complexa |

---

## Open Questions

1. **Semantica exata de "Receita do periodo" (D-02)**
   - O que sabemos: `financial_entries` tem `status` (pending/paid/cancelled), `due_date` e `paid_at`
   - O que e ambiguo: "Receita" = entradas pagas no mes (filtro em `paid_at`) OU entradas previstas no mes (filtro em `due_date`)?
   - Recomendacao: Implementar com `paid_at` (receita realizada). Se o usuario quiser fluxo previsto, ajustar na implementacao.

2. **Limite de linhas no export**
   - O que sabemos: Listagens tem paginacao (PAGE_SIZE=25). Export nao tem paginacao — exporta tudo que casa com o filtro.
   - O que e ambiguo: Para tenants com muitas apolices (ate 10.000 por tenant — limite do roadmap), o export pode ser lento.
   - Recomendacao: Nao adicionar limite em v1 (planner ja aceita isso). Documentar na implementacao que pode ser lento para tenants grandes.

---

## Environment Availability

| Dependencia | Requerida por | Disponivel | Versao | Fallback |
|-------------|--------------|-----------|--------|---------|
| Node.js | exceljs server-side | sim | verificado pelo projeto (Next.js 15 rodando) | — |
| npm/package.json | instalacao exceljs | sim | package.json existe | — |
| `exceljs` | Route Handler de export | NAO (nao instalado) | — | Instalar: `npm install exceljs` |
| Supabase `createClient` (SSR) | Route Handler auth | sim | @supabase/ssr em package.json | — |

**Dependencias faltantes sem fallback:**
- `exceljs` — requer instalacao antes de qualquer tarefa de export

---

## Validation Architecture

### Test Framework

| Propriedade | Valor |
|-------------|-------|
| Framework | Vitest 2.1.9 |
| Config file | `vitest.config.ts` (raiz do projeto) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Comportamento | Tipo | Comando Automatizado | Arquivo existe? |
|--------|--------------|------|---------------------|-----------------|
| DASH-01 | KPI cards mostram valores corretos por tenant | unit | `vitest run tests/utils/dashboard-queries.test.ts` | NAO — criar em Wave 0 |
| DASH-02 | Ranking de corretores agrega comissoes + producao corretamente | unit | `vitest run tests/utils/dashboard-queries.test.ts` | NAO — criar em Wave 0 |
| DASH-03 | Alertas retornam max 5 itens por categoria | unit | `vitest run tests/utils/dashboard-queries.test.ts` | NAO — criar em Wave 0 |
| DASH-04 | Route Handler de export retorna buffer com Content-Type correto | integration | manual (requer ambiente Supabase real) | NAO |
| DASH-09 | RBAC: corretor e redirecionado, visualizador recebe 404 | unit | `vitest run tests/utils/dashboard-queries.test.ts` | NAO — criar em Wave 0 |

### Sampling Rate

- **Por commit:** `npm test` (suite completa, rapida)
- **Por wave merge:** `npm test`
- **Phase gate:** Suite completa verde antes de `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/utils/dashboard-queries.test.ts` — testes de logica de agrupamento, formatacao e RBAC (mock Supabase)
- [ ] Sem gaps de framework — Vitest ja esta configurado com mocks de `next/headers` e `next/navigation`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Aplica | Controle Padrao |
|---------------|--------|-----------------|
| V2 Authentication | sim | Supabase Auth + `createClient()` no Route Handler |
| V4 Access Control | sim | RBAC: role check antes de qualquer query; slug check no Route Handler |
| V5 Input Validation | sim | Whitelist de `type` no Route Handler; whitelist de filtros herdados das listagens |
| V6 Cryptography | nao | Nao aplicavel (sem criptografia customizada) |

### Known Threat Patterns

| Padrao | STRIDE | Mitigacao Padrao |
|--------|--------|-----------------|
| Acesso cross-tenant via export | Tampering / Information Disclosure | Verificar `user.app_metadata.slug === slug` no Route Handler ANTES da query; RLS e segunda camada |
| Exportar dados de outro role | Elevation of Privilege | RBAC check explicito: `['admin','financeiro'].includes(role)` |
| Parametro `type` invalido | Tampering | Whitelist: `ALLOWED_TYPES = ['apolices','clientes','comissoes']`, retornar 400 se invalido |
| Filtros injetados via searchParams | Tampering | Herdar o mesmo whitelist das listagens existentes (ja implementado em seguros/page.tsx — ALLOWED_TYPES, ALLOWED_STATUSES) |

---

## Sources

### Primary (HIGH confidence)
- Codebase (VERIFIED): `src/app/(app)/[slug]/financeiro/page.tsx` — padrao RBAC + MonthSelector + StatCard
- Codebase (VERIFIED): `src/app/(app)/[slug]/corretores/[id]/page.tsx` — padrao stat cards + MonthSelector + commission_entries query
- Codebase (VERIFIED): `src/app/(app)/[slug]/corretores/page.tsx` — padrao redirect para corretor
- Codebase (VERIFIED): `src/components/corretores/month-selector.tsx` — componente a reutilizar
- Codebase (VERIFIED): `src/components/auth/sidebar-shell.tsx` — padrao spread condicional + item Dashboard ja existe
- Codebase (VERIFIED): `supabase/migrations/20260420_0011_seguros_schema.sql` — tabela policies (sem campo status)
- Codebase (VERIFIED): `supabase/migrations/20260420_0016_corretores_schema.sql` — commission_entries + reference_month DATE
- Codebase (VERIFIED): `supabase/migrations/20260420_0019_financeiro_schema.sql` — financial_entries + paid_at TIMESTAMPTZ
- npm registry (VERIFIED): exceljs@4.4.0 publicado 2024-12-20; xlsx@0.18.5 publicado 2024-10-22

### Secondary (MEDIUM confidence)
- [How to Download xlsx Files from a Next.js Route Handler (Dave Gray)](https://www.davegray.codes/posts/how-to-download-xlsx-files-from-a-nextjs-route-handler) — Route Handler pattern com `new Response(buffer, { headers })`
- [Download a File From App Router API in Next.js (Code Concisely)](https://www.codeconcisely.com/posts/nextjs-app-router-api-download-file/) — fetch + createObjectURL client-side pattern
- [Node.js Download Excel file example with exceljs (BezKoder)](https://www.bezkoder.com/node-js-download-excel-file/) — exceljs writeBuffer example

### Tertiary (LOW confidence — flags para validacao)
- [SheetJS CVE-2023-30533 vulnerability report (Snyk)](https://security.snyk.io/package/npm/xlsx/0.18.5) — vulnerabilidade no xlsx@0.18.5

---

## Metadata

**Confidence breakdown:**
- Standard stack (componentes reutilizados): HIGH — todos verificados no codebase
- Biblioteca Excel (exceljs): HIGH — versao verificada no npm registry, vulnerabilidades do xlsx verificadas
- Architecture (Route Handler para download): HIGH — padrao Next.js confirmado por docs e exemplos
- Queries Supabase (DASH-01/02/03): MEDIUM — schema verificado, logica de query baseada em patterns existentes no projeto, semantica de "receita" marcada como ASSUMED
- Pitfalls: HIGH — identificados via inspecao direta do schema e codigo existente

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stack estavel; exceljs e uma dependencia nova — verificar por updates de seguranca antes de usar em producao)

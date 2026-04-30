---
phase: 6
slug: dashboards-relatorios
status: draft
shadcn_initialized: true
preset: "new-york / neutral / cssVariables"
created: 2026-04-30
---

# Phase 6 — UI Design Contract

> Visual and interaction contract para dashboards executivos e exportação Excel.
> Gerado por gsd-ui-researcher. Validado por gsd-ui-checker.

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | shadcn/ui | components.json verificado |
| Style | new-york | components.json: `"style": "new-york"` |
| Base color | neutral | components.json: `"baseColor": "neutral"` |
| CSS variables | enabled | components.json: `"cssVariables": true` |
| Component library | Radix UI (via shadcn/ui) | components.json + ui/*.tsx existentes |
| Icon library | lucide-react | components.json: `"iconLibrary": "lucide"` |
| Font | System sans-serif (padrão Tailwind/shadcn) | globals.css — sem font customizada declarada |
| Radius | 0.625rem (10px) | globals.css: `--radius: 0.625rem` |

**shadcn Gate:** `components.json` encontrado. Design system já inicializado. Nenhuma ação de init necessária.

---

## Spacing Scale

Escala 8-point. Todos os valores são múltiplos de 4px. Padrão Tailwind/shadcn já em uso nas phases 3–5.

| Token | Value | Uso nesta phase |
|-------|-------|-----------------|
| xs | 4px (`gap-1`, `pb-1`) | Gap entre ícone e label em alertas; padding de badge |
| sm | 8px (`gap-2`, `p-2`) | Espaçamento interno de célula de tabela compacta |
| md | 16px (`gap-4`, `p-4`) | Gap entre stat cards; padding interno de Card |
| lg | 24px (`gap-6`, `p-6`) | Gap entre seções da página; padding da página (`p-6`) |
| xl | 32px (`gap-8`) | Separação entre bloco de KPIs e bloco de Alertas |
| 2xl | 48px | Separação entre bloco de Alertas e bloco de Ranking |
| 3xl | 64px | Não utilizado nesta phase |

**Exceções:** MonthSelector mantém altura mínima de toque 36px (padrão shadcn Button size="sm"). Botão "Exportar Excel" usa `size="sm"` (altura 32px) — adequado para ação secundária no header de listagem.

**Padrão de página estabelecido:** `<div className="flex flex-col gap-6 p-6">` — confirmado em dashboard/page.tsx existente e em financeiro/page.tsx.

---

## Typography

Fonte: sistema (Inter/sans-serif via Tailwind padrão). Sem instalação de fonte customizada.

| Role | Size | Weight | Line Height | Classe Tailwind | Uso nesta phase |
|------|------|--------|-------------|-----------------|-----------------|
| Body | 14px | 400 (regular) | 1.5 | `text-sm` | Conteúdo de listas de alertas, células de tabela, subtextos |
| Label | 12px | 400 (regular) | 1.5 | `text-xs` | Subtexto de stat cards (`subtext`), contagem de alertas, meta info |
| Heading | 16px | 600 (semibold) | 1.2 | `text-base font-semibold` | Título de seções ("Alertas", "Ranking de Corretores") |
| Display | 24px | 600 (semibold) | 1.2 | `text-2xl font-semibold` | Valor principal dos stat cards — padrão já em stat-card.tsx |

**Fonte de verdade:** `stat-card.tsx` linha 19: `text-2xl font-semibold` para valor; `text-sm font-semibold text-muted-foreground` para título do card. Este padrão é canônico e não deve ser alterado.

**Pesos usados: apenas 400 e 600.** Nenhum uso de 700 (bold) nesta phase.

---

## Color

Tokens CSS do shadcn/ui neutral em globals.css. Modo claro é o padrão; dark mode suportado via `.dark` class.

| Role | Token CSS | Valor (light) | Uso nesta phase |
|------|-----------|---------------|-----------------|
| Dominant (60%) | `--background` | `oklch(1 0 0)` = branco | Fundo da página, área de conteúdo principal |
| Secondary (30%) | `--card` / `--sidebar` | `oklch(1 0 0)` / `oklch(0.985 0 0)` | Cards de KPI, seções de alerta, sidebar de navegação |
| Muted surfaces | `--muted` | `oklch(0.97 0 0)` | Fundo de linhas alternadas na tabela de ranking |
| Accent (10%) | `--primary` | `oklch(0.205 0 0)` = neutro escuro | Reservado para: (1) link "Ver todos" nos alertas; (2) número de linha ativa no ranking (top corretor) |
| Destructive | `--destructive` | `oklch(0.577 0.245 27.325)` = vermelho | Não há ações destrutivas nesta phase. Usado apenas em badge de "Cobranças em atraso" para reforço visual de criticidade |
| Muted foreground | `--muted-foreground` | `oklch(0.556 0 0)` = cinza médio | Títulos de stat cards, meta info, data de vencimento em alertas |
| Border | `--border` | `oklch(0.922 0 0)` = cinza claro | Divisor entre seções de alerta, linhas da tabela |

**Accent reservado para:** links "Ver todos" nas seções de alerta (3 ocorrências) + indicador visual do 1º colocado no ranking de corretores. Não usar accent em botões genéricos, ícones informativos ou texto corrido.

**Semântica de badge de status nos alertas:**
- Apólices vencendo: `variant="outline"` com cor `text-amber-600` (amarelo — atenção)
- Cobranças em atraso: `variant="destructive"` (vermelho — crítico)
- Assembleias próximas: `variant="secondary"` (neutro — informativo)

---

## Componentes Existentes (reutilizar sem modificação)

| Componente | Arquivo | Uso nesta phase |
|-----------|---------|-----------------|
| `StatCard` | `src/components/corretores/stat-card.tsx` | 4 KPI cards no topo do dashboard |
| `MonthSelector` | `src/components/corretores/month-selector.tsx` | Seletor de mês URL-driven (`?month=YYYY-MM`) |
| `Card / CardHeader / CardContent / CardTitle` | `src/components/ui/card.tsx` | Container das 3 seções de alerta |
| `Table / TableHeader / TableBody / TableRow / TableHead / TableCell` | `src/components/ui/table.tsx` | Ranking de corretores |
| `Badge` | `src/components/ui/badge.tsx` | Status em listas de alerta |
| `Button` | `src/components/ui/button.tsx` | Botão "Exportar Excel" nas listagens (`variant="outline" size="sm"`) |
| `Separator` | `src/components/ui/separator.tsx` | Divisor visual entre seções do dashboard |

**Novos componentes a criar nesta phase:**

| Componente | Arquivo sugerido | Responsabilidade |
|-----------|-----------------|------------------|
| `AlertSection` | `src/components/dashboard/alert-section.tsx` | Server Component — 3 listas de alerta com contagem + link "Ver todos" |
| `BrokerRankingTable` | `src/components/dashboard/broker-ranking-table.tsx` | Server Component — tabela de ranking com colunas Corretor / Produção / Comissão |
| `ExportButton` | `src/components/export/export-button.tsx` | Client Component — `<a href={exportHref} download>` wrapping Button |

---

## Layout do Dashboard Executivo

```
/[slug]/dashboard (admin + financeiro)
┌─────────────────────────────────────────────────────────┐
│  Bem-vindo, {nome}                                       │
│  {MonthSelector} — controla Receita e Inadimplência     │
├─────────────────────────────────────────────────────────┤
│  [StatCard: Apólices ativas]  [StatCard: Receita]       │
│  [StatCard: Inadimplência]    [StatCard: Vencendo 30d]  │
│  grid-cols-2 lg:grid-cols-4 gap-4                       │
├─────────────────────────────────────────────────────────┤
│  Alertas                                                 │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────┐│
│  │ Apólices         │ │ Cobranças em     │ │Assembleias││
│  │ vencendo (N)     │ │ atraso (N)       │ │próximas(N)││
│  │ [lista 5 items]  │ │ [lista 5 items]  │ │[lista 5] ││
│  │ Ver todos →      │ │ Ver todos →      │ │Ver todos→││
│  └──────────────────┘ └──────────────────┘ └──────────┘│
│  grid-cols-1 md:grid-cols-3 gap-4                       │
├─────────────────────────────────────────────────────────┤
│  Ranking de Corretores — {mês selecionado}              │
│  [Table: Corretor | Produção (apolices/cotas) | Comissão│
├─────────────────────────────────────────────────────────┤
```

**Grid de KPI cards:** `grid gap-4 grid-cols-2 lg:grid-cols-4` — padrão das phases 4 e 5.

**Grid de alertas:** `grid gap-4 grid-cols-1 md:grid-cols-3` — 3 colunas em desktop, empilhado em mobile.

---

## Layout de Exportação (listagens existentes)

O botão "Exportar Excel" é adicionado no header das páginas `/seguros`, `/clientes` e `/corretores`. Posicionado à direita do header, ao lado do botão primário de ação existente.

```
┌─────────────────────────────────────────────────────────┐
│  Apólices             [Exportar Excel ↓]  [+ Nova]      │
│  N registros encontrados                                 │
├─────────────────────────────────────────────────────────┤
│  [Filtros]                                               │
├─────────────────────────────────────────────────────────┤
│  [Tabela de resultados]                                  │
└─────────────────────────────────────────────────────────┘
```

**Regra de posicionamento:** `ExportButton` sempre à esquerda do botão primário (CTA principal permanece à direita extremo).

---

## Copywriting Contract

| Element | Copy | Source |
|---------|------|--------|
| Título da página dashboard | "Painel Executivo" | Padrão — substitui placeholder "Bem-vindo" |
| Subtítulo do dashboard | "Visão consolidada da corretora." | Padrão |
| Label do MonthSelector | (componente existente — sem alteração) | CONTEXT.md D-03 |
| Título seção KPIs | (sem título de seção — cards falam por si) | Padrão das phases 4/5 |
| Stat card: apólices ativas | "Apólices ativas" | CONTEXT.md D-02 |
| Stat card: receita | "Receita do período" | CONTEXT.md D-02 |
| Stat card: inadimplência | "Inadimplência" | CONTEXT.md D-02 |
| Stat card: vencendo 30d | "Vencendo em 30 dias" | CONTEXT.md D-02 |
| Título seção alertas | "Alertas" | CONTEXT.md D-05 |
| Cabeçalho lista 1 | "Apólices vencendo" | CONTEXT.md D-05 |
| Cabeçalho lista 2 | "Cobranças em atraso" | CONTEXT.md D-05 |
| Cabeçalho lista 3 | "Assembleias próximas" | CONTEXT.md D-05 |
| Link "ver todos" alerta 1 | "Ver todas as apólices →" | Padrão |
| Link "ver todos" alerta 2 | "Ver lançamentos →" | Padrão |
| Link "ver todos" alerta 3 | "Ver grupos de consórcio →" | Padrão |
| Título seção ranking | "Ranking de Corretores" | CONTEXT.md D-04 |
| Coluna ranking 1 | "Corretor" | CONTEXT.md D-04 |
| Coluna ranking 2 | "Produção do mês" | CONTEXT.md D-04 |
| Coluna ranking 3 | "Comissão (R$)" | CONTEXT.md D-04 |
| Botão exportar (seguros) | "Exportar Excel" | CONTEXT.md D-07 |
| Botão exportar (clientes) | "Exportar Excel" | CONTEXT.md D-07 |
| Botão exportar (corretores) | "Exportar Excel" | CONTEXT.md D-07 |
| Empty state: dashboard sem dados | "Nenhum dado disponível para o período selecionado." | Padrão |
| Empty state: ranking vazio | "Nenhum corretor com produção neste período." | Padrão |
| Empty state: alerta vazio | "Nenhum item." | Padrão (inline, sem ícone) |
| Error state: export falhou | "Falha ao gerar o arquivo. Tente novamente." | Padrão |
| Error state: dashboard query falhou | Cards exibem "—" (fallback graceful, sem mensagem de erro visível) | Padrão das phases 3–5 |

**Ações destrutivas nesta phase:** nenhuma. Nenhum modal de confirmação necessário.

---

## Interaction States

### Stat Cards
- **Loading:** Server Component — nenhum skeleton necessário em v1. Cards renderizam com dados reais via SSR.
- **Sem dados (count = 0):** exibe `"0"` ou `"R$ 0,00"` — nunca `"—"` para valores reais (reservar `"—"` apenas para placeholder).
- **Hover:** sem hover state (card não é clicável).

### Tabela de Ranking
- **Loading:** Server Component — sem skeleton.
- **Empty:** linha única com mensagem "Nenhum corretor com produção neste período."
- **Hover em linha:** `hover:bg-muted/50` — padrão shadcn Table.
- **Primeiro colocado:** sem destaque visual especial em v1 (sem badge de troféu).

### Seções de Alerta
- **Cada item da lista:** link clicável para a rota correspondente — `href` para o item específico.
- **Hover em item:** `hover:underline` ou `hover:text-primary` — padrão de link.
- **Sem dados:** exibe "Nenhum item." inline, sem ícone, sem card vazio grande.
- **Contagem total:** exibida no título do card entre parênteses: "Apólices vencendo (12)".

### Botão Exportar Excel
- **Default:** `<a href={exportHref} download>` wrapping `<Button variant="outline" size="sm">`. Acionamento via clique simples.
- **Loading:** sem estado de loading em v1 (link direto, o browser trata o download).
- **Erro (status 4xx/5xx do Route Handler):** sem tratamento visual em v1 — falha silenciosa ou toast de erro via Sonner se já instanciado na página.
- **Disabled:** não desabilitar o botão durante filtros ativos — o export reflete os filtros atuais.

### MonthSelector (reutilizado de corretores)
- Comportamento inalterado. Controla os cards de Receita e Inadimplência via URL `?month=YYYY-MM`.
- Posição: à direita do título "Painel Executivo", alinhado ao topo do header.

---

## RBAC Visual

| Role | Experiência no `/dashboard` |
|------|-----------------------------|
| `admin` | Dashboard executivo completo (4 KPIs + alertas + ranking) |
| `financeiro` | Dashboard executivo completo — idêntico ao admin (D-10) |
| `corretor` | `redirect()` para `/[slug]/corretores/[id]` — sem renderização |
| `visualizador` | `notFound()` — página 404 padrão do Next.js |

**Botão "Exportar Excel" nas listagens:** visível apenas para `admin` e `financeiro`. Para outros roles, o elemento não é renderizado no servidor.

---

## Registry Safety

| Registry | Blocks Usados | Safety Gate |
|----------|---------------|-------------|
| shadcn official | button, card, badge, table, separator, dialog, alert-dialog, tabs, input, label, form, select, sonner, calendar, popover, tooltip, scroll-area, avatar, dropdown-menu, progress, textarea | not required — código copiado no repo |
| Terceiros | nenhum | não aplicável |

**Nenhum bloco de registry terceiro declarado para esta phase.** Gate de vetting não necessário.

**Pacote novo (não é registry shadcn):** `exceljs@4.4.0` — biblioteca npm server-side para geração de `.xlsx`. Não envolve componentes de UI. Avaliação de segurança coberta em RESEARCH.md (CVE-2023-30533 descartado para exceljs; vulnerabilidades transitivas menores avaliadas como não críticas para uso server-side write-only).

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

---

*Phase: 06-dashboards-relatorios*
*UI-SPEC gerado: 2026-04-30*
*Baseado em: CONTEXT.md (10 decisões), RESEARCH.md (stack verificado), components.json (shadcn new-york/neutral), codebase scan (stat-card.tsx, globals.css, dashboard/page.tsx, financeiro/page.tsx, corretores/page.tsx)*

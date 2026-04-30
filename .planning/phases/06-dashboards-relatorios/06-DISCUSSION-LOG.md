# Phase 6: Dashboards & Relatorios - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 06-dashboards-relatorios
**Areas discussed:** KPIs + Graficos, Exportacao (DASH-04), Quem ve o que

---

## KPIs + Graficos

| Option | Description | Selected |
|--------|-------------|----------|
| Stat cards + tabelas | Mesmos padroes ja estabelecidos nas phases 4 e 5. Zero dependencia nova. | ✓ |
| Stat cards + 1 grafico de linha | Recharts com grafico de receita por mes (linha). Precisaria instalar Recharts. | |
| Dashboard rico com graficos multiplos | Recharts com linha, barras, pizza. Mais visual, mais complexidade. | |

**User's choice:** Stat cards + tabelas
**Notes:** Zero dependência nova. Padrão já estabelecido.

---

### KPIs Quais

| Option | Description | Selected |
|--------|-------------|----------|
| Apolices + Receita + Inadimplencia + Vencendo | 4 cards: apolices ativas, receita do periodo, inadimplencia (R$), vencimentos proximos 30d | ✓ |
| Adicionar comissoes do mes | 5 cards com comissoes pagas no periodo tambem | |
| So os 3 financeiros | Receita, inadimplencia, saldo. Sem contagem de apolices. | |

**User's choice:** 4 cards: Apólices ativas, Receita do período, Inadimplência, Vencendo 30d

---

## Exportacao (DASH-04)

### Formato

| Option | Description | Selected |
|--------|-------------|----------|
| Excel (.xlsx) apenas | exceljs ou xlsx. Bundle menor, util para manipulacao de dados. | ✓ |
| PDF apenas | jsPDF + autoTable. Bom para impressao, usuario nao pode editar. | |
| Ambos PDF e Excel | Mais completo mas dobra complexidade e bundle size. | |

**User's choice:** Excel (.xlsx) apenas

### Dados exportados

| Option | Description | Selected |
|--------|-------------|----------|
| 3 relatorios separados | Botao contextual em cada listagem: apolices, clientes, comissoes | ✓ |
| Relatorio consolidado no dashboard | Pagina /relatorios com selector e filtros, xlsx com multiplas abas | |
| So apolices por enquanto | Comeca com o caso mais importante | |

**User's choice:** 3 relatórios separados (contextual)

### Filtros

| Option | Description | Selected |
|--------|-------------|----------|
| Respeita filtros ativos | Exporta exatamente o que esta visivel na tela filtrada | ✓ |
| Sempre exporta tudo do tenant | Ignora filtros, exporta base completa | |

**User's choice:** Respeita filtros ativos

---

## Quem Ve o Que (RBAC Dashboard)

### Conteudo por role

| Option | Description | Selected |
|--------|-------------|----------|
| Admin executivo, corretor pessoal | Mesma rota, conteudo diferente. Admin: KPIs+ranking. Corretor: redirect /corretores/[id] | ✓ |
| Dashboard so para admin, corretor redireciona | /dashboard = admin-only. Corretor redirect para /corretores/[id]. | |
| Todos veem dashboard simplificado | Dashboard unico com KPIs filtrados por role | |

**User's choice:** Admin/financeiro veem executivo; corretor redirect para /corretores/[id]

### Corretor view

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect para /corretores/[id] | Usa pagina de dashboard do corretor ja implementada na Phase 4 | ✓ |
| Resumo inline simplificado | Renderiza versao simplificada na /dashboard | |

**User's choice:** Redirect para /corretores/[id] (zero duplicação de código)

### Role financeiro

| Option | Description | Selected |
|--------|-------------|----------|
| Financeiro ve o mesmo que admin | Acesso ao executivo — faz sentido pois gerencia KPIs e inadimplencia | ✓ |
| Nao, financeiro vai para /financeiro | Dashboard so para admin, financeiro redireciona | |

**User's choice:** financeiro vê mesmo conteúdo executivo que admin

---

## Claude's Discretion

- Alertas (DASH-03): page-load estático sem Supabase Realtime (usuário não discutiu esta área → mantém padrão das phases anteriores)
- Biblioteca Excel: xlsx vs exceljs — planner decide baseado em server-side compatibility
- Mecanismo de download: Route Handler vs Server Action stream — planner decide

## Deferred Ideas

- Gráficos Recharts — linha de receita por mês, barras por produto
- PDF — relatórios formais para impressão
- Página /relatórios centralizada com múltiplas abas no xlsx
- Supabase Realtime para alertas push

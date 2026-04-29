# Phase 5: Financeiro — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 05-financeiro
**Areas discussed:** Modelo de lançamentos, Criação de lançamentos, Fluxo de caixa (FIN-03), Inadimplência (FIN-04)

---

## Modelo de lançamentos

| Option | Description | Selected |
|--------|-------------|----------|
| Uma tabela + entry_type | Tabela financial_entries com entry_type = 'receivable' \| 'payable'. Padrão commission_entries. | ✓ |
| Duas tabelas separadas | receivables + payables. Duplica schema e RLS. | |

**User's choice:** Uma tabela + entry_type

| Option | Description | Selected |
|--------|-------------|----------|
| Vínculo opcional | policy_id e quota_id nullable. Permite lançamentos avulsos. | ✓ |
| Vínculo obrigatório | Cada lançamento precisa referenciar apólice ou cota. | |

**User's choice:** Vínculo opcional

| Option | Description | Selected |
|--------|-------------|----------|
| Mínimo viável | description, amount, due_date, entry_type, status. | ✓ |
| Estendido | Adiciona category, client_id FK, notes. | |

**User's choice:** Mínimo viável (+ client_id para badge de inadimplência e notes como opcional)

---

## Criação de lançamentos

| Option | Description | Selected |
|--------|-------------|----------|
| Manual + sugestão automática | Criação manual + Dialog pós mark-commission-paid oferece criar lançamento. | ✓ |
| Só manual | Todo lançamento criado manualmente em /financeiro. | |
| Totalmente automático | Criação automática sem confirmação. | |

**User's choice:** Manual + sugestão automática

| Option | Description | Selected |
|--------|-------------|----------|
| /[slug]/financeiro | Rota própria com tabela consolidada. | ✓ |
| Dentro de /seguros e /consorcio | Lançamentos como aba no detalhe. | |

**User's choice:** /[slug]/financeiro

| Option | Description | Selected |
|--------|-------------|----------|
| Admin + Financeiro | Roles admin e financeiro criam e veem todos os lançamentos. | ✓ |
| Todos os roles | Qualquer usuário autenticado. | |

**User's choice:** Admin + Financeiro (com exceção: corretor vê badge de inadimplência do próprio cliente)

---

## Fluxo de caixa (FIN-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Tabela + cards de resumo | Cards no topo (a receber, a pagar, saldo) + tabela. Sem gráfico em v1. | ✓ |
| Tabela + gráfico de barras | Entradas × saídas por semana/mês. Melhor em Phase 6. | |

**User's choice:** Tabela + cards de resumo

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown de mês | MonthSelector da Phase 4. URL-driven ?month=YYYY-MM. | ✓ |
| Date range picker | Início e fim customizáveis. Componente não existe ainda. | |

**User's choice:** Dropdown de mês

| Option | Description | Selected |
|--------|-------------|----------|
| Tabs (Receber \| Pagar \| Todos) | Padrão tabs da Phase 4. Separação visual clara. | ✓ |
| Tabela única + filtro inline | Select de tipo. Padrão Phase 3. | |

**User's choice:** Tabs (Receber | Pagar | Todos) + aba extra "Vencidos"

---

## Inadimplência (FIN-04)

| Option | Description | Selected |
|--------|-------------|----------|
| due_date < hoje | Calculado na query. Zero configuração. | ✓ |
| X dias após vencimento | N dias de tolerância. Requer config por tenant. | |

**User's choice:** due_date < hoje (status pending)

| Option | Description | Selected |
|--------|-------------|----------|
| Badge no cliente + lista em /financeiro | Badge em /clientes + aba Vencidos em /financeiro. | ✓ |
| Só em /financeiro | Apenas aba Vencidos. | |

**User's choice:** Badge no cliente + aba Vencidos em /financeiro

| Option | Description | Selected |
|--------|-------------|----------|
| Admin + Financeiro + Corretor responsável | Corretor vê badge do próprio cliente. | ✓ |
| Só Admin + Financeiro | Corretor não vê inadimplência. | |

**User's choice:** Admin + Financeiro + Corretor responsável

---

## Claude's Discretion

- Ícone do item "Financeiro" na sidebar (Wallet, DollarSign, ou Banknote)
- Componente de badge de status de lançamento (novo ou reutilizar padrão existente)
- Ordem padrão da tabela (due_date ASC)
- Copy dos empty states

## Deferred Ideas

- Gráfico de barras entradas × saídas → Phase 6
- Exportação PDF/Excel → Phase 6
- Alertas por email de inadimplência → Phase 7
- Date range picker → Phase 6
- Tolerância de dias configurável por tenant → v2

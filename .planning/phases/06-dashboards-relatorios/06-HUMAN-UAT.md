---
status: partial
phase: 06-dashboards-relatorios
source: [06-VERIFICATION.md]
started: 2026-05-01T02:16:36Z
updated: 2026-05-01T02:16:36Z
---

## Current Test

[aguardando teste manual]

## Tests

### 1. KPI cards exibem valores reais do tenant
expected: Os 4 cards (Apólices Ativas, Prêmio Mensal, Receita Realizada, Inadimplência) exibem valores não-zero a partir dos dados do tenant no Supabase
result: [pending]

### 2. Role `corretor` redireciona para dashboard próprio
expected: Usuário autenticado com role `corretor` acessando `/[slug]/dashboard` é redirecionado para `/[slug]/corretores/{user.id}`
result: [pending]

### 3. Role `visualizador` recebe 404
expected: Usuário autenticado com role `visualizador` acessando `/[slug]/dashboard` recebe página 404
result: [pending]

### 4. MonthSelector atualiza KPIs via `?month=` param
expected: Selecionar um mês diferente no MonthSelector altera os valores de Receita Realizada, Inadimplência e Ranking de Corretores na página
result: [pending]

### 5. Botão "Exportar Excel" gera `.xlsx` válido
expected: Clicar em "Exportar Excel" em qualquer listagem (Seguros, Clientes ou Corretores) baixa um arquivo `.xlsx` com cabeçalho em negrito e dados filtrados conforme os filtros ativos
result: [pending]

### 6. Role `corretor` recebe 403 no endpoint de export
expected: Requisição autenticada como `corretor` para `/api/[slug]/export?type=apolices` retorna HTTP 403
result: [pending]

### 7. Tipo inválido retorna 400
expected: Requisição para `/api/[slug]/export?type=invalido` retorna HTTP 400
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

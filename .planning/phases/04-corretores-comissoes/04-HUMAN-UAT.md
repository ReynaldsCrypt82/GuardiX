---
status: partial
phase: 04-corretores-comissoes
source: [04-VERIFICATION.md]
started: 2026-04-28T00:00:00Z
updated: 2026-04-28T00:00:00Z
---

## Current Test

[aguardando testes manuais no browser]

## Tests

### 1. Cadastro de corretor via Dialog
expected: Admin clica "Completar perfil de corretor" em um usuário com role=corretor → Dialog abre com campos SUSEP, meta, taxa padrão e 9 overrides por produto → Submit mostra toast de sucesso → tabela na /[slug]/corretores revalida e exibe nova entrada com dados corretos
result: [pending]

### 2. Cadastro e exclusão de parceiro
expected: Admin acessa /[slug]/parceiros → clica "Novo parceiro" → preenche nome, CNPJ (opcional), taxas → Submit mostra toast de sucesso → linha aparece na tabela. Em seguida, admin clica "Excluir" → AlertDialog com copy "Excluir parceiro?" / "Sim, excluir" / "Manter parceiro" → confirmação remove a linha (soft delete, deleted_at preenchido)
result: [pending]

### 3. Fluxo completo mark-commission-paid + idempotência
expected: Admin acessa detalhe de uma apólice (/[slug]/seguros/[id]) → botão "Marcar comissão como paga" aparece (não um badge) → clica → Dialog exibe valores pré-calculados (broker amount + partner amount se houver) → confirma → botão desaparece e badge verde "Comissão paga" aparece com data. Segunda tentativa de clicar no mesmo item retorna toast de erro "Comissão já registrada para este item"
result: [pending]

### 4. Redirect D-11 — corretor redirecionado ao próprio dashboard
expected: Usuário autenticado com role=corretor tenta acessar /[slug]/corretores → é imediatamente redirecionado para /[slug]/corretores/[proprio-id]. Tentativa de navegar para /[slug]/corretores/[outro-id] também redireciona para o próprio ID
result: [pending]

### 5. Dashboard com dados reais + MonthSelector
expected: Admin acessa /[slug]/corretores/[id] → 4 stat cards exibem valores reais do banco (Produção do Mês, Comissão Acumulada em BRL, Carteira Ativa, Meta Atingida em %). MonthSelector seleciona mês anterior → stat cards e tabela de relatório atualizam para o período selecionado
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

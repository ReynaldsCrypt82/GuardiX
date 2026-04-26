---
status: diagnosed
phase: 03-seguros-consorcio
source: [03-VERIFICATION.md]
started: 2026-04-25T19:05:00Z
updated: 2026-04-25T19:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. VigenciaBadge Visual
expected: Apólices com >60 dias mostram badge verde 'Vigente', 31-60 dias mostram amarelo 'A vencer', <=30 dias ou vencidas mostram vermelho 'Vencida'
result: pass

### 2. Formulário Dinâmico de Apólice
expected: Ao selecionar 'auto', campos placa/chassi/marca_modelo/ano/valor_fipe/cobertura aparecem. Ao trocar para 'vida', esses campos somem e aparecem valor_assegurado/beneficiarios. Campos do tipo anterior não persistem no FormData.
result: pass

### 3. ContemplationDialog Campo Condicional
expected: Ao selecionar tipo 'sorteio', campo Valor do lance não aparece. Ao selecionar 'lance', campo Valor do lance aparece e é obrigatório.
result: pass

### 4. Toast de Alerta ao Abrir Sistema
expected: Com pelo menos 1 apólice com vigencia_fim <= 30 dias, ao carregar /[slug]/*, um toast warning 'N apólice(s) vencendo...' aparece no canto superior direito por 6 segundos
result: pass

### 5. Badge Contador na Sidebar
expected: Com apólices vencendo, badge vermelho com contagem aparece ao lado de 'Seguros'. Com assembleia nos próximos 3 dias, badge laranja com contagem aparece ao lado de 'Consórcio'.
result: issue
reported: "não consigo editar o grupo para inserir a data da assembleia — listagem de grupos só tem botão 'Ver grupo', sem opção de editar. Sem UI de edição de grupo, o next_assembly_date nunca pode ser preenchido e o badge laranja de Consórcio nunca aparece."
severity: major

## Summary

total: 5
passed: 4
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Badge laranja de Consórcio aparece na sidebar quando há assembleia nos próximos 3 dias"
  status: failed
  reason: "User reported: não há UI para editar grupo e preencher next_assembly_date — listagem só tem botão 'Ver grupo', sem edição. updateGroupAction existe no backend mas não há página/form de edição de grupo no frontend."
  severity: major
  test: 5
  artifacts:
    - path: "src/app/(app)/[slug]/consorcio/page.tsx"
      issue: "Tabela de grupos só tem botão 'Ver grupo' (link para /consorcio/[id]), sem botão de editar ou ação para atualizar next_assembly_date"
    - path: "src/lib/actions/consortium-groups.ts"
      issue: "updateGroupAction existe mas não há UI que o invoque para atualizar next_assembly_date"
  missing:
    - "Adicionar botão/link de edição de grupo na listagem ou na página de detalhes do grupo"
    - "Criar formulário de edição de grupo que permita atualizar next_assembly_date (e outros campos editáveis)"

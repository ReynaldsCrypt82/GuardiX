---
status: partial
phase: 03-seguros-consorcio
source: [03-VERIFICATION.md]
started: 2026-04-25T19:05:00Z
updated: 2026-04-25T19:05:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. VigenciaBadge Visual
expected: Apólices com >60 dias mostram badge verde 'Vigente', 31-60 dias mostram amarelo 'A vencer', <=30 dias ou vencidas mostram vermelho 'Vencida'
result: [pending]

### 2. Formulário Dinâmico de Apólice
expected: Ao selecionar 'auto', campos placa/chassi/marca_modelo/ano/valor_fipe/cobertura aparecem. Ao trocar para 'vida', esses campos somem e aparecem valor_assegurado/beneficiarios. Campos do tipo anterior não persistem no FormData.
result: [pending]

### 3. ContemplationDialog Campo Condicional
expected: Ao selecionar tipo 'sorteio', campo Valor do lance não aparece. Ao selecionar 'lance', campo Valor do lance aparece e é obrigatório.
result: [pending]

### 4. Toast de Alerta ao Abrir Sistema
expected: Com pelo menos 1 apólice com vigencia_fim <= 30 dias, ao carregar /[slug]/*, um toast warning 'N apólice(s) vencendo...' aparece no canto superior direito por 6 segundos
result: [pending]

### 5. Badge Contador na Sidebar
expected: Com apólices vencendo, badge vermelho com contagem aparece ao lado de 'Seguros'. Com assembleia nos próximos 3 dias, badge laranja com contagem aparece ao lado de 'Consórcio'.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

---
status: complete
phase: 03-seguros-consorcio
source: [03-VERIFICATION.md]
started: 2026-04-25T19:05:00Z
updated: 2026-04-25T20:30:00Z
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
result: fixed
reported: "não consigo editar o grupo para inserir a data da assembleia — listagem de grupos só tem botão 'Ver grupo', sem opção de editar. Sem UI de edição de grupo, o next_assembly_date nunca pode ser preenchido e o badge laranja de Consórcio nunca aparece."
fixed_by: 03-06-PLAN.md — GroupEditDialog adicionado no header da página de detalhes do grupo; updateGroupAction estendida para todos os campos editáveis com Zod safeParse

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Badge laranja de Consórcio aparece na sidebar quando há assembleia nos próximos 3 dias"
  status: fixed
  fix: "03-06: GroupEditDialog criado em src/components/consorcio/group-edit-dialog.tsx, wired no header de src/app/(app)/[slug]/consorcio/[id]/page.tsx. updateGroupAction agora valida e persiste todos os campos editáveis incluindo next_assembly_date (nullable). Badge já consultava next_assembly_date desde Phase 03-04."
  severity: major
  test: 5

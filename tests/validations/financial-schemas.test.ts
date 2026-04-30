import { describe, it, expect } from 'vitest'
import {
  createFinancialEntrySchema,
  markFinancialEntryPaidSchema,
  softDeleteFinancialEntrySchema,
} from '@/lib/validations/financial-schemas'

describe('financial-schemas — createFinancialEntrySchema', () => {
  it('aceita receivable com campos minimos validos', () => {
    const r = createFinancialEntrySchema.safeParse({
      entry_type: 'receivable',
      description: 'Premio Auto Bradesco',
      amount: 1500.5,
      due_date: '2026-05-15',
    })
    expect(r.success).toBe(true)
  })

  it('aceita payable com vinculos opcionais explicitamente null', () => {
    const r = createFinancialEntrySchema.safeParse({
      entry_type: 'payable',
      description: 'Repasse seguradora',
      amount: 100,
      due_date: '2026-05-20',
      policy_id: null,
      quota_id: null,
      client_id: null,
    })
    expect(r.success).toBe(true)
  })

  it.todo('rejeita amount = 0')
  it.todo('rejeita amount negativo')
  it.todo('rejeita entry_type fora de receivable/payable')
  it.todo('rejeita due_date em formato dd/mm/yyyy')
  it.todo('rejeita description com menos de 3 chars')
  it.todo('aceita amount com 2 casas decimais')
  it.todo('aceita policy_id como UUID valido')
})

describe('financial-schemas — markFinancialEntryPaidSchema', () => {
  it('aceita entry_id UUID sem paid_at', () => {
    const r = markFinancialEntryPaidSchema.safeParse({
      entry_id: '11111111-1111-1111-1111-111111111111',
    })
    expect(r.success).toBe(true)
  })

  it.todo('aceita entry_id UUID com paid_at ISO datetime')
  it.todo('rejeita entry_id nao-UUID')
  it.todo('rejeita paid_at em formato YYYY-MM-DD (deve ser ISO datetime)')
})

describe('financial-schemas — softDeleteFinancialEntrySchema', () => {
  it('aceita entry_id UUID', () => {
    const r = softDeleteFinancialEntrySchema.safeParse({
      entry_id: '22222222-2222-2222-2222-222222222222',
    })
    expect(r.success).toBe(true)
  })

  it.todo('rejeita entry_id ausente')
})

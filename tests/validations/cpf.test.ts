import { describe, it, expect } from 'vitest'

import { validateCPF, stripCPF, formatCPF } from '@/lib/validations/cpf'

describe('validateCPF', () => {
  it('accepts valid CPF with mask (111.444.777-35)', () => {
    expect(validateCPF('111.444.777-35')).toBe(true)
  })

  it('accepts valid CPF without mask (11144477735)', () => {
    expect(validateCPF('11144477735')).toBe(true)
  })

  it('accepts another valid CPF (529.982.247-25)', () => {
    expect(validateCPF('529.982.247-25')).toBe(true)
  })

  it('rejects CPF with all same digits (000.000.000-00)', () => {
    expect(validateCPF('000.000.000-00')).toBe(false)
  })

  it('rejects CPF with all same digits (111.111.111-11)', () => {
    expect(validateCPF('111.111.111-11')).toBe(false)
  })

  it('rejects CPF with wrong first check digit (111.444.777-36)', () => {
    expect(validateCPF('111.444.777-36')).toBe(false)
  })

  it('rejects CPF with wrong check digits (529.982.247-26)', () => {
    expect(validateCPF('529.982.247-26')).toBe(false)
  })

  it('rejects CPF with wrong length (1234567890 — 10 digits)', () => {
    expect(validateCPF('1234567890')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateCPF('')).toBe(false)
  })

  it('does not throw on null input (returns false)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(validateCPF(null as any)).toBe(false)
  })
})

describe('stripCPF', () => {
  it('removes mask from valid CPF (111.444.777-35 → 11144477735)', () => {
    expect(stripCPF('111.444.777-35')).toBe('11144477735')
  })

  it('returns empty string on null input without throwing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(stripCPF(null as any)).toBe('')
  })

  it('returns digits only when no mask is present', () => {
    expect(stripCPF('11144477735')).toBe('11144477735')
  })
})

describe('formatCPF', () => {
  it('formats raw digits as 111.444.777-35', () => {
    expect(formatCPF('11144477735')).toBe('111.444.777-35')
  })

  it('formats empty string as 000.000.000-00 (padded)', () => {
    expect(formatCPF('')).toBe('000.000.000-00')
  })

  it('formats masked input correctly (idempotent)', () => {
    expect(formatCPF('111.444.777-35')).toBe('111.444.777-35')
  })
})

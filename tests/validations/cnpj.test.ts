import { describe, it, expect } from 'vitest'

// @ts-expect-error — module does not exist yet (Wave 1 implements it)
import { validateCNPJ } from '@/lib/validations/cnpj'

describe('validateCNPJ', () => {
  it('accepts valid CNPJ with correct check digits', () => {
    expect(validateCNPJ('11222333000181')).toBe(true)
  })
  it('rejects CNPJ with all same digits', () => {
    expect(validateCNPJ('11111111111111')).toBe(false)
  })
  it('rejects CNPJ with wrong check digits', () => {
    expect(validateCNPJ('11222333000100')).toBe(false)
  })
  it('rejects non-numeric input', () => {
    expect(validateCNPJ('abc')).toBe(false)
  })
  it('rejects CNPJ with wrong length', () => {
    expect(validateCNPJ('1122233300018')).toBe(false)
  })
})

/**
 * CNPJ digit-verifier
 *
 * Reference: 01-RESEARCH.md Pattern 6
 * Algorithm: https://dev.to/leandrostl/demystifying-cpf-and-cnpj-check-digit-algorithms
 *
 * Exports:
 *   - validateCNPJ(cnpj): boolean  — digit-verifier algorithm, rejects all-same sequences
 *   - stripCNPJ(cnpj): string      — removes non-digit characters
 *   - formatCNPJ(cnpj): string     — formats as "00.000.000/0000-00"
 */

export function stripCNPJ(cnpj: string): string {
  return (cnpj ?? '').replace(/\D/g, '')
}

export function formatCNPJ(cnpj: string): string {
  const d = stripCNPJ(cnpj).padStart(14, '0').slice(0, 14)
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`
}

export function validateCNPJ(cnpj: string): boolean {
  const digits = stripCNPJ(cnpj)

  // Must be exactly 14 digits
  if (digits.length !== 14) return false

  // Reject all-same sequences (e.g. 00000000000000, 11111111111111)
  if (/^(\d)\1+$/.test(digits)) return false

  // Modulo-11 check digit verifier
  const calcDigit = (input: string, len: number): number => {
    let sum = 0
    let pos = len - 7
    for (let i = 0; i < len; i++) {
      sum += parseInt(input[i], 10) * pos--
      if (pos < 2) pos = 9
    }
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  const d1 = calcDigit(digits.slice(0, 12), 12)
  const d2 = calcDigit(digits.slice(0, 13), 13)

  return parseInt(digits[12], 10) === d1 && parseInt(digits[13], 10) === d2
}

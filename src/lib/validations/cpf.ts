/**
 * CPF digit-verifier
 *
 * Reference: 02-RESEARCH.md Pattern 1
 * Algorithm: módulo-11 Receita Federal — 11 dígitos (9 base + 2 verificadores)
 *
 * Exports:
 *   - validateCPF(cpf): boolean  — digit-verifier algorithm, rejects all-same sequences
 *   - stripCPF(cpf): string      — removes non-digit characters
 *   - formatCPF(cpf): string     — formats as "000.000.000-00"
 */

export function stripCPF(cpf: string): string {
  return (cpf ?? '').replace(/\D/g, '')
}

export function formatCPF(cpf: string): string {
  const d = stripCPF(cpf).padStart(11, '0').slice(0, 11)
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`
}

export function validateCPF(cpf: string): boolean {
  const digits = stripCPF(cpf)

  // Must be exactly 11 digits
  if (digits.length !== 11) return false

  // Reject all-same sequences (e.g. 000.000.000-00, 111.111.111-11)
  if (/^(\d)\1+$/.test(digits)) return false

  // Modulo-11 check digit verifier (pesos descendentes: len+1, len, ..., 2)
  const calcDigit = (input: string, len: number): number => {
    let sum = 0
    for (let i = 0; i < len; i++) {
      sum += parseInt(input[i], 10) * (len + 1 - i)
    }
    const remainder = (sum * 10) % 11
    return remainder >= 10 ? 0 : remainder
  }

  const d1 = calcDigit(digits, 9)
  const d2 = calcDigit(digits, 10)

  return parseInt(digits[9], 10) === d1 && parseInt(digits[10], 10) === d2
}

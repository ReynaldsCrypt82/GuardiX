import { formatCPF } from '@/lib/validations/cpf'
import { formatCNPJ } from '@/lib/validations/cnpj'

/**
 * Formats a 11-digit CPF or 14-digit CNPJ stored without mask back to display form.
 * Falls back to raw input if length doesn't match expected type.
 */
export function formatDocument(document: string, type: 'pf' | 'pj'): string {
  const digits = (document ?? '').replace(/\D/g, '')
  if (type === 'pf' && digits.length === 11) return formatCPF(digits)
  if (type === 'pj' && digits.length === 14) return formatCNPJ(digits)
  return document ?? ''
}

import { z } from 'zod'

/**
 * createFinancialEntrySchema — D-01, D-02, D-03
 * Validação para criação de lançamento (receivable ou payable).
 * - amount: positivo (CHECK no banco também — Pitfall 6)
 * - due_date: formato YYYY-MM-DD (DATE no PostgreSQL, sem timezone)
 * - policy_id, quota_id, client_id: nullable (D-03 lançamentos avulsos)
 */
export const createFinancialEntrySchema = z.object({
  entry_type: z.enum(['receivable', 'payable'], { message: 'Tipo invalido (receivable ou payable)' }),
  description: z.string().min(3, 'Descricao deve ter ao menos 3 caracteres'),
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  policy_id: z.string().uuid('ID de apolice invalido').optional().nullable(),
  quota_id: z.string().uuid('ID de cota invalido').optional().nullable(),
  client_id: z.string().uuid('ID de cliente invalido').optional().nullable(),
  notes: z.string().optional().nullable(),
})

/**
 * markFinancialEntryPaidSchema — D-08 (FIN-05)
 * paid_at default = hoje (preenchido na Server Action se não vier).
 * Idempotência (status != 'paid') é responsabilidade da action, não do schema.
 */
export const markFinancialEntryPaidSchema = z.object({
  entry_id: z.string().uuid('ID de lancamento invalido'),
  paid_at: z.string().datetime({ message: 'paid_at deve ser ISO datetime' }).optional(),
})

/**
 * softDeleteFinancialEntrySchema — D-12 padrão Phase 1
 * Soft delete via UPDATE deleted_at. Hard DELETE é bloqueado pelo trigger.
 */
export const softDeleteFinancialEntrySchema = z.object({
  entry_id: z.string().uuid('ID de lancamento invalido'),
})

export type CreateFinancialEntryInput = z.infer<typeof createFinancialEntrySchema>
export type MarkFinancialEntryPaidInput = z.infer<typeof markFinancialEntryPaidSchema>
export type SoftDeleteFinancialEntryInput = z.infer<typeof softDeleteFinancialEntrySchema>

import { z } from 'zod'

// Trigger D-09: marcar comissao como paga
export const markCommissionPaidSchema = z.object({
  source_type: z.enum(['policy', 'quota'], { message: 'Tipo de origem invalido' }),
  source_id: z.string().uuid('ID de origem invalido'),
  notes: z.string().optional(),
})

// Estorno: novo lancamento com amount NEGATIVO (D-10 immutability)
// notes obrigatorio (motivo do estorno)
export const registerEstornoSchema = z.object({
  source_type: z.enum(['policy', 'quota'], { message: 'Tipo de origem invalido' }),
  source_id: z.string().uuid('ID de origem invalido'),
  recipient_type: z.enum(['broker', 'partner'], { message: 'Tipo de destinatario invalido' }),
  recipient_id: z.string().uuid('ID do destinatario invalido'),
  amount: z.coerce.number().refine((v) => v < 0, { message: 'Estorno deve ter amount NEGATIVO' }),
  reference_month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  notes: z.string().min(3, 'Motivo do estorno obrigatorio'),
})

// Correcao: novo lancamento complementar (positivo ou negativo)
export const registerCorrecaoSchema = z.object({
  source_type: z.enum(['policy', 'quota'], { message: 'Tipo de origem invalido' }),
  source_id: z.string().uuid('ID de origem invalido'),
  recipient_type: z.enum(['broker', 'partner'], { message: 'Tipo de destinatario invalido' }),
  recipient_id: z.string().uuid('ID do destinatario invalido'),
  amount: z.coerce.number().refine((v) => v !== 0, { message: 'Correcao nao pode ter amount zero' }),
  reference_month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  notes: z.string().min(3, 'Motivo da correcao obrigatorio'),
})

export type MarkCommissionPaidInput = z.infer<typeof markCommissionPaidSchema>
export type RegisterEstornoInput = z.infer<typeof registerEstornoSchema>
export type RegisterCorrecaoInput = z.infer<typeof registerCorrecaoSchema>

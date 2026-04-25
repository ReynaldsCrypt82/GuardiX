import { z } from 'zod'

export const createEndorsementSchema = z.object({
  policy_id: z.string().uuid('Apólice obrigatória'),
  endorsement_date: z.string().date('Data do endosso inválida'),
  type: z.enum(['inclusao', 'exclusao', 'alteracao'], {
    errorMap: () => ({ message: 'Tipo de endosso inválido' }),
  }),
  description: z.string().min(1, 'Descrição obrigatória'),
  premium_impact: z.coerce.number().optional().nullable(),
})

export type CreateEndorsementInput = z.infer<typeof createEndorsementSchema>

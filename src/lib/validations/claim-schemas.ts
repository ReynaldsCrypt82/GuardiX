import { z } from 'zod'

export const createClaimSchema = z.object({
  policy_id: z.string().uuid('Apólice obrigatória'),
  claim_date: z.string().date('Data do sinistro inválida'),
  type: z.string().min(1, 'Tipo de sinistro obrigatório'),
  protocol_number: z.string().optional(),
  status: z.enum(['aberto', 'em_analise', 'encerrado']).default('aberto'),
  description: z.string().min(1, 'Descrição obrigatória'),
})

export type CreateClaimInput = z.infer<typeof createClaimSchema>

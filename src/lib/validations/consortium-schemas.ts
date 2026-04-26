import { z } from 'zod'

export const createGroupSchema = z.object({
  administrator: z.string().min(2, 'Administradora obrigatória'),
  type: z.enum(['auto', 'imovel', 'servico'], {
    errorMap: () => ({ message: 'Tipo de consórcio inválido' }),
  }),
  credit_value: z.coerce.number().min(0.01, 'Valor de crédito deve ser maior que zero'),
  term_months: z.coerce.number().int().min(1, 'Prazo em meses obrigatório'),
  start_date: z.string().date('Data de início inválida'),
  total_quotas: z.coerce.number().int().min(1, 'Total de cotas deve ser pelo menos 1'),
  next_assembly_date: z.string().date().optional().nullable(),
})

export type CreateGroupInput = z.infer<typeof createGroupSchema>

export const updateGroupSchema = z.object({
  administrator: z.string().min(2, 'Administradora obrigatória'),
  type: z.enum(['auto', 'imovel', 'servico'], {
    errorMap: () => ({ message: 'Tipo de consórcio inválido' }),
  }),
  credit_value: z.coerce.number().min(0.01, 'Valor de crédito deve ser maior que zero'),
  term_months: z.coerce.number().int().min(1, 'Prazo em meses obrigatório'),
  total_quotas: z.coerce.number().int().min(1, 'Total de cotas deve ser pelo menos 1'),
  next_assembly_date: z.string().date('Data de assembleia inválida').optional().nullable(),
})

export type UpdateGroupInput = z.infer<typeof updateGroupSchema>

export const createQuotaSchema = z.object({
  group_id: z.string().uuid('Grupo obrigatório'),
  client_id: z.string().uuid('Cliente obrigatório'),
  assigned_to: z.string().uuid('Corretor obrigatório'),
  quota_number: z.string().min(1, 'Número da cota obrigatório'),
  monthly_payment: z.coerce.number().min(0, 'Parcela inválida'),
})

export type CreateQuotaInput = z.infer<typeof createQuotaSchema>

export const updateQuotaContemplationSchema = z.discriminatedUnion('contemplation_type', [
  z.object({
    quota_id: z.string().uuid(),
    contemplation_date: z.string().date('Data de contemplação inválida'),
    contemplation_type: z.literal('sorteio'),
    lance_value: z.undefined().optional(),
    post_contemplation_stage: z
      .enum(['aguardando_docs', 'em_analise', 'credito_liberado'])
      .default('aguardando_docs'),
    post_contemplation_notes: z.string().optional(),
  }),
  z.object({
    quota_id: z.string().uuid(),
    contemplation_date: z.string().date('Data de contemplação inválida'),
    contemplation_type: z.literal('lance'),
    lance_value: z.coerce.number().min(0.01, 'Valor do lance obrigatório para tipo lance'),
    post_contemplation_stage: z
      .enum(['aguardando_docs', 'em_analise', 'credito_liberado'])
      .default('aguardando_docs'),
    post_contemplation_notes: z.string().optional(),
  }),
])

export type UpdateQuotaContemplationInput = z.infer<typeof updateQuotaContemplationSchema>

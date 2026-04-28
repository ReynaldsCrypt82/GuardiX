import { z } from 'zod'

const commissionOverridesSchema = z.object({
  auto:              z.coerce.number().min(0).max(1).optional(),
  vida:              z.coerce.number().min(0).max(1).optional(),
  residencial:       z.coerce.number().min(0).max(1).optional(),
  empresarial:       z.coerce.number().min(0).max(1).optional(),
  saude:             z.coerce.number().min(0).max(1).optional(),
  outros:            z.coerce.number().min(0).max(1).optional(),
  consorcio_auto:    z.coerce.number().min(0).max(1).optional(),
  consorcio_imovel:  z.coerce.number().min(0).max(1).optional(),
  consorcio_servico: z.coerce.number().min(0).max(1).optional(),
}).optional()

export const createPartnerSchema = z.object({
  name: z.string().min(2, 'Nome do parceiro obrigatorio'),
  cnpj: z.string().optional(),
  contact_email: z.string().email('E-mail invalido').optional().or(z.literal('')),
  contact_phone: z.string().optional(),
  commission_rate_default: z.coerce.number().min(0, 'Taxa invalida (0-1)').max(1, 'Taxa invalida (0-1)'),
  commission_rate_overrides: commissionOverridesSchema,
})

export const updatePartnerSchema = createPartnerSchema.partial().extend({
  id: z.string().uuid('Parceiro invalido'),
})

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>

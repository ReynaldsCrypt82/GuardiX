import { z } from 'zod'

// Phase 04 D-07: chaves do JSONB de overrides
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

// upsertBrokerProfileAction: profile_id eh o id do profile (admin escolhe qual corretor)
export const upsertBrokerProfileSchema = z.object({
  profile_id: z.string().uuid('Perfil invalido'),
  susep_number: z.string().optional(),
  monthly_goal: z.coerce.number().min(0, 'Meta invalida'),
  commission_rate_default: z.coerce.number().min(0, 'Taxa invalida (0-1)').max(1, 'Taxa invalida (0-1)'),
  commission_rate_overrides: commissionOverridesSchema,
})

export type UpsertBrokerProfileInput = z.infer<typeof upsertBrokerProfileSchema>
export const COMMISSION_OVERRIDE_KEYS = [
  'auto', 'vida', 'residencial', 'empresarial', 'saude', 'outros',
  'consorcio_auto', 'consorcio_imovel', 'consorcio_servico',
] as const
export type CommissionOverrideKey = typeof COMMISSION_OVERRIDE_KEYS[number]

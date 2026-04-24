import { z } from 'zod'

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida (use formato hex #RRGGBB)')

export const createStageSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(50, 'Nome muito longo'),
  color: hexColor,
  is_closed: z.boolean().default(false),
})

export const updateClientStageSchema = z.object({
  clientId: z.string().uuid('clientId deve ser um UUID válido'),
  stageId: z.string().uuid('stageId deve ser um UUID válido'),
})

export type CreateStageInput = z.infer<typeof createStageSchema>
export type UpdateClientStageInput = z.infer<typeof updateClientStageSchema>

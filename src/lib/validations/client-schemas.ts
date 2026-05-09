import { z } from 'zod'
import { validateCPF } from './cpf'
import { validateCNPJ } from './cnpj'

const baseFields = {
  assigned_to: z.string().uuid().optional().or(z.literal('')),
  partner_id: z.string().uuid().optional().or(z.literal('')),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
}

export const createClientSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('pf'),
    document: z.string().refine((v) => validateCPF(v), 'CPF inválido'),
    name: z.string().min(2, 'Nome obrigatório'),
    ...baseFields,
  }),
  z.object({
    type: z.literal('pj'),
    document: z.string().refine((v) => validateCNPJ(v), 'CNPJ inválido'),
    name: z.string().min(2, 'Razão social obrigatória'),
    responsible: z.string().optional().or(z.literal('')),
    ...baseFields,
  }),
])

export type CreateClientInput = z.infer<typeof createClientSchema>
export type ClientFormError = Record<string, string[]>

export const updateClientBrokerSchema = z.object({
  clientId: z.string().uuid(),
  assignedTo: z.string().uuid().optional(),
  partnerId: z.string().uuid().optional(),
}).refine(
  (d) => d.assignedTo || d.partnerId,
  { message: 'Informe corretor ou parceiro', path: ['assignedTo'] },
)
export type UpdateClientBrokerInput = z.infer<typeof updateClientBrokerSchema>

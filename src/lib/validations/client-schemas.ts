import { z } from 'zod'
import { validateCPF } from './cpf'
import { validateCNPJ } from './cnpj'

const baseFields = {
  assigned_to: z.string().uuid('Corretor responsável obrigatório'),
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

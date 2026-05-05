import { z } from 'zod'
import { validateCPF, stripCPF } from '@/lib/validations/cpf'

export const portalCadastroSchema = z.object({
  cpf: z
    .string()
    .transform(stripCPF)
    .refine((v) => v.length === 11, 'CPF deve ter 11 dígitos')
    .refine(validateCPF, 'CPF inválido'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  slug: z.string().min(1, 'Slug obrigatório'),
})

export const portalLoginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
  slug: z.string().min(1, 'Slug obrigatório'),
})

export type PortalFormError = {
  _form?: string[]
  [field: string]: string[] | undefined
}

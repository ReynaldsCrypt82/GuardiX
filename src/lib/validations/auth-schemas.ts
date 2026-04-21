import { z } from 'zod'
import { validateCNPJ, stripCNPJ } from '@/lib/validations/cnpj'

export const registerStep1Schema = z.object({
  cnpj: z
    .string()
    .transform(stripCNPJ)
    .refine((v) => v.length === 14, 'CNPJ deve ter 14 dígitos')
    .refine(validateCNPJ, 'CNPJ inválido. Verifique o número e tente novamente.'),
  companyName: z
    .string()
    .min(3, 'Razão social muito curta')
    .max(120, 'Máximo 120 caracteres'),
  segment: z.enum(['seguros', 'consorcio', 'ambos']),
})

export const registerStep2Schema = z
  .object({
    adminName: z
      .string()
      .min(3, 'Nome muito curto')
      .max(120, 'Máximo 120 caracteres'),
    email: z.string().email('E-mail inválido'),
    password: z
      .string()
      .min(8, 'A senha deve ter pelo menos 8 caracteres'),
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ['passwordConfirm'],
    message: 'As senhas não coincidem.',
  })

export const registerStep3Schema = z.object({
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'Você deve aceitar os termos para continuar.' }),
  }),
})

// Full schema for server-side validation of the combined wizard FormData
export const registerFullSchema = z
  .object({
    cnpj: z
      .string()
      .transform(stripCNPJ)
      .refine((v) => v.length === 14, 'CNPJ deve ter 14 dígitos')
      .refine(validateCNPJ, 'CNPJ inválido. Verifique o número e tente novamente.'),
    companyName: z
      .string()
      .min(3, 'Razão social muito curta')
      .max(120, 'Máximo 120 caracteres'),
    segment: z.enum(['seguros', 'consorcio', 'ambos']),
    adminName: z
      .string()
      .min(3, 'Nome muito curto')
      .max(120, 'Máximo 120 caracteres'),
    email: z.string().email('E-mail inválido'),
    password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
    passwordConfirm: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'Você deve aceitar os termos para continuar.' }),
    }),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ['passwordConfirm'],
    message: 'As senhas não coincidem.',
  })

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
})

export const inviteSchema = z.object({
  email: z.string().email('E-mail inválido'),
  role: z.enum(['admin', 'corretor', 'financeiro', 'visualizador']),
})

export const acceptInviteSchema = z
  .object({
    fullName: z.string().min(3, 'Nome muito curto').max(120, 'Máximo 120 caracteres'),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ['passwordConfirm'],
    message: 'As senhas não coincidem.',
  })

export type FormError = {
  _form?: string[]
  [field: string]: string[] | undefined
}

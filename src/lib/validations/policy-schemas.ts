import { z } from 'zod'
import { validateCNPJ } from '@/lib/validations/cnpj'

const coreFields = {
  policy_number: z.string().min(1, 'Número da apólice obrigatório'),
  insurer: z.string().min(2, 'Seguradora obrigatória'),
  vigencia_inicio: z.string().date('Data de início inválida'),
  vigencia_fim: z.string().date('Data de fim inválida'),
  premio_total: z.coerce.number().min(0, 'Prêmio inválido'),
  client_id: z.string().uuid('Cliente obrigatório'),
  assigned_to: z.string().uuid('Corretor obrigatório'),
  observacoes: z.string().optional(),
}

export const createPolicySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('auto'),
    ...coreFields,
    placa: z.string().min(7, 'Placa obrigatória'),
    chassi: z.string().optional(),
    marca_modelo: z.string().min(2, 'Marca/modelo obrigatório'),
    ano: z.coerce.number().int().min(1900).max(2100),
    valor_fipe: z.coerce.number().min(0),
    cobertura: z.enum(['basica', 'compreensiva']),
  }),
  z.object({
    type: z.literal('vida'),
    ...coreFields,
    valor_assegurado: z.coerce.number().min(0, 'Valor assegurado inválido'),
    beneficiarios: z.string().optional(), // JSON string serializado no FormData
  }),
  z.object({
    type: z.literal('residencial'),
    ...coreFields,
    endereco_imovel: z.string().min(5, 'Endereço do imóvel obrigatório'),
    valor_imovel: z.coerce.number().min(0, 'Valor do imóvel inválido'),
    tipo_imovel: z.enum(['proprio', 'alugado']),
    cobertura: z.string().optional(),
  }),
  z.object({
    type: z.literal('empresarial'),
    ...coreFields,
    cnpj_risco: z.string().refine((v) => validateCNPJ(v), 'CNPJ do risco inválido'),
    endereco_empresa: z.string().min(5, 'Endereço da empresa obrigatório'),
    tipo_atividade: z.string().min(2, 'Tipo de atividade obrigatório'),
    valor_patrimonial: z.coerce.number().min(0, 'Valor patrimonial inválido'),
  }),
  z.object({
    type: z.literal('saude'),
    ...coreFields,
    operadora: z.string().min(2, 'Operadora obrigatória'),
    numero_carteirinha: z.string().min(1, 'Número da carteirinha obrigatório'),
    acomodacao: z.enum(['enfermaria', 'apartamento']),
    dependentes: z.string().optional(), // JSON string serializado no FormData
  }),
  z.object({
    type: z.literal('outros'),
    ...coreFields,
  }),
])

export type CreatePolicyInput = z.infer<typeof createPolicySchema>

// updatePolicySchema: campos opcionais para PATCH + id obrigatório
// discriminatedUnion não suporta .partial() diretamente — usamos z.object com campos opcionais
export const updatePolicySchema = z.object({
  id: z.string().uuid(),
  policy_number: z.string().min(1).optional(),
  insurer: z.string().min(2).optional(),
  vigencia_inicio: z.string().date().optional(),
  vigencia_fim: z.string().date().optional(),
  premio_total: z.coerce.number().min(0).optional(),
  client_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  observacoes: z.string().optional(),
  type_data: z.record(z.unknown()).optional(),
})
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>

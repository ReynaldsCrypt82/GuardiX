'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { stripCPF } from '@/lib/validations/cpf'
import { stripCNPJ } from '@/lib/validations/cnpj'
import {
  createClientSchema,
  updateClientBrokerSchema,
  type ClientFormError,
} from '@/lib/validations/client-schemas'

export async function createClientAction(
  slug: string,
  formData: FormData,
): Promise<{ error?: ClientFormError; id?: string } | void> {
  const raw = Object.fromEntries(formData) as Record<string, unknown>
  const parsed = createClientSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as ClientFormError }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: { _form: ['Sessão expirada. Faça login novamente.'] } }
  }

  // Enforce: corretor só pode atribuir cliente a si mesmo (quando assigned_to estiver presente)
  // (defesa em profundidade; RLS clients_insert também bloqueia no banco)
  const role = (user.app_metadata as { role?: string })?.role
  if (role === 'corretor' && parsed.data.assigned_to && parsed.data.assigned_to !== user.id) {
    return { error: { assigned_to: ['Corretor só pode atribuir cliente a si mesmo.'] } }
  }

  const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
  if (!tenantId) {
    return { error: { _form: ['Tenant não identificado na sessão.'] } }
  }

  const strip = parsed.data.type === 'pf' ? stripCPF : stripCNPJ
  const base = {
    tenant_id: tenantId,
    type: parsed.data.type,
    document: strip(parsed.data.document),
    name: parsed.data.name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    assigned_to: parsed.data.assigned_to || null,
    partner_id: (parsed.data as { partner_id?: string }).partner_id || null,
  }
  const insertRow =
    parsed.data.type === 'pj'
      ? { ...base, responsible: parsed.data.responsible || null }
      : base

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any
  const { data, error } = await supabaseAny
    .from('clients')
    .insert(insertRow)
    .select('id')
    .single()

  if (error) {
    const code = (error as { code?: string }).code
    if (code === '23505') {
      return {
        error: { document: ['Este documento já está cadastrado nesta corretora.'] },
      }
    }
    return { error: { _form: ['Erro ao salvar cliente. Tente novamente.'] } }
  }

  revalidatePath(`/${slug}/clientes`)
  return { id: data.id }
}

export async function updateClientBrokerAction(input: {
  clientId: string
  assignedTo?: string
  partnerId?: string
  slug: string
}): Promise<{ error?: string }> {
  const parsed = updateClientBrokerSchema.safeParse({
    clientId: input.clientId,
    assignedTo: input.assignedTo,
    partnerId: input.partnerId,
  })
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão expirada' }

  const role = (user.app_metadata as { role?: string })?.role
  // Apenas admin pode alterar corretor/parceiro
  if (role !== 'admin') return { error: 'Apenas admin pode alterar corretor responsável' }

  // Buscar stage do cliente para verificar lock "Fechado"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any
  const { data: clientRow } = await supabaseAny
    .from('clients')
    .select('stage_id, stage:pipeline_stages!stage_id(name)')
    .eq('id', parsed.data.clientId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!clientRow) return { error: 'Cliente não encontrado' }

  const stageName = clientRow.stage?.name as string | undefined
  if (stageName === 'Fechado') {
    return { error: 'Corretor não pode ser alterado após o cliente ser Fechado' }
  }

  const { error: updateError } = await supabaseAny
    .from('clients')
    .update({
      assigned_to: parsed.data.assignedTo ?? null,
      partner_id: parsed.data.partnerId ?? null,
    })
    .eq('id', parsed.data.clientId)
    .is('deleted_at', null)

  if (updateError) return { error: 'Erro ao atualizar corretor/parceiro' }

  revalidatePath(`/${input.slug}/clientes/${input.clientId}`)
  revalidatePath(`/${input.slug}/clientes`)
  return {}
}

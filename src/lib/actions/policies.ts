'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createPolicySchema } from '@/lib/validations/policy-schemas'

export async function createPolicyAction(slug: string, formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>

  // Coerce numeric strings coming from FormData
  if (raw.premio_total !== undefined) raw.premio_total = Number(raw.premio_total)
  if (raw.ano !== undefined) raw.ano = Number(raw.ano)
  if (raw.valor_fipe !== undefined) raw.valor_fipe = Number(raw.valor_fipe)
  if (raw.valor_assegurado !== undefined) raw.valor_assegurado = Number(raw.valor_assegurado)
  if (raw.valor_imovel !== undefined) raw.valor_imovel = Number(raw.valor_imovel)
  if (raw.valor_patrimonial !== undefined) raw.valor_patrimonial = Number(raw.valor_patrimonial)

  const parsed = createPolicySchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessão expirada.'] } }

  // T-03-07: corretor só pode registrar apólice em seu próprio nome
  const role = (user.app_metadata as { role?: string })?.role
  if (role === 'corretor' && parsed.data.assigned_to !== user.id) {
    return { error: { assigned_to: ['Corretor só pode registrar apólice em seu próprio nome.'] } }
  }

  const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
  if (!tenantId) return { error: { _form: ['Tenant não identificado.'] } }

  // CRITICAL (Pitfall 1): desestruturar campos core explicitamente,
  // spread restante para type_data — nunca misturar campos core em type_data
  const {
    type,
    policy_number,
    insurer,
    vigencia_inicio,
    vigencia_fim,
    premio_total,
    client_id,
    assigned_to,
    observacoes,
    ...typeSpecific
  } = parsed.data

  const { data, error } = await supabase
    .from('policies')
    .insert({
      tenant_id: tenantId,
      type,
      policy_number,
      insurer,
      vigencia_inicio,
      vigencia_fim,
      premio_total,
      client_id,
      assigned_to,
      observacoes: observacoes || null,
      type_data: Object.keys(typeSpecific).length > 0 ? typeSpecific : {},
    })
    .select('id')
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return { error: { policy_number: ['Número de apólice já cadastrado nesta corretora.'] } }
    }
    return { error: { _form: ['Erro ao salvar apólice.'] } }
  }

  revalidatePath(`/${slug}/seguros`)
  revalidatePath(`/${slug}/clientes/${client_id}`)
  return { id: data.id }
}

export async function updatePolicyAction(slug: string, policyId: string, formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>
  if (raw.premio_total !== undefined) raw.premio_total = Number(raw.premio_total)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão expirada.' }

  const role = (user.app_metadata as { role?: string })?.role

  // Buscar apólice para verificar propriedade
  const { data: policy, error: fetchError } = await supabase
    .from('policies')
    .select('assigned_to')
    .eq('id', policyId)
    .is('deleted_at', null)
    .single()

  if (fetchError || !policy) return { error: 'Apólice não encontrada.' }

  // Corretor só pode editar apólice própria
  if (role === 'corretor' && policy.assigned_to !== user.id) {
    return { error: 'Sem permissão para editar esta apólice.' }
  }

  const { error } = await supabase
    .from('policies')
    .update({
      ...raw,
      updated_at: new Date().toISOString(),
    })
    .eq('id', policyId)

  if (error) return { error: 'Erro ao atualizar apólice.' }

  revalidatePath(`/${slug}/seguros`)
  revalidatePath(`/${slug}/seguros/${policyId}`)
  return { success: true }
}

export async function softDeletePolicyAction(slug: string, policyId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão expirada.' }

  const role = (user.app_metadata as { role?: string })?.role
  if (role !== 'admin') return { error: 'Apenas administradores podem arquivar apólices.' }

  const { error } = await supabase
    .from('policies')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', policyId)

  if (error) return { error: 'Erro ao arquivar apólice.' }

  revalidatePath(`/${slug}/seguros`)
  return { success: true }
}

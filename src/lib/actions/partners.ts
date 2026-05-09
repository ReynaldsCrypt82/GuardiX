'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createPartnerSchema,
  updatePartnerSchema,
} from '@/lib/validations/partner-schemas'
import { COMMISSION_OVERRIDE_KEYS } from '@/lib/validations/broker-schemas'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

function extractOverridesFromFormData(raw: Record<string, unknown>) {
  const overrides: Record<string, number> = {}
  for (const key of COMMISSION_OVERRIDE_KEYS) {
    const value = raw[`override_${key}`]
    if (value !== undefined && value !== '' && value !== null) {
      const num = Number(value)
      if (!Number.isNaN(num)) overrides[key] = num
    }
    delete raw[`override_${key}`]
  }
  return Object.keys(overrides).length > 0 ? overrides : undefined
}

/**
 * createPartnerAction — admin cadastra parceiro externo (D-04 / COM-02).
 */
export async function createPartnerAction(slug: string, formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>
  raw.commission_rate_overrides = extractOverridesFromFormData(raw)

  const parsed = createPartnerSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = (await createClient()) as AnySupabase
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessao expirada.'] } }

  const role = (user.app_metadata as { role?: string })?.role
  if (role !== 'admin') {
    return { error: { _form: ['Apenas administradores podem cadastrar parceiros.'] } }
  }

  const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
  if (!tenantId) return { error: { _form: ['Tenant nao identificado.'] } }

  const { data, error } = await supabase
    .from('partners')
    .insert({
      tenant_id: tenantId,
      name: parsed.data.name,
      cnpj: parsed.data.cnpj || null,
      contact_email: parsed.data.contact_email || null,
      contact_phone: parsed.data.contact_phone || null,
      commission_rate_default: parsed.data.commission_rate_default,
      commission_rate_overrides: parsed.data.commission_rate_overrides ?? {},
    })
    .select('id')
    .single()

  if (error) {
    return { error: { _form: ['Erro ao cadastrar parceiro.'] } }
  }

  revalidatePath(`/${slug}/parceiros`)
  return { id: (data as { id: string }).id }
}

export async function updatePartnerAction(slug: string, partnerId: string, formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>
  raw.commission_rate_overrides = extractOverridesFromFormData(raw)

  const parsed = updatePartnerSchema.safeParse({ id: partnerId, ...raw })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = (await createClient()) as AnySupabase
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessao expirada.'] } }

  const role = (user.app_metadata as { role?: string })?.role
  if (role !== 'admin') {
    return { error: { _form: ['Apenas administradores podem editar parceiros.'] } }
  }

  const { id: _id, ...updateData } = parsed.data
  const { error } = await supabase
    .from('partners')
    .update(updateData)
    .eq('id', partnerId)

  if (error) return { error: { _form: ['Erro ao atualizar parceiro.'] } }

  revalidatePath(`/${slug}/parceiros`)
  return { success: true }
}

export async function softDeletePartnerAction(slug: string, partnerId: string) {
  const supabase = (await createClient()) as AnySupabase
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessao expirada.' }

  const role = (user.app_metadata as { role?: string })?.role
  if (role !== 'admin') return { error: 'Apenas administradores podem excluir parceiros.' }

  const { error, count } = await supabase
    .from('partners')
    .update({ deleted_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', partnerId)

  if (error) return { error: `Erro ao excluir parceiro: ${error.message}` }
  if (count === 0) return { error: 'Parceiro não encontrado ou já excluído.' }

  revalidatePath(`/${slug}/parceiros`)
  return { success: true }
}

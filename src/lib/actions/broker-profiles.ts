'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  upsertBrokerProfileSchema,
  COMMISSION_OVERRIDE_KEYS,
} from '@/lib/validations/broker-schemas'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

/**
 * upsertBrokerProfileAction — admin completa/atualiza o perfil de corretor (D-03 admin-only).
 * Implementa COM-01: cadastrar corretor interno com SUSEP, metas, taxa de comissao.
 * Recebe FormData com profile_id (id do profile do corretor) + campos de negocio.
 * commission_rate_overrides eh reconstruido a partir de campos override_<key> no FormData.
 */
export async function upsertBrokerProfileAction(slug: string, formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>

  // Reconstruir commission_rate_overrides a partir dos campos override_<key> no FormData
  // (UI-SPEC: Dialog renderiza 9 inputs, um por chave de produto)
  const overrides: Record<string, number> = {}
  for (const key of COMMISSION_OVERRIDE_KEYS) {
    const value = raw[`override_${key}`]
    if (value !== undefined && value !== '' && value !== null) {
      const num = Number(value)
      if (!Number.isNaN(num)) {
        overrides[key] = num
      }
    }
    // Limpa o campo override_<key> do raw antes do safeParse para evitar conflito
    delete raw[`override_${key}`]
  }
  raw.commission_rate_overrides = Object.keys(overrides).length > 0 ? overrides : undefined

  const parsed = upsertBrokerProfileSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = (await createClient()) as AnySupabase
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessao expirada.'] } }

  // T-04-01: D-03 — apenas admin pode criar/editar broker_profiles
  const role = (user.app_metadata as { role?: string })?.role
  if (role !== 'admin') {
    return { error: { _form: ['Apenas administradores podem editar perfis de corretor.'] } }
  }

  // T-04-03: tenant_id sempre do JWT — nunca do FormData
  const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
  if (!tenantId) return { error: { _form: ['Tenant nao identificado.'] } }

  const { error } = await supabase
    .from('broker_profiles')
    .upsert({
      id: parsed.data.profile_id,
      tenant_id: tenantId,
      susep_number: parsed.data.susep_number || null,
      monthly_goal: parsed.data.monthly_goal,
      commission_rate_default: parsed.data.commission_rate_default,
      commission_rate_renovacao: parsed.data.commission_rate_renovacao ?? null,
      commission_rate_overrides: parsed.data.commission_rate_overrides ?? {},
    }, { onConflict: 'id' })

  if (error) {
    return { error: { _form: ['Erro ao salvar perfil de corretor.'] } }
  }

  revalidatePath(`/${slug}/corretores`)
  revalidatePath(`/${slug}/corretores/${parsed.data.profile_id}`)
  return { success: true }
}

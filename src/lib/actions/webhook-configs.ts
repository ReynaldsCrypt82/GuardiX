'use server'
// Phase 07 Plan 02 — Server Actions para webhook_configs
// RBAC: apenas admin. T-07-SSRF: validado via webhookConfigSchema.refine(isUrlSafe).
// D-03: sem retry. AUTO-01 compliance.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { webhookConfigSchema } from '@/lib/validations/automation-schemas'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

const ADMIN_ROLE = 'admin'

/**
 * createWebhookConfigAction — AUTO-01
 * Cria configuracao de webhook por event_type no tenant do admin autenticado.
 * UNIQUE (tenant_id, event_type) WHERE deleted_at IS NULL — erro 23505 se ja existe.
 */
export async function createWebhookConfigAction(slug: string, formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>

  // Normalizar days_before vazio -> undefined (FormData manda string vazia)
  if (raw.days_before === '' || raw.days_before === undefined) raw.days_before = undefined

  const parsed = webhookConfigSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = (await createClient()) as AnySupabase
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessao expirada.'] } }

  const role = (user.app_metadata as { role?: string })?.role
  if (role !== ADMIN_ROLE) return { error: { _form: ['Apenas admin pode configurar webhooks.'] } }

  const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
  if (!tenantId) return { error: { _form: ['Tenant nao identificado.'] } }

  const { data, error } = await supabase
    .from('webhook_configs')
    .insert({
      tenant_id: tenantId,
      event_type: parsed.data.event_type,
      url: parsed.data.url,
      days_before: parsed.data.days_before ?? null,
      active: parsed.data.active,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return { error: { _form: ['Ja existe webhook configurado para este evento. Use atualizar.'] } }
    }
    return { error: { _form: ['Erro ao salvar webhook.'] } }
  }

  revalidatePath(`/${slug}/configuracoes/automacoes`)
  return { success: true, config_id: (data as { id: string }).id }
}

/**
 * updateWebhookConfigAction — AUTO-01
 * Atualiza url, days_before e active de um webhook existente (por id + RLS tenant_id).
 */
export async function updateWebhookConfigAction(
  slug: string,
  configId: string,
  formData: FormData,
) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>
  if (raw.days_before === '' || raw.days_before === undefined) raw.days_before = undefined

  const parsed = webhookConfigSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = (await createClient()) as AnySupabase
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessao expirada.'] } }

  if ((user.app_metadata as { role?: string })?.role !== ADMIN_ROLE) {
    return { error: { _form: ['Apenas admin pode atualizar webhooks.'] } }
  }

  const { error } = await supabase
    .from('webhook_configs')
    .update({
      url: parsed.data.url,
      days_before: parsed.data.days_before ?? null,
      active: parsed.data.active,
    })
    .eq('id', configId)
    .is('deleted_at', null)

  if (error) return { error: { _form: ['Erro ao atualizar webhook.'] } }

  revalidatePath(`/${slug}/configuracoes/automacoes`)
  return { success: true }
}

/**
 * softDeleteWebhookConfigAction — D-12 padrao Phase 1 (soft delete)
 * Marca deleted_at=NOW() no registro; UNIQUE partial index se torna liberado para novo config.
 */
export async function softDeleteWebhookConfigAction(slug: string, configId: string) {
  const supabase = (await createClient()) as AnySupabase
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessao expirada.'] } }

  if ((user.app_metadata as { role?: string })?.role !== ADMIN_ROLE) {
    return { error: { _form: ['Apenas admin pode excluir webhooks.'] } }
  }

  const { error } = await supabase
    .from('webhook_configs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', configId)
    .is('deleted_at', null)

  if (error) return { error: { _form: ['Erro ao excluir webhook.'] } }

  revalidatePath(`/${slug}/configuracoes/automacoes`)
  return { success: true }
}

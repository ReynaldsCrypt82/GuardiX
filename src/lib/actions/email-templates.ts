'use server'
// Phase 07 Plan 02 — Server Actions para email_templates
// RBAC: apenas admin. AUTO-03 compliance (D-06: templates personalizaveis por tenant).

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { emailTemplateSchema } from '@/lib/validations/automation-schemas'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

const ADMIN_ROLE = 'admin'

/**
 * upsertEmailTemplateAction — AUTO-03 / D-06
 * Insert ou Update do template de email por event_type no tenant.
 * UNIQUE (tenant_id, event_type) WHERE deleted_at IS NULL — se existe, UPDATE; senao INSERT.
 * Subject minimo 3 chars, body_html minimo 10 chars (emailTemplateSchema).
 */
export async function upsertEmailTemplateAction(slug: string, formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>

  const parsed = emailTemplateSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = (await createClient()) as AnySupabase
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessao expirada.'] } }

  if ((user.app_metadata as { role?: string })?.role !== ADMIN_ROLE) {
    return { error: { _form: ['Apenas admin pode configurar templates de email.'] } }
  }

  const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
  if (!tenantId) return { error: { _form: ['Tenant nao identificado.'] } }

  // Verificar se ja existe template ativo para este event_type no tenant
  const { data: existing } = await supabase
    .from('email_templates')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('event_type', parsed.data.event_type)
    .is('deleted_at', null)
    .maybeSingle()

  if (existing) {
    // UPDATE
    const { error } = await supabase
      .from('email_templates')
      .update({
        subject: parsed.data.subject,
        body_html: parsed.data.body_html,
        active: parsed.data.active,
      })
      .eq('id', (existing as { id: string }).id)
      .is('deleted_at', null)

    if (error) return { error: { _form: ['Erro ao atualizar template.'] } }
  } else {
    // INSERT
    const { error } = await supabase.from('email_templates').insert({
      tenant_id: tenantId,
      event_type: parsed.data.event_type,
      subject: parsed.data.subject,
      body_html: parsed.data.body_html,
      active: parsed.data.active,
      created_by: user.id,
    })

    if (error) return { error: { _form: ['Erro ao criar template.'] } }
  }

  revalidatePath(`/${slug}/configuracoes/automacoes`)
  return { success: true }
}

/**
 * softDeleteEmailTemplateAction — D-12 padrao Phase 1 (soft delete)
 * Marca deleted_at=NOW() no template; UNIQUE partial index liberado para nova configuracao.
 */
export async function softDeleteEmailTemplateAction(slug: string, templateId: string) {
  const supabase = (await createClient()) as AnySupabase
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessao expirada.'] } }

  if ((user.app_metadata as { role?: string })?.role !== ADMIN_ROLE) {
    return { error: { _form: ['Apenas admin pode excluir templates.'] } }
  }

  const { error } = await supabase
    .from('email_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', templateId)
    .is('deleted_at', null)

  if (error) return { error: { _form: ['Erro ao excluir template.'] } }

  revalidatePath(`/${slug}/configuracoes/automacoes`)
  return { success: true }
}

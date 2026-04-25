'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createQuotaSchema,
  updateQuotaContemplationSchema,
} from '@/lib/validations/consortium-schemas'
import { z } from 'zod'

export async function createQuotaAction(
  slug: string,
  groupId: string,
  formData: FormData,
) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>

  // Inject groupId into validation (group_id comes from route, not FormData)
  const parsed = createQuotaSchema.safeParse({ ...raw, group_id: groupId })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessão expirada.'] } }

  // T-03-12: Guard — corretor só pode registrar cota em seu próprio nome
  const role = (user.app_metadata as { role?: string })?.role
  if (role === 'corretor' && parsed.data.assigned_to !== user.id) {
    return { error: { assigned_to: ['Corretor só pode registrar cota em seu próprio nome.'] } }
  }

  // T-03-14: tenant_id sempre do JWT — nunca do FormData
  const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
  if (!tenantId) return { error: { _form: ['Tenant não identificado.'] } }

  const { data, error } = await supabase
    .from('consortium_quotas')
    .insert({
      tenant_id: tenantId,
      group_id: parsed.data.group_id,
      client_id: parsed.data.client_id,
      assigned_to: parsed.data.assigned_to,
      quota_number: parsed.data.quota_number,
      monthly_payment: parsed.data.monthly_payment,
      status: 'ativo',
    })
    .select('id')
    .single()

  if (error) {
    const code = (error as { code?: string }).code
    if (code === '23505') {
      return { error: { quota_number: ['Número de cota já cadastrado neste grupo.'] } }
    }
    return { error: { _form: ['Erro ao salvar cota.'] } }
  }

  revalidatePath(`/${slug}/consorcio/${groupId}`)
  return { id: data.id }
}

export async function updateQuotaContemplationAction(
  slug: string,
  groupId: string,
  formData: FormData,
) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>

  // T-03-13: Zod discriminatedUnion valida estritamente 'sorteio'/'lance'
  // Coerce lance_value como number se presente
  if (raw.lance_value !== undefined && raw.lance_value !== '') {
    raw.lance_value = Number(raw.lance_value)
  }

  const parsed = updateQuotaContemplationSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessão expirada.'] } }

  const role = (user.app_metadata as { role?: string })?.role
  if (!['admin', 'corretor'].includes(role ?? '')) {
    return { error: { _form: ['Sem permissão para registrar contemplação.'] } }
  }

  const {
    contemplation_type,
    contemplation_date,
    post_contemplation_stage,
    post_contemplation_notes,
    quota_id,
  } = parsed.data

  // lance_value: preservado para tipo='lance', null para tipo='sorteio'
  const lance_value =
    contemplation_type === 'lance' ? (parsed.data as { lance_value?: number }).lance_value : null

  const { error } = await supabase
    .from('consortium_quotas')
    .update({
      status: 'contemplado',
      contemplation_date,
      contemplation_type,
      lance_value: lance_value ?? null,
      post_contemplation_stage: post_contemplation_stage ?? 'aguardando_docs',
      post_contemplation_notes: post_contemplation_notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quota_id)

  if (error) return { error: { _form: ['Erro ao registrar contemplação.'] } }

  revalidatePath(`/${slug}/consorcio/${groupId}`)
  return { success: true }
}

const updateStageSchema = z.object({
  quota_id: z.string().uuid(),
  stage: z.enum(['aguardando_docs', 'em_analise', 'credito_liberado']),
  notes: z.string().optional(),
})

export async function updateQuotaStageAction(
  slug: string,
  groupId: string,
  formData: FormData,
) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>
  const parsed = updateStageSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessão expirada.'] } }

  const role = (user.app_metadata as { role?: string })?.role
  if (!['admin', 'corretor'].includes(role ?? '')) {
    return { error: { _form: ['Sem permissão para atualizar estágio pós-contemplação.'] } }
  }

  // T-03-16: Se corretor, verificar que a cota é dele (defense-in-depth além do RLS)
  if (role === 'corretor') {
    const { data: quota } = await supabase
      .from('consortium_quotas')
      .select('assigned_to')
      .eq('id', parsed.data.quota_id)
      .maybeSingle()
    if (!quota || quota.assigned_to !== user.id) {
      return { error: { _form: ['Corretor só pode atualizar cotas próprias.'] } }
    }
  }

  const { error } = await supabase
    .from('consortium_quotas')
    .update({
      post_contemplation_stage: parsed.data.stage,
      post_contemplation_notes: parsed.data.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.quota_id)

  if (error) return { error: { _form: ['Erro ao atualizar estágio.'] } }

  revalidatePath(`/${slug}/consorcio/${groupId}`)
  return { success: true }
}

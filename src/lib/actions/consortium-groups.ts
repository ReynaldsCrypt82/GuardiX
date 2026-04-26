'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createGroupSchema, updateGroupSchema } from '@/lib/validations/consortium-schemas'

export async function createGroupAction(slug: string, formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>

  // Normalizar next_assembly_date: string vazia → null (Pitfall: null vs empty string)
  if (raw.next_assembly_date === '') raw.next_assembly_date = null

  const parsed = createGroupSchema.safeParse(raw)
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
    return { error: { _form: ['Sem permissão para criar grupos de consórcio.'] } }
  }

  // T-03-14: tenant_id sempre do JWT — nunca do FormData
  const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
  if (!tenantId) return { error: { _form: ['Tenant não identificado.'] } }

  const { data, error } = await supabase
    .from('consortium_groups')
    .insert({
      tenant_id: tenantId,
      administrator: parsed.data.administrator,
      type: parsed.data.type,
      credit_value: parsed.data.credit_value,
      term_months: parsed.data.term_months,
      start_date: parsed.data.start_date,
      total_quotas: parsed.data.total_quotas,
      next_assembly_date: parsed.data.next_assembly_date ?? null,
    })
    .select('id')
    .single()

  if (error) return { error: { _form: ['Erro ao salvar grupo de consórcio.'] } }

  revalidatePath(`/${slug}/consorcio`)
  return { id: data.id }
}

export async function updateGroupAction(
  slug: string,
  groupId: string,
  formData: FormData,
) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>

  // Normalizar next_assembly_date vazio → null (CON-05 — campo nullable)
  if (raw.next_assembly_date === '') raw.next_assembly_date = null

  const parsed = updateGroupSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>
    const firstKey = Object.keys(fieldErrors)[0]
    const firstMsg = firstKey ? fieldErrors[firstKey]?.[0] : 'Dados inválidos.'
    return { error: firstMsg ?? 'Dados inválidos.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão expirada.' }

  const role = (user.app_metadata as { role?: string })?.role
  if (!['admin', 'corretor'].includes(role ?? '')) {
    return { error: 'Sem permissão para editar grupos.' }
  }

  const { error } = await supabase
    .from('consortium_groups')
    .update({
      administrator: parsed.data.administrator,
      type: parsed.data.type,
      credit_value: parsed.data.credit_value,
      term_months: parsed.data.term_months,
      total_quotas: parsed.data.total_quotas,
      next_assembly_date: parsed.data.next_assembly_date ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', groupId)
    .is('deleted_at', null) // Defensive — RLS already enforces tenant isolation

  if (error) return { error: 'Erro ao atualizar grupo.' }

  revalidatePath(`/${slug}/consorcio`)
  revalidatePath(`/${slug}/consorcio/${groupId}`)
  return { success: true }
}

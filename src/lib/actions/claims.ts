'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClaimSchema } from '@/lib/validations/claim-schemas'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

export async function createClaimAction(slug: string, formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>
  const parsed = createClaimSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = (await createClient()) as AnySupabase
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessão expirada.'] } }

  const role = (user.app_metadata as { role?: string })?.role
  if (!['admin', 'corretor'].includes(role ?? '')) {
    return { error: { _form: ['Sem permissão para registrar sinistros.'] } }
  }

  // CRITICAL (Pitfall 4): tenant_id SEMPRE do JWT, nunca do FormData
  const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
  if (!tenantId) return { error: { _form: ['Tenant não identificado.'] } }

  const { data, error } = await supabase
    .from('claims')
    .insert({
      tenant_id: tenantId,
      policy_id: parsed.data.policy_id,
      claim_date: parsed.data.claim_date,
      type: parsed.data.type,
      protocol_number: parsed.data.protocol_number || null,
      status: parsed.data.status,
      description: parsed.data.description,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: { _form: ['Erro ao registrar sinistro.'] } }

  revalidatePath(`/${slug}/seguros/${parsed.data.policy_id}`)
  return { id: (data as { id: string }).id }
}

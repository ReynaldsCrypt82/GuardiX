'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createEndorsementSchema } from '@/lib/validations/endorsement-schemas'

export async function createEndorsementAction(slug: string, formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>

  // Coerce premium_impact: string '' or missing → undefined (nullable in schema)
  if (raw.premium_impact === '' || raw.premium_impact === undefined) {
    delete raw.premium_impact
  } else {
    raw.premium_impact = Number(raw.premium_impact)
  }

  const parsed = createEndorsementSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: { _form: ['Sessão expirada.'] } }

  const role = (user.app_metadata as { role?: string })?.role
  if (!['admin', 'corretor'].includes(role ?? '')) {
    return { error: { _form: ['Sem permissão para registrar endossos.'] } }
  }

  const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
  if (!tenantId) return { error: { _form: ['Tenant não identificado.'] } }

  const { data, error } = await supabase
    .from('endorsements')
    .insert({
      tenant_id: tenantId,
      policy_id: parsed.data.policy_id,
      endorsement_date: parsed.data.endorsement_date,
      type: parsed.data.type,
      description: parsed.data.description,
      premium_impact: parsed.data.premium_impact ?? null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: { _form: ['Erro ao registrar endosso.'] } }

  revalidatePath(`/${slug}/seguros/${parsed.data.policy_id}`)
  return { id: data.id }
}

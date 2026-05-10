'use server'
import { createClient } from '@/lib/supabase/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

export interface ClientSearchResult {
  id: string
  name: string
  document: string | null
}

export async function searchClientsAction(
  slug: string,
  query: string,
): Promise<ClientSearchResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const supabase = (await createClient()) as AnySupabase
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const tenantId = (user.app_metadata as { tenant_id?: string })?.tenant_id
  if (!tenantId) return []

  // Escape % e _ para evitar wildcard injection no ilike
  const safe = trimmed.replace(/[%_]/g, (c: string) => `\\${c}`)

  const { data, error } = await supabase
    .from('clients')
    .select('id, name, document')
    .eq('tenant_id', tenantId)
    .ilike('name', `%${safe}%`)
    .is('deleted_at', null)
    .order('name')
    .limit(20)

  if (error || !data) return []
  return data as ClientSearchResult[]

  // Nota: parametro `slug` mantido na assinatura (compat com chamadas que ja
  // passam slug do contexto de tenant). RLS + tenant_id do JWT ja isolam o
  // tenant correto independente do slug.
}

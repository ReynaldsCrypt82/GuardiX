import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NewClientForm } from './new-client-form'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function NovoClientePage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  // Carregar corretores disponíveis do tenant corrente (passam por RLS de profiles)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any
  const { data: corretores } = await supabaseAny
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['admin', 'corretor'])
    .eq('active', true)
    .is('deleted_at', null)
    .order('full_name')

  // Carregar parceiros externos do tenant (UAT Issue #1)
  const { data: parceiros } = await supabaseAny
    .from('partners')
    .select('id, name')
    .is('deleted_at', null)
    .order('name')

  const userRole = (user.app_metadata as { role?: string })?.role
  const defaultAssignedTo =
    userRole === 'corretor' ? user.id : (corretores?.[0]?.id ?? '')
  const corretorLockedToSelf = userRole === 'corretor'

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">Novo Cliente</h1>
      <NewClientForm
        slug={slug}
        corretores={corretores ?? []}
        parceiros={parceiros ?? []}
        defaultAssignedTo={defaultAssignedTo}
        lockAssignedToSelf={corretorLockedToSelf}
      />
    </div>
  )
}

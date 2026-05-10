import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PolicyForm } from './policy-form'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function NovaPolicePage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const role = (user.app_metadata as { role?: string })?.role ?? ''

  const { data: corretores } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['admin', 'corretor'])
    .eq('active', true)
    .is('deleted_at', null)
    .order('full_name')

  const defaultAssignedTo = role === 'corretor' ? user.id : ''
  const lockAssignedToSelf = role === 'corretor'

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova Apólice</h1>
        <p className="text-sm text-muted-foreground">Preencha os dados da apólice de seguro.</p>
      </div>
      <PolicyForm
        slug={slug}
        corretores={corretores ?? []}
        defaultAssignedTo={defaultAssignedTo}
        lockAssignedToSelf={lockAssignedToSelf}
      />
    </div>
  )
}

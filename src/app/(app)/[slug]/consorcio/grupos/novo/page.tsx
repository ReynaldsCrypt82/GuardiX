import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GroupForm } from './group-form'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function NovoGrupoPage({ params }: Props) {
  const { slug } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Novo Grupo de Consórcio</h1>
        <p className="text-sm text-muted-foreground">
          Preencha os dados do grupo para cadastrá-lo.
        </p>
      </div>

      <GroupForm slug={slug} />
    </div>
  )
}

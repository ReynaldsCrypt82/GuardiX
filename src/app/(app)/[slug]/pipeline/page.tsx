import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from './kanban-board'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function PipelinePage({ params }: Props) {
  const { slug } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const role = (user.app_metadata as { role?: string })?.role ?? ''
  if (role === 'visualizador') notFound()

  const [{ data: stages }, { data: clients }] = await Promise.all([
    supabase
      .from('pipeline_stages')
      .select('id, name, color, position, is_closed')
      .is('deleted_at', null)
      .order('position'),
    supabase
      .from('clients')
      .select('id, name, type, document, stage_id, assigned_to:profiles!clients_assigned_to_fkey(full_name)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  ])

  if (!stages || stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <p className="text-lg font-semibold">Nenhuma etapa de pipeline configurada</p>
        <p className="text-sm text-muted-foreground">
          Configure as etapas em{' '}
          <Link href={`/${slug}/configuracoes/pipeline`} className="text-primary underline">
            Configurações → Pipeline
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-6 h-full">
      <div>
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          {clients?.length ?? 0} cliente(s) no funil
        </p>
      </div>
      <KanbanBoard
        slug={slug}
        stages={stages ?? []}
        clients={clients ?? []}
        canEdit={role === 'admin' || role === 'corretor' || role === 'financeiro'}
      />
    </div>
  )
}

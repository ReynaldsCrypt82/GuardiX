import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StagesManager } from './stages-manager'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function PipelinePage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  // Guard de role — apenas admin acessa esta tela (D-09, T-02-21)
  const role = (user.app_metadata as { role?: string }).role
  if (role !== 'admin') {
    redirect(`/${slug}/dashboard`)
  }

  // Buscar estágios ativos do tenant (RLS filtra por tenant)
  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('id, name, color, position, is_closed')
    .is('deleted_at', null)
    .order('position', { ascending: true })

  const activeStages = stages ?? []

  // Buscar contagem de clientes por estágio (loop simples — 4-6 queries rápidas para v1)
  const stagesWithCounts = await Promise.all(
    activeStages.map(async (stage) => {
      const { count } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('stage_id', stage.id)
        .is('deleted_at', null)
      return { ...stage, clientCount: count ?? 0 }
    })
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Configurações do Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie os estágios do funil de vendas da sua corretora.
        </p>
      </header>

      <StagesManager slug={slug} stages={stagesWithCounts} />
    </div>
  )
}

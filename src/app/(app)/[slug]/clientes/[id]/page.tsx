import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PolicyTab } from './policy-tab'
import { ConsortiumTab } from './consortium-tab'

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id: clientId } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  // Busca dados completos do cliente (RLS garante isolamento por tenant — T-03-17)
  const { data: client } = await supabase
    .from('clients')
    .select(
      '*, stage:pipeline_stages(name, color), profile:profiles!assigned_to(full_name)',
    )
    .eq('id', clientId)
    .is('deleted_at', null)
    .single()

  if (!client) notFound()

  // Busca apólices do cliente — RLS policies_select garante tenant (T-03-18)
  const { data: policies } = await supabase
    .from('policies')
    .select('id, policy_number, type, insurer, vigencia_fim, premio_total')
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('vigencia_fim', { ascending: true })

  // Busca cotas do cliente — RLS consortium_quotas_select garante tenant (T-03-18)
  const { data: quotas } = await supabase
    .from('consortium_quotas')
    .select(
      'id, quota_number, monthly_payment, status, contemplation_date, post_contemplation_stage, group:consortium_groups(id, administrator, type, credit_value)',
    )
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  // Busca interações (Timeline) — client_interactions não tem deleted_at
  const { data: interactions } = await supabase
    .from('client_interactions')
    .select('id, type, occurred_at, description')
    .eq('client_id', clientId)
    .order('occurred_at', { ascending: false })

  // Busca tarefas (Tasks tab)
  const { data: tasks } = await supabase
    .from('client_tasks')
    .select('id, description, due_date, completed_at')
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('due_date', { ascending: true })

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* Header card com dados do cliente */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{client.name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {client.type === 'pf'
                  ? String(client.document ?? '').replace(
                      /(\d{3})(\d{3})(\d{3})(\d{2})/,
                      '$1.$2.$3-$4',
                    )
                  : String(client.document ?? '').replace(
                      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
                      '$1.$2.$3/$4-$5',
                    )}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <Badge variant="outline">
                {client.type === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'}
              </Badge>
              {client.stage && (
                <Badge
                  style={{
                    backgroundColor: client.stage.color + '20',
                    color: client.stage.color,
                    borderColor: client.stage.color + '50',
                  }}
                  variant="outline"
                >
                  {client.stage.name}
                </Badge>
              )}
            </div>
          </div>
          <div className="text-sm text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {client.profile?.full_name && (
              <span>Corretor: {client.profile.full_name}</span>
            )}
            {client.email && <span>{client.email}</span>}
            {client.phone && <span>{client.phone}</span>}
          </div>
        </CardHeader>
      </Card>

      {/* Abas: Dados | Timeline | Tarefas | Apólices | Consórcio */}
      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="timeline">
            Timeline{' '}
            {interactions && interactions.length > 0 && `(${interactions.length})`}
          </TabsTrigger>
          <TabsTrigger value="tarefas">
            Tarefas {tasks && tasks.length > 0 && `(${tasks.length})`}
          </TabsTrigger>
          <TabsTrigger value="apolices">
            Apólices {policies && policies.length > 0 && `(${policies.length})`}
          </TabsTrigger>
          <TabsTrigger value="consorcio">
            Consórcio {quotas && quotas.length > 0 && `(${quotas.length})`}
          </TabsTrigger>
        </TabsList>

        {/* Aba Dados */}
        <TabsContent value="dados">
          <Card>
            <CardContent className="pt-4 space-y-2">
              {client.type === 'pj' && client.responsible && (
                <p className="text-sm">
                  <span className="font-medium">Responsável:</span> {client.responsible}
                </p>
              )}
              {client.address && (
                <p className="text-sm">
                  <span className="font-medium">Endereço:</span>{' '}
                  {typeof client.address === 'object' &&
                  (client.address as Record<string, string>).logradouro
                    ? `${(client.address as Record<string, string>).logradouro}, ${(client.address as Record<string, string>).cidade} — ${(client.address as Record<string, string>).uf}`
                    : JSON.stringify(client.address)}
                </p>
              )}
              {!client.responsible && !client.address && (
                <p className="text-sm text-muted-foreground">
                  Nenhum dado adicional cadastrado.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Timeline */}
        <TabsContent value="timeline">
          <Card>
            <CardContent className="pt-4">
              {!interactions || interactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma interação registrada.
                </p>
              ) : (
                <ul className="space-y-3">
                  {interactions.map(
                    (i: {
                      id: string
                      type: string
                      occurred_at: string
                      description: string
                    }) => (
                      <li key={i.id} className="text-sm border-l-2 pl-3 py-1">
                        <span className="font-medium capitalize">{i.type}</span>{' '}
                        <span className="text-muted-foreground">
                          {new Date(i.occurred_at).toLocaleDateString('pt-BR')}
                        </span>
                        <p className="mt-0.5 text-muted-foreground">{i.description}</p>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Tarefas */}
        <TabsContent value="tarefas">
          <Card>
            <CardContent className="pt-4">
              {!tasks || tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma tarefa cadastrada.
                </p>
              ) : (
                <ul className="space-y-3">
                  {tasks.map(
                    (t: {
                      id: string
                      description: string
                      due_date: string
                      completed_at: string | null
                    }) => (
                      <li key={t.id} className="text-sm border-l-2 pl-3 py-1">
                        <span
                          className={
                            t.completed_at
                              ? 'line-through text-muted-foreground'
                              : 'font-medium'
                          }
                        >
                          {t.description}
                        </span>
                        <span className="text-muted-foreground ml-2">
                          Prazo:{' '}
                          {new Date(t.due_date).toLocaleDateString('pt-BR')}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Apólices */}
        <TabsContent value="apolices">
          <PolicyTab policies={policies ?? []} slug={slug} />
        </TabsContent>

        {/* Aba Consórcio */}
        <TabsContent value="consorcio">
          <ConsortiumTab quotas={quotas ?? []} slug={slug} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

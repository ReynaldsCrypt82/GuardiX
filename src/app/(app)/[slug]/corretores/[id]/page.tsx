import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/corretores/stat-card'
import { MonthSelector } from '@/components/corretores/month-selector'
import { CommissionTable, type CommissionEntryRow } from '@/components/corretores/commission-table'
import { startOfMonth, endOfMonth, format, parse } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Props {
  params: Promise<{ slug: string; id: string }>
  searchParams: Promise<{ month?: string }> // YYYY-MM
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default async function BrokerDashboardPage({ params, searchParams }: Props) {
  const { slug, id } = await params
  const sp = await searchParams
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  // === D-11: redirect quando corretor tenta acessar dashboard de outro corretor (T-04-04) ===
  const role = (user.app_metadata as { role?: string })?.role
  if (role === 'corretor' && id !== user.id) {
    redirect(`/${slug}/corretores/${user.id}`)
  }

  // === Mes selecionado: default = mes corrente; ?month=YYYY-MM permite override ===
  const today = new Date()
  const selectedMonthStart = sp.month
    ? parse(sp.month + '-01', 'yyyy-MM-dd', today)
    : startOfMonth(today)
  const monthStartStr = format(startOfMonth(selectedMonthStart), 'yyyy-MM-dd')
  const monthEndStr = format(endOfMonth(selectedMonthStart), 'yyyy-MM-dd')
  const referenceMonth = monthStartStr // primeiro dia do mes (canonico para reference_month)
  const monthLabel = format(selectedMonthStart, 'MMMM yyyy', { locale: ptBR })
  const monthValue = format(selectedMonthStart, 'yyyy-MM')

  // === 1. Buscar profile do broker e broker_profile ===
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', id)
    .maybeSingle()

  if (!profile || profile.role !== 'corretor') notFound()

  // email vem de auth.users (não existe na tabela profiles)
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const adminClient = createAdminClient()
  const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(id)
  const brokerEmail = authUser?.email ?? null

  const { data: brokerProfile } = await supabase
    .from('broker_profiles')
    .select('susep_number, monthly_goal, commission_rate_default, commission_rate_overrides')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  const monthlyGoal = (brokerProfile?.monthly_goal ?? 0) as number

  // === 2. Producao do mes: count policies onde assigned_to=id E created_at no mes selecionado ===
  const { count: productionCount } = await supabase
    .from('policies')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', id)
    .gte('created_at', monthStartStr)
    .lte('created_at', monthEndStr + 'T23:59:59')
    .is('deleted_at', null)

  // === 3. Comissao acumulada: soma amount em commission_entries do mes selecionado ===
  const { data: commissionData } = await supabase
    .from('commission_entries')
    .select('amount')
    .eq('broker_id', id)
    .eq('reference_month', referenceMonth)

  const totalCommission = ((commissionData ?? []) as { amount: number }[]).reduce(
    (sum, e) => sum + (e.amount ?? 0),
    0,
  )

  // === 4. Carteira ativa: clients distintos com policies OU consortium_quotas ativas (Pitfall 5) ===
  const [policyClientsRes, quotaClientsRes] = await Promise.all([
    supabase.from('policies').select('client_id').eq('assigned_to', id).is('deleted_at', null),
    supabase
      .from('consortium_quotas')
      .select('client_id')
      .eq('assigned_to', id)
      .is('deleted_at', null),
  ])
  const uniqueClients = new Set<string>()
  for (const r of ((policyClientsRes.data ?? []) as { client_id: string }[])) {
    uniqueClients.add(r.client_id)
  }
  for (const r of ((quotaClientsRes.data ?? []) as { client_id: string }[])) {
    uniqueClients.add(r.client_id)
  }
  const portfolioCount = uniqueClients.size

  // === 5. Meta atingida (%) ===
  const goalProgress = monthlyGoal > 0 ? (totalCommission / monthlyGoal) * 100 : 0
  const goalReached = goalProgress >= 100

  // === 6. Aba relatorio: commission_entries do mes com refs ===
  const { data: rawEntries } = await supabase
    .from('commission_entries')
    .select(
      'id, entry_type, amount, rate_used, reference_month, notes, created_at, policy:policies(id, policy_number), quota:consortium_quotas(id, quota_number, group_id)',
    )
    .eq('broker_id', id)
    .eq('reference_month', referenceMonth)
    .order('created_at', { ascending: false })

  const reportRows = (rawEntries ?? []) as unknown as CommissionEntryRow[]

  // === 7. Top clientes (Visao Geral): 5 clientes do broker com mais policies ===
  const { data: topClientsRaw } = await supabase
    .from('policies')
    .select('client:clients(id, name)')
    .eq('assigned_to', id)
    .is('deleted_at', null)
    .limit(50)
  const clientCountMap = new Map<string, { id: string; name: string; count: number }>()
  for (const r of ((topClientsRaw ?? []) as { client: { id: string; name: string } | null }[])) {
    if (!r.client) continue
    const existing = clientCountMap.get(r.client.id)
    if (existing) existing.count++
    else clientCountMap.set(r.client.id, { id: r.client.id, name: r.client.name, count: 1 })
  }
  const topClients = Array.from(clientCountMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/${slug}/corretores`} className="hover:text-foreground">
          Corretores
        </Link>
        <span>/</span>
        <span>{profile.full_name}</span>
      </div>

      {/* Header card */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-2xl">{profile.full_name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {brokerProfile?.susep_number
                ? `SUSEP: ${brokerProfile.susep_number}`
                : 'Sem SUSEP cadastrado'}
              {brokerEmail && <> — {brokerEmail}</>}
            </p>
          </div>
          <Badge variant="outline">Corretor interno</Badge>
        </CardHeader>
      </Card>

      {/* 4 Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          title="Producao do mes"
          value={`${productionCount ?? 0} apolice(s) nova(s)`}
          subtext={`mes de ${monthLabel}`}
        />
        <StatCard
          title="Comissao acumulada"
          value={formatBRL(totalCommission)}
          subtext={`mes de ${monthLabel}`}
        />
        <StatCard
          title="Carteira ativa"
          value={`${portfolioCount} cliente(s) com produto ativo`}
        />
        <StatCard
          title="Meta atingida"
          value={goalReached ? 'Meta atingida!' : `${goalProgress.toFixed(0)}% da meta`}
          subtext={`Meta: ${formatBRL(monthlyGoal)}`}
          progress={goalProgress}
          progressOverflow={goalReached}
        />
      </div>

      {/* Month selector */}
      <MonthSelector selected={monthValue} />

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visao geral</TabsTrigger>
          <TabsTrigger value="report">Relatorio de comissoes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 5 clientes por # apolices</CardTitle>
            </CardHeader>
            <CardContent>
              {topClients.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma apolice atribuida ainda.</p>
              ) : (
                <ul className="divide-y">
                  {topClients.map((c) => (
                    <li key={c.id} className="flex items-center justify-between py-2">
                      <Link
                        href={`/${slug}/clientes/${c.id}`}
                        className="text-sm hover:underline"
                      >
                        {c.name}
                      </Link>
                      <span className="text-sm text-muted-foreground">{c.count} apolice(s)</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="mt-4">
          <CommissionTable slug={slug} rows={reportRows} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

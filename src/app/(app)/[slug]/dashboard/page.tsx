import { notFound, redirect } from 'next/navigation'
import { format, addDays, addMonths, startOfToday, startOfMonth } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { FileText, TrendingUp, AlertTriangle, Clock } from 'lucide-react'
import { StatCard } from '@/components/corretores/stat-card'
import { MonthSelector } from '@/components/corretores/month-selector'
import { AlertSection } from '@/components/dashboard/alert-section'
import { BrokerRankingTable } from '@/components/dashboard/broker-ranking-table'
import {
  isExecutiveRole,
  parseSelectedMonth,
  aggregateBrokerRanking,
  type ProfileRow,
  type CommissionRow,
  type ProductionRow,
} from '@/lib/utils/dashboard-queries'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ month?: string }>
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default async function DashboardPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/${slug}/dashboard`)

  // === RBAC (D-09) ===
  const role = (user.app_metadata as { role?: string })?.role ?? ''
  if (role === 'corretor') redirect(`/${slug}/corretores/${user.id}`)
  if (role === 'visualizador') notFound()
  if (!isExecutiveRole(role)) notFound() // defesa em profundidade
  // admin e financeiro continuam (D-10)

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()
  const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? 'Usuario'

  // === Mes selecionado (D-03) ===
  const month = parseSelectedMonth(sp.month)
  // WR-02 fix: strict upper bound — lt against first instant of next month avoids
  // sub-second precision gap from "T23:59:59" string boundary
  const nextMonthStart = format(addMonths(startOfMonth(new Date(month.monthStartStr)), 1), 'yyyy-MM-dd')
  const todayStr = format(startOfToday(), 'yyyy-MM-dd')
  const thirtyDaysLaterStr = format(addDays(startOfToday(), 30), 'yyyy-MM-dd')
  const sevenDaysLaterStr = format(addDays(startOfToday(), 7), 'yyyy-MM-dd')

  // === Queries de KPI ===

  // --- KPI 1: Apolices ativas (Pitfall 1: SEM campo status — usar vigencia_fim >= hoje) ---
  let apolicesAtivas = 0
  try {
    const { count } = await supabase
      .from('policies')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('vigencia_fim', todayStr)
    apolicesAtivas = count ?? 0
  } catch {
    apolicesAtivas = 0
  }

  // --- KPI 2: Receita do periodo (Pitfall 3: filtrar por paid_at, nao due_date) ---
  let receitaTotal = 0
  try {
    const { data } = await supabase
      .from('financial_entries')
      .select('amount')
      .is('deleted_at', null)
      .eq('entry_type', 'receivable')
      .eq('status', 'paid')
      .gte('paid_at', month.monthStartStr)
      .lt('paid_at', nextMonthStart)
    for (const r of (data ?? []) as Array<{ amount: number | string }>) {
      receitaTotal += Number(r.amount) || 0
    }
  } catch {
    receitaTotal = 0
  }

  // --- KPI 3: Inadimplencia (receivable + pending + due_date < hoje) ---
  let inadimplenciaTotal = 0
  try {
    const { data } = await supabase
      .from('financial_entries')
      .select('amount')
      .is('deleted_at', null)
      .eq('entry_type', 'receivable')
      .eq('status', 'pending')
      .lt('due_date', todayStr)
    for (const r of (data ?? []) as Array<{ amount: number | string }>) {
      inadimplenciaTotal += Number(r.amount) || 0
    }
  } catch {
    inadimplenciaTotal = 0
  }

  // --- KPI 4: Vencendo em 30 dias ---
  let vencendoCount = 0
  try {
    const { count } = await supabase
      .from('policies')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('vigencia_fim', todayStr)
      .lte('vigencia_fim', thirtyDaysLaterStr)
    vencendoCount = count ?? 0
  } catch {
    vencendoCount = 0
  }

  // === Alertas (D-05): max 5 + count total por categoria ===
  type VencendoRow = {
    id: string
    policy_number: string
    vigencia_fim: string
    client: { name: string } | null
  }
  let vencendo = {
    items: [] as Array<{
      id: string
      policy_number: string
      vigencia_fim: string
      client_name: string | null
    }>,
    totalCount: 0,
  }
  try {
    const { data, count } = await supabase
      .from('policies')
      .select('id, policy_number, vigencia_fim, client:clients(name)', { count: 'exact' })
      .is('deleted_at', null)
      .gte('vigencia_fim', todayStr)
      .lte('vigencia_fim', thirtyDaysLaterStr)
      .order('vigencia_fim', { ascending: true })
      .limit(5)
    vencendo = {
      items: ((data ?? []) as VencendoRow[]).map((r) => ({
        id: r.id,
        policy_number: r.policy_number,
        vigencia_fim: r.vigencia_fim,
        client_name: r.client?.name ?? null,
      })),
      totalCount: count ?? 0,
    }
  } catch {
    vencendo = { items: [], totalCount: 0 }
  }

  let cobrancas = {
    items: [] as Array<{
      id: string
      description: string
      amount: number | string
      due_date: string
    }>,
    totalCount: 0,
  }
  try {
    const { data, count } = await supabase
      .from('financial_entries')
      .select('id, description, amount, due_date', { count: 'exact' })
      .is('deleted_at', null)
      .eq('entry_type', 'receivable')
      .eq('status', 'pending')
      .lt('due_date', todayStr)
      .order('due_date', { ascending: true })
      .limit(5)
    cobrancas = {
      items: (data ?? []) as Array<{
        id: string
        description: string
        amount: number | string
        due_date: string
      }>,
      totalCount: count ?? 0,
    }
  } catch {
    cobrancas = { items: [], totalCount: 0 }
  }

  let assembleias = {
    items: [] as Array<{
      id: string
      administrator: string
      next_assembly_date: string
    }>,
    totalCount: 0,
  }
  try {
    const { data, count } = await supabase
      .from('consortium_groups')
      .select('id, administrator, next_assembly_date', { count: 'exact' })
      .is('deleted_at', null)
      .not('next_assembly_date', 'is', null)
      .gte('next_assembly_date', todayStr)
      .lte('next_assembly_date', sevenDaysLaterStr)
      .order('next_assembly_date', { ascending: true })
      .limit(5)
    assembleias = {
      items: (data ?? []) as Array<{
        id: string
        administrator: string
        next_assembly_date: string
      }>,
      totalCount: count ?? 0,
    }
  } catch {
    assembleias = { items: [], totalCount: 0 }
  }

  // === Ranking de Corretores (D-04) ===
  // Pitfall 2: reference_month e DATE primeiro dia do mes (yyyy-MM-dd, NAO yyyy-MM)
  let rankingRows: ReturnType<typeof aggregateBrokerRanking> = []
  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'corretor')
      .order('full_name')
    const profilesArr = (profiles ?? []) as ProfileRow[]
    const profileIds = profilesArr.map((p) => p.id)

    if (profileIds.length > 0) {
      const [commRes, prodRes] = await Promise.all([
        supabase
          .from('commission_entries')
          .select('broker_id, amount')
          .in('broker_id', profileIds)
          .eq('reference_month', month.monthStartStr),
        supabase
          .from('policies')
          .select('assigned_to')
          .in('assigned_to', profileIds)
          .gte('created_at', month.monthStartStr)
          .lt('created_at', nextMonthStart)
          .is('deleted_at', null),
      ])
      const commissions = ((commRes.data ?? []) as CommissionRow[]) ?? []
      const productions = ((prodRes.data ?? []) as ProductionRow[]) ?? []
      rankingRows = aggregateBrokerRanking(profilesArr, commissions, productions)
    } else {
      rankingRows = []
    }
  } catch {
    rankingRows = []
  }

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-8 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Painel Executivo</h1>
          <p className="text-sm text-muted-foreground">
            Bem-vindo, {fullName}. Visao consolidada da corretora.
          </p>
        </div>
        <MonthSelector selected={month.monthValue} />
      </div>

      {/* 4 KPI Cards (D-02) */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Apólices ativas"
          value={String(apolicesAtivas)}
          subtext="Vigência em dia"
          icon={<FileText size={18} />}
          variant="default"
        />
        <StatCard
          title="Receita do período"
          value={formatBRL(receitaTotal)}
          subtext={`Pago em ${month.monthLabel}`}
          icon={<TrendingUp size={18} />}
          variant="success"
        />
        <StatCard
          title="Inadimplência"
          value={formatBRL(inadimplenciaTotal)}
          subtext="A receber vencido"
          icon={<AlertTriangle size={18} />}
          variant="danger"
        />
        <StatCard
          title="Vencendo em 30 dias"
          value={String(vencendoCount)}
          subtext="Apólices com vigência até +30d"
          icon={<Clock size={18} />}
          variant="warning"
        />
      </div>

      {/* Alertas (D-05) */}
      <AlertSection
        slug={slug}
        vencendo={vencendo}
        cobrancas={cobrancas}
        assembleias={assembleias}
      />

      {/* Ranking de Corretores (D-04) */}
      <BrokerRankingTable
        slug={slug}
        monthLabel={month.monthLabel}
        rows={rankingRows}
      />
    </div>
  )
}

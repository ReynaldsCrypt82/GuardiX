import Link from 'next/link'
import { notFound } from 'next/navigation'
import { startOfMonth, endOfMonth, format, parse } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/corretores/stat-card'
import { MonthSelector } from '@/components/corretores/month-selector'
import {
  FinancialEntriesTable,
  type FinancialEntryRow,
} from '@/components/financeiro/financial-entries-table'
import { NewEntryDialog } from '@/components/financeiro/new-entry-dialog'

const PAGE_SIZE = 25
type Tab = 'receivable' | 'payable' | 'all' | 'overdue'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ month?: string; tab?: string; page?: string }>
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function isValidTab(s: string | undefined): s is Tab {
  return s === 'receivable' || s === 'payable' || s === 'all' || s === 'overdue'
}

export default async function FinanceiroPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const role = (user.app_metadata as { role?: string })?.role ?? ''
  // D-05: apenas admin e financeiro acessam /financeiro (T-5-10)
  if (!['admin', 'financeiro'].includes(role)) notFound()

  // Mes selecionado (default = corrente)
  const today = new Date()
  const selectedMonthStart = sp.month
    ? parse(sp.month + '-01', 'yyyy-MM-dd', today)
    : startOfMonth(today)
  const monthStartStr = format(startOfMonth(selectedMonthStart), 'yyyy-MM-dd')
  const monthEndStr = format(endOfMonth(selectedMonthStart), 'yyyy-MM-dd')
  const todayStr = format(today, 'yyyy-MM-dd')
  const monthLabel = format(selectedMonthStart, 'MMMM yyyy', { locale: ptBR })
  const monthValue = format(selectedMonthStart, 'yyyy-MM')

  // T-5-09: isValidTab whitelist gate
  const tab: Tab = isValidTab(sp.tab) ? sp.tab : 'receivable'
  const pageNum = Math.max(1, parseInt(sp.page ?? '1', 10))
  const offset = (pageNum - 1) * PAGE_SIZE

  // === Query 1: Resumo dos 3 cards (apenas pendentes do mes selecionado) ===
  let totalReceivable = 0
  let totalPayable = 0
  try {
    const { data: summary } = await supabase
      .from('financial_entries')
      .select('entry_type, amount')
      .is('deleted_at', null)
      .eq('status', 'pending')
      .gte('due_date', monthStartStr)
      .lte('due_date', monthEndStr)

    for (const r of (summary ?? []) as Array<{ entry_type: string; amount: number }>) {
      const v = Number(r.amount) || 0
      if (r.entry_type === 'receivable') totalReceivable += v
      else if (r.entry_type === 'payable') totalPayable += v
    }
  } catch {
    // fallback graceful — cards mostram 0
  }
  const balance = totalReceivable - totalPayable

  // === Query 2: Lancamentos paginados conforme tab ===
  // Pitfall 5: usar format(date, 'yyyy-MM-dd') para comparacoes — nunca Date.toISOString()
  let entriesQuery = supabase
    .from('financial_entries')
    .select(
      'id, entry_type, description, amount, due_date, status, paid_at, policy_id, quota_id, client_id, notes',
      { count: 'exact' },
    )
    .is('deleted_at', null)
    .order('due_date', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1)

  if (tab === 'receivable') {
    entriesQuery = entriesQuery
      .eq('entry_type', 'receivable')
      .gte('due_date', monthStartStr)
      .lte('due_date', monthEndStr)
  } else if (tab === 'payable') {
    entriesQuery = entriesQuery
      .eq('entry_type', 'payable')
      .gte('due_date', monthStartStr)
      .lte('due_date', monthEndStr)
  } else if (tab === 'all') {
    entriesQuery = entriesQuery
      .gte('due_date', monthStartStr)
      .lte('due_date', monthEndStr)
  } else {
    // tab === 'overdue' — D-07: sem filtro de mes, todos os pendentes vencidos (T-5-13 paginado)
    entriesQuery = entriesQuery.eq('status', 'pending').lt('due_date', todayStr)
  }

  const { data: rawEntries, count } = await entriesQuery
  const rows = (rawEntries ?? []) as FinancialEntryRow[]
  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // === Query 3: Clientes para fill do NewEntryDialog (top 50 mais recentes) ===
  const { data: clientsForDialog } = await supabase
    .from('clients')
    .select('id, name')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  function tabHref(t: Tab) {
    const p = new URLSearchParams()
    p.set('tab', t)
    if (t !== 'overdue') p.set('month', monthValue)
    return `?${p.toString()}`
  }

  function pageHref(p: number) {
    const params = new URLSearchParams()
    params.set('tab', tab)
    if (tab !== 'overdue') params.set('month', monthValue)
    params.set('page', String(p))
    return `?${params.toString()}`
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Contas a receber, a pagar e fluxo de caixa do mes.
          </p>
        </div>
        <NewEntryDialog
          slug={slug}
          defaultEntryType={tab === 'payable' ? 'payable' : 'receivable'}
          clients={(clientsForDialog ?? []) as Array<{ id: string; name: string }>}
        />
      </div>

      {/* 3 Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="A Receber no Mes"
          value={formatBRL(totalReceivable)}
          subtext={`Pendentes em ${monthLabel}`}
        />
        <StatCard
          title="A Pagar no Mes"
          value={formatBRL(totalPayable)}
          subtext={`Pendentes em ${monthLabel}`}
        />
        <StatCard
          title="Saldo do Mes"
          value={formatBRL(balance)}
          subtext={balance >= 0 ? 'Positivo' : 'Negativo — atencao'}
        />
      </div>

      {/* Month selector — oculto na aba Vencidos (sem filtro de mes) */}
      {tab !== 'overdue' && <MonthSelector selected={monthValue} />}
      {tab === 'overdue' && (
        <p className="text-xs text-muted-foreground text-right">
          Aba Vencidos exibe todos os lancamentos vencidos historicamente (sem filtro de mes).
        </p>
      )}

      {/* Tabs (links que preservam params) */}
      <div className="border-b flex gap-1">
        {(
          [
            ['receivable', 'Receber'],
            ['payable', 'Pagar'],
            ['all', 'Todos'],
            ['overdue', 'Vencidos'],
          ] as Array<[Tab, string]>
        ).map(([t, label]) => (
          <Link
            key={t}
            href={tabHref(t)}
            className={[
              'px-4 py-2 text-sm border-b-2 -mb-[2px]',
              tab === t
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Tabela paginada */}
      <FinancialEntriesTable slug={slug} rows={rows} userRole={role} />

      {/* Paginacao */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Pagina {pageNum} de {totalPages} &mdash; {totalCount} lancamento(s)
          </span>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <Link
                href={pageHref(pageNum - 1)}
                className="rounded-md border px-3 py-1 hover:bg-muted"
              >
                Anterior
              </Link>
            )}
            {pageNum < totalPages && (
              <Link
                href={pageHref(pageNum + 1)}
                className="rounded-md border px-3 py-1 hover:bg-muted"
              >
                Proxima
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

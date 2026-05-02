import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { buildSearchClause } from '@/lib/utils/clients-query'
import { ClientsSearch } from './clients-search'
import { ClientsFilters } from './clients-filters'
import { ClientsTable } from './clients-table'
import { ClientsPagination } from './clients-pagination'
import { ExportButton } from '@/components/export/export-button'
import { ImportClientsButton } from '@/components/clientes/import-clients-button'
import { isExecutiveRole } from '@/lib/utils/dashboard-queries'

const PAGE_SIZE = 25

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{
    q?: string
    page?: string
    corretor?: string
    stage?: string
    type?: string
  }>
}

export default async function ClientesPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const userRole = (user.app_metadata as { role?: string }).role ?? ''
  const userId = user.id
  const canExport = isExecutiveRole(userRole)

  const pageNum = Math.max(1, parseInt(sp.page ?? '1', 10))
  const offset = (pageNum - 1) * PAGE_SIZE

  // Carregar corretores e stages para os filtros (RLS limita ao tenant)
  const [corretoresRes, stagesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['admin', 'corretor'])
      .eq('active', true)
      .is('deleted_at', null)
      .order('full_name'),
    supabase
      .from('pipeline_stages')
      .select('id, name, color, position')
      .is('deleted_at', null)
      .order('position'),
  ])

  // === D-10: Query paralela para overdue client_ids (badge de inadimplência) ===
  // Pitfall 2: visualizador NUNCA vê badge; corretor vê apenas próprios (RLS já filtra)
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  let overdueClientIds = new Set<string>()
  if (userRole === 'admin' || userRole === 'financeiro' || userRole === 'corretor') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { data: overdueRows } = await sb
        .from('financial_entries')
        .select('client_id')
        .is('deleted_at', null)
        .eq('status', 'pending')
        .lt('due_date', todayStr)
        .not('client_id', 'is', null)
      const ids = ((overdueRows ?? []) as Array<{ client_id: string | null }>)
        .map((r) => r.client_id)
        .filter((id): id is string => !!id)
      overdueClientIds = new Set(ids)
    } catch {
      // tabela financial_entries pode não existir antes da Phase 5 db push — fallback graceful
      overdueClientIds = new Set()
    }
  }

  // Query de clientes com filtros aplicados
  let query = supabase
    .from('clients')
    .select(
      `id, name, type, document, created_at,
       assigned_to:profiles!clients_assigned_to_fkey(id, full_name),
       stage:pipeline_stages(id, name, color)`,
      { count: 'exact' },
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  // Busca por nome / CPF / CNPJ — threat T-02-18: slice para 100 chars, Supabase escapa params
  if (sp.q) {
    const safeQ = sp.q.slice(0, 100)
    const clause = buildSearchClause(safeQ)
    if (clause.type === 'or') {
      query = query.or(`name.ilike.%${clause.name}%,document.ilike.%${clause.document}%`)
    } else {
      query = query.ilike('name', `%${clause.name}%`)
    }
  }

  // Threat T-02-19: whitelist para type (apenas 'pf' ou 'pj')
  if (sp.corretor) query = query.eq('assigned_to', sp.corretor)
  if (sp.stage) query = query.eq('stage_id', sp.stage)
  if (sp.type && (sp.type === 'pf' || sp.type === 'pj')) query = query.eq('type', sp.type)

  const { data: clients, count } = await query

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  const hasActiveFilters = !!(sp.q || sp.corretor || sp.stage || sp.type)

  // D-08: passar searchParams ativos para o export
  const exportParams: Record<string, string> = {}
  if (sp.q) exportParams.q = sp.q
  if (sp.corretor) exportParams.corretor = sp.corretor
  if (sp.stage) exportParams.stage = sp.stage
  if (sp.type) exportParams.type_filter = sp.type

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">{count ?? 0} cliente(s) encontrado(s)</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <>
              <ImportClientsButton />
              <ExportButton slug={slug} type="clientes" params={exportParams} />
            </>
          )}
          <Button asChild>
            <Link href={`/${slug}/clientes/novo`}>+ Novo cliente</Link>
          </Button>
        </div>
      </div>

      <ClientsSearch />

      <ClientsFilters
        corretores={corretoresRes.data ?? []}
        stages={stagesRes.data ?? []}
      />

      {count === 0 && !hasActiveFilters ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12">
          <p className="text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
          <Button asChild>
            <Link href={`/${slug}/clientes/novo`}>Cadastrar primeiro cliente</Link>
          </Button>
        </div>
      ) : (
        <>
          <ClientsTable
                slug={slug}
                clients={clients ?? []}
                stages={stagesRes.data ?? []}
                userRole={userRole}
                userId={userId}
                overdueClientIds={overdueClientIds}
              />
          <ClientsPagination page={pageNum} totalPages={totalPages} />
        </>
      )}
    </div>
  )
}

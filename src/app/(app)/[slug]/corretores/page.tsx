import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ExportButton } from '@/components/export/export-button'
import { isExecutiveRole } from '@/lib/utils/dashboard-queries'
import { BrokerListTable, type BrokerRow } from '@/components/corretores/broker-list-table'
import { startOfMonth, endOfMonth, format } from 'date-fns'

const PAGE_SIZE = 25

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}

export default async function CorretoresPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  // Redirect: se usuario e corretor, manda direto para o proprio dashboard
  const role = (user.app_metadata as { role?: string })?.role
  if (role === 'corretor') {
    redirect(`/${slug}/corretores/${user.id}`)
  }

  const canExport = isExecutiveRole(role)
  const currentMonthValue = format(startOfMonth(new Date()), 'yyyy-MM')

  // 1. Buscar profiles com role='corretor' do tenant (RLS aplica tenant_id)
  const pageNum = Math.max(1, parseInt(sp.page ?? '1', 10))
  const from = (pageNum - 1) * PAGE_SIZE

  const { data: profiles, count } = await supabase
    .from('profiles')
    .select('id, full_name', { count: 'exact' })
    .eq('role', 'corretor')
    .order('full_name', { ascending: true })
    .range(from, from + PAGE_SIZE - 1)

  const profileIds = (profiles ?? []).map((p: { id: string }) => p.id)

  // 2. Buscar broker_profiles correspondentes
  const { data: brokerProfiles } =
    profileIds.length > 0
      ? await supabase
          .from('broker_profiles')
          .select(
            'id, susep_number, monthly_goal, commission_rate_default, commission_rate_overrides',
          )
          .is('deleted_at', null)
          .in('id', profileIds)
      : { data: [] as any[] }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brokerProfileMap = new Map((brokerProfiles ?? []).map((b: any) => [b.id, b]))

  // 3. Producao do mes corrente: count de policies por assigned_to no mes corrente
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')

  const productionMap = new Map<string, number>()
  if (profileIds.length > 0) {
    const { data: prodRows } = await supabase
      .from('policies')
      .select('assigned_to')
      .in('assigned_to', profileIds)
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd + 'T23:59:59')
      .is('deleted_at', null)
    for (const r of (prodRows ?? []) as { assigned_to: string }[]) {
      productionMap.set(r.assigned_to, (productionMap.get(r.assigned_to) ?? 0) + 1)
    }
  }

  // 4. Montar BrokerRow[]
  const rows: BrokerRow[] = (profiles ?? []).map(
    (p: { id: string; full_name: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bp = brokerProfileMap.get(p.id) as
        | {
            susep_number: string | null
            monthly_goal: number
            commission_rate_default: number
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            commission_rate_overrides: any
          }
        | undefined
      return {
        profile_id: p.id,
        full_name: p.full_name,
        susep_number: bp?.susep_number ?? null,
        monthly_goal: bp?.monthly_goal ?? null,
        production_count: productionMap.get(p.id) ?? 0,
        has_broker_profile: !!bp,
        broker_profile: bp
          ? {
              susep_number: bp.susep_number,
              monthly_goal: bp.monthly_goal,
              commission_rate_default: bp.commission_rate_default,
              commission_rate_overrides: bp.commission_rate_overrides,
            }
          : undefined,
      }
    },
  )

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Corretores</h1>
          <p className="text-sm text-muted-foreground">
            {count ?? 0} corretor(es) cadastrado(s)
          </p>
        </div>
        {canExport && (
          <ExportButton
            slug={slug}
            type="comissoes"
            params={{ month: currentMonthValue }}
          />
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
          <p className="font-medium">Nenhum corretor cadastrado ainda</p>
          <p className="text-sm text-muted-foreground">
            Convide um corretor na area de Usuarios e complete o perfil com numero SUSEP, meta e
            taxa de comissao.
          </p>
          <Button asChild variant="outline">
            <Link href={`/${slug}/configuracoes/usuarios`}>Ir para Usuarios</Link>
          </Button>
        </div>
      ) : (
        <BrokerListTable slug={slug} rows={rows} />
      )}

      {/* Paginacao igual ao padrao seguros/page.tsx */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Pagina {pageNum} de {totalPages}
          </span>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={`?page=${pageNum - 1}`}>Anterior</Link>
              </Button>
            )}
            {pageNum < totalPages && (
              <Button asChild variant="outline" size="sm">
                <Link href={`?page=${pageNum + 1}`}>Proxima</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { PolicyTable, type PolicyRow } from '@/components/seguros/policy-table'
import { addDays, startOfToday, format } from 'date-fns'

const PAGE_SIZE = 25

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{
    type?: string
    insurer?: string
    assigned_to?: string
    status?: string
    page?: string
  }>
}

const ALLOWED_TYPES = ['auto', 'vida', 'residencial', 'empresarial', 'saude', 'outros']
const ALLOWED_STATUSES = ['verde', 'amarelo', 'vermelho']

export default async function SegurosPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams

  // Cast to any — policies table not yet in generated types (types will be regenerated after migration)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const pageNum = Math.max(1, parseInt(sp.page ?? '1', 10))
  const from = (pageNum - 1) * PAGE_SIZE

  // Dates for vigencia status filtering — use startOfToday() to match getVigenciaStatus() (vigencia.ts)
  // CR-03 fix: addDays + startOfToday avoids DST drift versus Date.now() arithmetic
  const today = startOfToday()
  const thirtyDaysLater = format(addDays(today, 30), 'yyyy-MM-dd')
  const sixtyDaysLater = format(addDays(today, 60), 'yyyy-MM-dd')

  let query = supabase
    .from('policies')
    .select(
      'id, policy_number, type, insurer, vigencia_fim, premio_total, client:clients(name), profile:profiles!assigned_to(full_name)',
      { count: 'exact' },
    )
    .is('deleted_at', null)
    .order('vigencia_fim', { ascending: true })
    .range(from, from + PAGE_SIZE - 1)

  // Threat T-02-19 pattern: whitelist inputs before applying filters
  if (sp.type && ALLOWED_TYPES.includes(sp.type)) {
    query = query.eq('type', sp.type)
  }
  if (sp.insurer) {
    query = query.ilike('insurer', `%${sp.insurer.slice(0, 100)}%`)
  }
  if (sp.assigned_to) {
    query = query.eq('assigned_to', sp.assigned_to)
  }
  if (sp.status && ALLOWED_STATUSES.includes(sp.status)) {
    if (sp.status === 'vermelho') {
      query = query.lte('vigencia_fim', thirtyDaysLater)
    } else if (sp.status === 'amarelo') {
      query = query.gt('vigencia_fim', thirtyDaysLater).lte('vigencia_fim', sixtyDaysLater)
    } else if (sp.status === 'verde') {
      query = query.gt('vigencia_fim', sixtyDaysLater)
    }
  }

  const { data: policies, count } = await query

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
  const hasActiveFilters = !!(sp.type || sp.insurer || sp.assigned_to || sp.status)

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Apólices de Seguro</h1>
          <p className="text-sm text-muted-foreground">{count ?? 0} apólice(s) encontrada(s)</p>
        </div>
        <Button asChild>
          <Link href={`/${slug}/seguros/nova`}>+ Nova apólice</Link>
        </Button>
      </div>

      {/* Filtros inline */}
      <form className="flex flex-wrap gap-3" method="get">
        <select
          name="type"
          defaultValue={sp.type ?? ''}
          className="rounded-md border px-3 py-1.5 text-sm bg-background"
        >
          <option value="">Todos os tipos</option>
          <option value="auto">Auto</option>
          <option value="vida">Vida</option>
          <option value="residencial">Residencial</option>
          <option value="empresarial">Empresarial</option>
          <option value="saude">Saúde</option>
          <option value="outros">Outros</option>
        </select>

        <select
          name="status"
          defaultValue={sp.status ?? ''}
          className="rounded-md border px-3 py-1.5 text-sm bg-background"
        >
          <option value="">Todos os status</option>
          <option value="verde">Vigente (+60 dias)</option>
          <option value="amarelo">A vencer (31–60 dias)</option>
          <option value="vermelho">Vencida / urgente (≤30 dias)</option>
        </select>

        <input
          name="insurer"
          defaultValue={sp.insurer ?? ''}
          placeholder="Seguradora..."
          className="rounded-md border px-3 py-1.5 text-sm bg-background w-48"
        />

        <Button type="submit" variant="outline" size="sm">
          Filtrar
        </Button>

        {hasActiveFilters && (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/${slug}/seguros`}>Limpar filtros</Link>
          </Button>
        )}
      </form>

      {count === 0 && !hasActiveFilters ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12">
          <p className="text-muted-foreground">Nenhuma apólice cadastrada ainda.</p>
          <Button asChild>
            <Link href={`/${slug}/seguros/nova`}>Cadastrar apólice</Link>
          </Button>
        </div>
      ) : (
        <>
          <PolicyTable slug={slug} policies={(policies ?? []) as PolicyRow[]} />

          {/* Paginação simples */}
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2">
              {pageNum > 1 && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/${slug}/seguros?page=${pageNum - 1}`}>Anterior</Link>
                </Button>
              )}
              <span className="text-sm text-muted-foreground">
                Página {pageNum} de {totalPages}
              </span>
              {pageNum < totalPages && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/${slug}/seguros?page=${pageNum + 1}`}>Próxima</Link>
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{
    type?: string
    administrator?: string
    status?: string
  }>
}

const ALLOWED_TYPES = ['auto', 'imovel', 'servico']
const ALLOWED_STATUSES = ['ativo', 'contemplado', 'cancelado']

const TYPE_LABELS: Record<string, string> = {
  auto: 'Auto',
  imovel: 'Imóvel',
  servico: 'Serviço',
}

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(isoDate: string | null | undefined) {
  if (!isoDate) return '—'
  const [year, month, day] = isoDate.split('T')[0].split('-')
  return `${day}/${month}/${year}`
}

export default async function ConsorcioPag({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams

  // Cast to any — consortium tables not yet in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  let query = supabase
    .from('consortium_groups')
    .select(
      'id, administrator, type, credit_value, term_months, next_assembly_date, start_date, total_quotas, consortium_quotas(id, status)',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  // Whitelist type filter
  if (sp.type && ALLOWED_TYPES.includes(sp.type)) {
    query = query.eq('type', sp.type)
  }
  // Administrator ilike search (max 100 chars)
  if (sp.administrator) {
    query = query.ilike('administrator', `%${sp.administrator.slice(0, 100)}%`)
  }

  const { data: groups } = await query

  const allGroups = (groups ?? []) as Array<{
    id: string
    administrator: string
    type: string
    credit_value: number
    term_months: number
    next_assembly_date: string | null
    start_date: string
    total_quotas: number
    consortium_quotas: Array<{ id: string; status: string }>
  }>

  // Client-side filter por status da cota (aplicado nos dados já carregados)
  const quotaStatusFilter =
    sp.status && ALLOWED_STATUSES.includes(sp.status) ? sp.status : null

  const hasActiveFilters = !!(sp.type || sp.administrator || sp.status)

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Grupos de Consórcio</h1>
          <p className="text-sm text-muted-foreground">
            {allGroups.length} grupo(s) encontrado(s)
          </p>
        </div>
        <Button asChild>
          <Link href={`/${slug}/consorcio/grupos/novo`}>+ Novo grupo</Link>
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
          <option value="imovel">Imóvel</option>
          <option value="servico">Serviço</option>
        </select>

        <select
          name="status"
          defaultValue={sp.status ?? ''}
          className="rounded-md border px-3 py-1.5 text-sm bg-background"
        >
          <option value="">Todos os status de cota</option>
          <option value="ativo">Ativo</option>
          <option value="contemplado">Contemplado</option>
          <option value="cancelado">Cancelado</option>
        </select>

        <input
          name="administrator"
          defaultValue={sp.administrator ?? ''}
          placeholder="Administradora..."
          className="rounded-md border px-3 py-1.5 text-sm bg-background w-48"
        />

        <Button type="submit" variant="outline" size="sm">
          Filtrar
        </Button>

        {hasActiveFilters && (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/${slug}/consorcio`}>Limpar filtros</Link>
          </Button>
        )}
      </form>

      {allGroups.length === 0 && !hasActiveFilters ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12">
          <p className="text-muted-foreground">Nenhum grupo de consórcio cadastrado ainda.</p>
          <Button asChild>
            <Link href={`/${slug}/consorcio/grupos/novo`}>Criar grupo</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Administradora</th>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-right font-medium">Crédito</th>
                <th className="px-4 py-3 text-center font-medium">Prazo</th>
                <th className="px-4 py-3 text-center font-medium">Cotas</th>
                <th className="px-4 py-3 text-left font-medium">Próx. Assembleia</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {allGroups.map((group) => {
                const quotas = group.consortium_quotas ?? []
                const activeCount = quotaStatusFilter
                  ? quotas.filter((q) => q.status === quotaStatusFilter).length
                  : quotas.filter((q) => q.status === 'ativo').length
                const totalCount = quotas.length

                return (
                  <tr key={group.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{group.administrator}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
                        {TYPE_LABELS[group.type] ?? group.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatBRL(group.credit_value)}
                    </td>
                    <td className="px-4 py-3 text-center">{group.term_months} meses</td>
                    <td className="px-4 py-3 text-center">
                      <span>
                        {activeCount} {quotaStatusFilter ? quotaStatusFilter : 'ativas'} / {totalCount} total
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {/* T-03-15: nunca comparar next_assembly_date IS NULL com data — exibir "—" */}
                      {group.next_assembly_date ? formatDate(group.next_assembly_date) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/${slug}/consorcio/${group.id}`}
                        className="inline-flex items-center rounded-md border px-3 py-1 text-xs font-medium hover:bg-muted"
                      >
                        Ver grupo
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

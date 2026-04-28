import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { QuotaTable, type QuotaRow } from '@/components/consorcio/quota-table'
import { QuotaForm } from '@/components/consorcio/quota-form'
import { GroupEditDialog } from '@/components/consorcio/group-edit-dialog'
import { MarkCommissionPaidDialog } from '@/components/seguros/mark-commission-paid-dialog'
import { CommissionPaidBadge } from '@/components/seguros/commission-paid-badge'
import { resolveCommissionRate } from '@/lib/utils/commission-rate'

interface Props {
  params: Promise<{ slug: string; id: string }>
  searchParams: Promise<{ status?: string }>
}

const TYPE_LABELS: Record<string, string> = {
  auto: 'Auto',
  imovel: 'Imóvel',
  servico: 'Serviço',
}

const ALLOWED_QUOTA_STATUSES = ['ativo', 'contemplado', 'cancelado']

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(isoDate: string | null | undefined) {
  if (!isoDate) return null
  const [year, month, day] = isoDate.split('T')[0].split('-')
  return `${day}/${month}/${year}`
}

interface GroupData {
  id: string
  administrator: string
  type: string
  credit_value: number
  term_months: number
  start_date: string
  total_quotas: number
  next_assembly_date: string | null
  created_at: string
}

interface ClientOption {
  id: string
  name: string
  type: string
}

interface CorretorOption {
  id: string
  full_name: string | null
}

export default async function ConsorcioGroupDetailPage({ params, searchParams }: Props) {
  const { slug, id: groupId } = await params
  const sp = await searchParams

  // Cast to any — consortium tables not yet in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  // Busca grupo
  const { data: rawGroup, error: groupError } = await supabase
    .from('consortium_groups')
    .select(
      'id, administrator, type, credit_value, term_months, start_date, total_quotas, next_assembly_date, created_at',
    )
    .eq('id', groupId)
    .is('deleted_at', null)
    .single()

  if (groupError || !rawGroup) notFound()

  const group = rawGroup as unknown as GroupData

  // Busca cotas do grupo com cliente e corretor
  const statusFilter =
    sp.status && ALLOWED_QUOTA_STATUSES.includes(sp.status) ? sp.status : null

  let quotaQuery = supabase
    .from('consortium_quotas')
    .select(
      '*, client:clients(name, type), profile:profiles!assigned_to(full_name)',
    )
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .order('quota_number', { ascending: true })

  if (statusFilter) {
    quotaQuery = quotaQuery.eq('status', statusFilter)
  }

  const { data: rawQuotas } = await quotaQuery

  const quotas = (rawQuotas ?? []) as unknown as QuotaRow[]

  // Busca clientes e corretores para o formulário de cota
  const [clientsRes, profilesRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, type')
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name'),
  ])

  const clients = (clientsRes.data ?? []) as ClientOption[]
  const profiles = (profilesRes.data ?? []) as CorretorOption[]

  // Contagens de cota por status
  const quotaCounts = {
    ativo: quotas.filter((q) => q.status === 'ativo').length,
    contemplado: quotas.filter((q) => q.status === 'contemplado').length,
    cancelado: quotas.filter((q) => q.status === 'cancelado').length,
    total: quotas.length,
  }

  // Calcula comissao por cota contemplada para o Card de Comissoes
  interface CommissionRow {
    quotaId: string
    quotaNumber: string
    clientName: string
    paidAt: string | null
    amounts: {
      brokerName: string
      brokerAmount: number
      brokerRate: number
      partnerName?: string
      partnerAmount?: number
      partnerRate?: number
    } | null
  }

  // Filtra cotas contempladas (post_contemplation_stage IS NOT NULL)
  // QuotaRow may include these fields — cast via any to access
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contemplatedQuotas = quotas.filter((q) => (q as any).post_contemplation_stage !== null && (q as any).post_contemplation_stage !== undefined)

  // Para cada cota contemplada, busca broker_profile e partner para pre-calcular
  const commissionRows: CommissionRow[] = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contemplatedQuotas.map(async (q: any) => {
      const quotaRow: CommissionRow = {
        quotaId: q.id,
        quotaNumber: q.quota_number ?? q.id,
        clientName: q.client?.name ?? '—',
        paidAt: q.commission_paid_at ?? null,
        amounts: null,
      }

      if (q.commission_paid_at) return quotaRow
      if (!q.assigned_to) return quotaRow

      const productType = 'consorcio_' + group.type

      const [{ data: bp }, partnerRes] = await Promise.all([
        supabase
          .from('broker_profiles')
          .select('commission_rate_default, commission_rate_overrides')
          .eq('id', q.assigned_to)
          .is('deleted_at', null)
          .maybeSingle(),
        q.partner_id
          ? supabase
              .from('partners')
              .select('id, name, commission_rate_default, commission_rate_overrides')
              .eq('id', q.partner_id)
              .is('deleted_at', null)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      if (!bp) return quotaRow

      const brokerRate = resolveCommissionRate(
        bp.commission_rate_overrides as Record<string, number | undefined> | null,
        Number(bp.commission_rate_default),
        productType,
      )
      const brokerAmount = Number((group.credit_value * brokerRate).toFixed(2))

      let partnerInfo: { name: string; amount: number; rate: number } | undefined
      if (partnerRes.data) {
        const p = partnerRes.data as {
          name: string
          commission_rate_default: number
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          commission_rate_overrides: any
        }
        const pRate = resolveCommissionRate(
          p.commission_rate_overrides as Record<string, number | undefined> | null,
          Number(p.commission_rate_default),
          productType,
        )
        partnerInfo = { name: p.name, amount: Number((group.credit_value * pRate).toFixed(2)), rate: pRate }
      }

      const brokerProfile = q.profile as { full_name?: string } | null
      quotaRow.amounts = {
        brokerName: brokerProfile?.full_name ?? 'Corretor',
        brokerAmount,
        brokerRate,
        partnerName: partnerInfo?.name,
        partnerAmount: partnerInfo?.amount,
        partnerRate: partnerInfo?.rate,
      }
      return quotaRow
    }),
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/${slug}/consorcio`} className="hover:text-foreground">
          Consórcio
        </Link>
        <span>/</span>
        <span>{group.administrator}</span>
      </div>

      {/* Card principal do grupo */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-xl">{group.administrator}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {TYPE_LABELS[group.type] ?? group.type} — {formatBRL(group.credit_value)}
              </p>
            </div>
            <GroupEditDialog
              slug={slug}
              group={{
                id: group.id,
                administrator: group.administrator,
                type: group.type,
                credit_value: group.credit_value,
                term_months: group.term_months,
                total_quotas: group.total_quotas,
                next_assembly_date: group.next_assembly_date,
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Prazo</p>
              <p className="text-sm font-medium">{group.term_months} meses</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total de cotas</p>
              <p className="text-sm font-medium">{group.total_quotas}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Início</p>
              <p className="text-sm font-medium">{formatDate(group.start_date) ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Próxima assembleia</p>
              {/* T-03-15: nunca comparar NULL com data — exibir "Não agendada" quando null */}
              <p className="text-sm font-medium">
                {group.next_assembly_date ? formatDate(group.next_assembly_date) : 'Não agendada'}
              </p>
            </div>
          </div>

          {/* Resumo de cotas */}
          <div className="mt-4 flex gap-4 text-sm">
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-800 text-xs">
              {quotaCounts.ativo} ativas
            </span>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800 text-xs">
              {quotaCounts.contemplado} contempladas
            </span>
            {quotaCounts.cancelado > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 text-xs">
                {quotaCounts.cancelado} canceladas
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Seção de cotas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Cotas</h2>
            <p className="text-sm text-muted-foreground">
              {statusFilter
                ? `${quotas.length} cota(s) com status "${statusFilter}"`
                : `${quotas.length} cota(s) carregada(s)`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filtro rápido de status */}
            <form className="flex gap-2" method="get">
              <select
                name="status"
                defaultValue={sp.status ?? ''}
                className="rounded-md border px-3 py-1.5 text-sm bg-background"
              >
                <option value="">Todos os status</option>
                <option value="ativo">Ativo</option>
                <option value="contemplado">Contemplado</option>
                <option value="cancelado">Cancelado</option>
              </select>
              <Button type="submit" variant="outline" size="sm">
                Filtrar
              </Button>
            </form>

            <QuotaForm
              slug={slug}
              groupId={groupId}
              clients={clients}
              profiles={profiles}
            />
          </div>
        </div>

        <QuotaTable quotas={quotas} slug={slug} groupId={groupId} />
      </div>

      {/* Comissoes das cotas contempladas */}
      <Card>
        <CardHeader>
          <CardTitle>Comissoes das cotas contempladas</CardTitle>
        </CardHeader>
        <CardContent>
          {commissionRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma cota contemplada para registrar comissao.</p>
          ) : (
            <div className="space-y-3">
              {commissionRows.map((cr) => (
                <div key={cr.quotaId} className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <p className="text-sm font-medium">Cota {cr.quotaNumber} — {cr.clientName}</p>
                    <p className="text-xs text-muted-foreground">
                      Credito base: {formatBRL(group.credit_value)}
                    </p>
                  </div>
                  {cr.paidAt ? (
                    <CommissionPaidBadge paidAt={cr.paidAt} />
                  ) : cr.amounts ? (
                    <MarkCommissionPaidDialog
                      slug={slug}
                      sourceType="quota"
                      sourceId={cr.quotaId}
                      amounts={cr.amounts}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem corretor atribuido</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link href={`/${slug}/consorcio`}>Voltar para grupos</Link>
        </Button>
      </div>
    </div>
  )
}

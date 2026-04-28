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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VigenciaBadge } from '@/components/seguros/vigencia-badge'
import { ClaimDialog } from '@/components/seguros/claim-dialog'
import { EndorsementDialog } from '@/components/seguros/endorsement-dialog'
import { MarkCommissionPaidDialog } from '@/components/seguros/mark-commission-paid-dialog'
import { CommissionPaidBadge } from '@/components/seguros/commission-paid-badge'
import { resolveCommissionRate } from '@/lib/utils/commission-rate'

interface Props {
  params: Promise<{ slug: string; id: string }>
}

// Explicit types for data fetched — avoids Supabase union inference issues
interface PolicyData {
  id: string
  policy_number: string
  type: string
  insurer: string
  vigencia_inicio: string
  vigencia_fim: string
  premio_total: number
  observacoes: string | null
  type_data: Record<string, unknown> | null
  partner_id: string | null
  commission_paid_at: string | null
  assigned_to: string
  client: { id: string; name: string; type: string } | null
  profile: { id: string; full_name: string } | null
}

interface ClaimData {
  id: string
  claim_date: string
  type: string
  protocol_number: string | null
  status: string
  description: string
}

interface EndorsementData {
  id: string
  endorsement_date: string
  type: string
  description: string
  premium_impact: number | null
}

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split('T')[0].split('-')
  return `${day}/${month}/${year}`
}

const TYPE_LABELS: Record<string, string> = {
  auto: 'Auto',
  vida: 'Vida',
  residencial: 'Residencial',
  empresarial: 'Empresarial',
  saude: 'Saúde',
  outros: 'Outros',
}

const CLAIM_STATUS_LABELS: Record<string, string> = {
  aberto: 'Aberto',
  em_analise: 'Em análise',
  encerrado: 'Encerrado',
}

const ENDORSEMENT_TYPE_LABELS: Record<string, string> = {
  inclusao: 'Inclusão',
  exclusao: 'Exclusão',
  alteracao: 'Alteração',
}

export default async function PolicyDetailPage({ params }: Props) {
  const { slug, id } = await params
  // Cast to any — policies/claims/endorsements not yet in generated types (pending supabase gen types)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  // Busca apólice — cast explícito para evitar union type do Supabase client
  const { data: rawPolicy, error: policyError } = await supabase
    .from('policies')
    .select('id, policy_number, type, insurer, vigencia_inicio, vigencia_fim, premio_total, observacoes, type_data, partner_id, commission_paid_at, assigned_to, client:clients(id, name, type), profile:profiles!assigned_to(id, full_name)')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (policyError || !rawPolicy) notFound()

  const policy = rawPolicy as unknown as PolicyData

  // Carrega dados para pre-calcular comissao no Dialog (apenas quando ainda nao paga)
  interface CalculatedAmounts {
    brokerName: string
    brokerAmount: number
    brokerRate: number
    partnerName?: string
    partnerAmount?: number
    partnerRate?: number
  }
  let calculatedAmounts: CalculatedAmounts | null = null
  if (!policy.commission_paid_at && policy.assigned_to) {
    const [{ data: bp }, partnerRes] = await Promise.all([
      supabase
        .from('broker_profiles')
        .select('commission_rate_default, commission_rate_overrides')
        .eq('id', policy.assigned_to)
        .is('deleted_at', null)
        .maybeSingle(),
      policy.partner_id
        ? supabase
            .from('partners')
            .select('id, name, commission_rate_default, commission_rate_overrides')
            .eq('id', policy.partner_id)
            .is('deleted_at', null)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    if (bp) {
      const brokerRate = resolveCommissionRate(
        bp.commission_rate_overrides as Record<string, number | undefined> | null,
        Number(bp.commission_rate_default),
        policy.type,
      )
      const brokerAmount = Number((policy.premio_total * brokerRate).toFixed(2))
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
          policy.type,
        )
        partnerInfo = { name: p.name, amount: Number((policy.premio_total * pRate).toFixed(2)), rate: pRate }
      }
      calculatedAmounts = {
        brokerName: policy.profile?.full_name ?? 'Corretor',
        brokerAmount,
        brokerRate,
        partnerName: partnerInfo?.name,
        partnerAmount: partnerInfo?.amount,
        partnerRate: partnerInfo?.rate,
      }
    }
  }

  // Busca sinistros e endossos em paralelo
  const [claimsRes, endorsementsRes] = await Promise.all([
    supabase
      .from('claims')
      .select('id, claim_date, type, protocol_number, status, description')
      .eq('policy_id', id)
      .is('deleted_at', null)
      .order('claim_date', { ascending: false }),
    supabase
      .from('endorsements')
      .select('id, endorsement_date, type, description, premium_impact')
      .eq('policy_id', id)
      .is('deleted_at', null)
      .order('endorsement_date', { ascending: false }),
  ])

  const claims = (claimsRes.data ?? []) as unknown as ClaimData[]
  const endorsements = (endorsementsRes.data ?? []) as unknown as EndorsementData[]

  // type_data pode conter dados específicos do tipo
  const typeData = (policy.type_data ?? {}) as Record<string, unknown>
  const hasTypeData = Object.keys(typeData).length > 0

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/${slug}/seguros`} className="hover:text-foreground">
          Apólices
        </Link>
        <span>/</span>
        <span>{policy.policy_number}</span>
      </div>

      {/* Card principal da apólice */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl">{policy.policy_number}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {TYPE_LABELS[policy.type] ?? policy.type} — {policy.insurer}
            </p>
          </div>
          <VigenciaBadge vigencia_fim={policy.vigencia_fim} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Cliente</p>
              <p className="text-sm font-medium">{policy.client?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Corretor</p>
              <p className="text-sm font-medium">{policy.profile?.full_name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vigência</p>
              <p className="text-sm font-medium">
                {formatDate(policy.vigencia_inicio)} → {formatDate(policy.vigencia_fim)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prêmio total</p>
              <p className="text-sm font-medium">{formatBRL(policy.premio_total)}</p>
            </div>
          </div>

          {policy.observacoes && (
            <div>
              <p className="text-xs text-muted-foreground">Observações</p>
              <p className="text-sm">{policy.observacoes}</p>
            </div>
          )}

          {/* Dados específicos do tipo — seção expansível */}
          {hasTypeData && (
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Dados específicos ({TYPE_LABELS[policy.type] ?? policy.type})
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(typeData).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs text-muted-foreground capitalize">
                      {key.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm">{String(value ?? '—')}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      {/* Tabs de sinistros e endossos */}
      <Tabs defaultValue="sinistros">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="sinistros">
              Sinistros ({claims.length})
            </TabsTrigger>
            <TabsTrigger value="endossos">
              Endossos ({endorsements.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <ClaimDialog slug={slug} policyId={id} />
            <EndorsementDialog slug={slug} policyId={id} />
            {policy.commission_paid_at ? (
              <CommissionPaidBadge paidAt={policy.commission_paid_at} />
            ) : calculatedAmounts ? (
              <MarkCommissionPaidDialog
                slug={slug}
                sourceType="policy"
                sourceId={policy.id}
                amounts={calculatedAmounts}
              />
            ) : null}
          </div>
        </div>

        <TabsContent value="sinistros" className="mt-4">
          {claims.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground">Nenhum sinistro registrado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {claims.map((claim) => (
                <Card key={claim.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {claim.type}
                          {claim.protocol_number && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              Protocolo: {claim.protocol_number}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(claim.claim_date)}
                        </p>
                        <p className="text-sm">{claim.description}</p>
                      </div>
                      <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs">
                        {CLAIM_STATUS_LABELS[claim.status] ?? claim.status}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="endossos" className="mt-4">
          {endorsements.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground">Nenhum endosso registrado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {endorsements.map((endorsement) => (
                <Card key={endorsement.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {ENDORSEMENT_TYPE_LABELS[endorsement.type] ?? endorsement.type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(endorsement.endorsement_date)}
                        </p>
                        <p className="text-sm">{endorsement.description}</p>
                      </div>
                      {endorsement.premium_impact !== null &&
                        endorsement.premium_impact !== undefined && (
                          <span
                            className={[
                              'shrink-0 text-sm font-medium',
                              endorsement.premium_impact >= 0
                                ? 'text-green-600'
                                : 'text-red-600',
                            ].join(' ')}
                          >
                            {endorsement.premium_impact >= 0 ? '+' : ''}
                            {formatBRL(endorsement.premium_impact)}
                          </span>
                        )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link href={`/${slug}/seguros`}>Voltar para apólices</Link>
        </Button>
      </div>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ContemplationDialog } from './contemplation-dialog'
import { updateQuotaStageAction } from '@/lib/actions/consortium-quotas'

export interface QuotaRow {
  id: string
  quota_number: string
  status: string
  monthly_payment: number
  contemplation_date: string | null
  contemplation_type: string | null
  lance_value: number | null
  post_contemplation_stage: string | null
  post_contemplation_notes: string | null
  client?: { name: string; type: string } | null
  profile?: { full_name: string } | null
}

interface Props {
  quotas: QuotaRow[]
  slug: string
  groupId: string
}

// Status badges
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    ativo: { label: 'Ativo', className: 'bg-blue-100 text-blue-800' },
    contemplado: { label: 'Contemplado', className: 'bg-green-100 text-green-800' },
    cancelado: { label: 'Cancelado', className: 'bg-gray-100 text-gray-600' },
  }
  const { label, className } = config[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

// Post-contemplation stage badges (only for status='contemplado')
function StageBadge({ stage }: { stage: string | null }) {
  if (!stage) return null
  const config: Record<string, { label: string; className: string }> = {
    aguardando_docs: { label: 'Aguardando docs', className: 'bg-yellow-100 text-yellow-800' },
    em_analise: { label: 'Em análise', className: 'bg-orange-100 text-orange-800' },
    credito_liberado: { label: 'Crédito liberado', className: 'bg-green-100 text-green-800' },
  }
  const { label, className } = config[stage] ?? { label: stage, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(isoDate: string | null | undefined) {
  if (!isoDate) return '—'
  const [year, month, day] = isoDate.split('T')[0].split('-')
  return `${day}/${month}/${year}`
}

const NEXT_STAGE: Record<string, string> = {
  aguardando_docs: 'em_analise',
  em_analise: 'credito_liberado',
}

const NEXT_STAGE_LABEL: Record<string, string> = {
  aguardando_docs: 'Avançar para Em análise',
  em_analise: 'Avançar para Crédito liberado',
}

// Inline stage advance button
function StageAdvanceButton({
  slug,
  groupId,
  quota,
}: {
  slug: string
  groupId: string
  quota: QuotaRow
}) {
  const [isLoading, setIsLoading] = useState(false)
  const currentStage = quota.post_contemplation_stage
  const nextStage = currentStage ? NEXT_STAGE[currentStage] : null

  if (!nextStage) return null // Already at credito_liberado or null

  async function handleAdvance() {
    setIsLoading(true)
    const fd = new FormData()
    fd.set('quota_id', quota.id)
    fd.set('stage', nextStage as string)

    const result = await updateQuotaStageAction(slug, groupId, fd)
    setIsLoading(false)

    if (result?.error) {
      const firstError = Object.values(result.error)[0]
      toast.error(Array.isArray(firstError) ? firstError[0] : 'Erro ao avançar estágio.')
      return
    }

    toast.success('Estágio atualizado com sucesso.')
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleAdvance}
      disabled={isLoading}
      className="text-xs"
    >
      {isLoading ? '...' : NEXT_STAGE_LABEL[currentStage!]}
    </Button>
  )
}

export function QuotaTable({ quotas, slug, groupId }: Props) {
  if (quotas.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">Nenhuma cota cadastrada neste grupo ainda.</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nº Cota</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead className="text-right">Parcela</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Data contempl.</TableHead>
          <TableHead>Estágio pós-contempl.</TableHead>
          <TableHead>Corretor</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {quotas.map((quota) => (
          <TableRow key={quota.id}>
            <TableCell className="font-medium">{quota.quota_number}</TableCell>
            <TableCell className="text-sm">{quota.client?.name ?? '—'}</TableCell>
            <TableCell className="text-right text-sm">
              {formatBRL(quota.monthly_payment)}
            </TableCell>
            <TableCell>
              <StatusBadge status={quota.status} />
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {quota.status === 'contemplado' ? formatDate(quota.contemplation_date) : '—'}
            </TableCell>
            <TableCell>
              {quota.status === 'contemplado' ? (
                <StageBadge stage={quota.post_contemplation_stage} />
              ) : (
                '—'
              )}
            </TableCell>
            <TableCell className="text-sm">{quota.profile?.full_name ?? '—'}</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                {quota.status === 'ativo' && (
                  <ContemplationDialog
                    slug={slug}
                    groupId={groupId}
                    quotaId={quota.id}
                    quotaNumber={quota.quota_number}
                  />
                )}
                {quota.status === 'contemplado' && (
                  <StageAdvanceButton slug={slug} groupId={groupId} quota={quota} />
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

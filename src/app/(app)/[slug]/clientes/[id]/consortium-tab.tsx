'use client'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const statusConfig: Record<string, { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  contemplado: {
    label: 'Contemplado',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  cancelado: {
    label: 'Cancelado',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  },
}

const stageLabels: Record<string, string> = {
  aguardando_docs: 'Aguardando docs',
  em_analise: 'Em análise',
  credito_liberado: 'Crédito liberado',
}

interface QuotaRow {
  id: string
  quota_number: string
  monthly_payment: number
  status: string
  contemplation_date: string | null
  post_contemplation_stage: string | null
  group: { id: string; administrator: string; type: string; credit_value: number } | null
}

export function ConsortiumTab({
  quotas,
  slug,
}: {
  quotas: QuotaRow[]
  slug: string
}) {
  if (quotas.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Nenhuma cota de consórcio vinculada a este cliente.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cota</TableHead>
          <TableHead>Grupo / Administradora</TableHead>
          <TableHead>Parcela</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Pós-contemplação</TableHead>
          <TableHead>Contemplação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {quotas.map((q) => (
          <TableRow key={q.id}>
            <TableCell className="font-medium">{q.quota_number}</TableCell>
            <TableCell>
              {q.group ? (
                <Link
                  href={`/${slug}/consorcio/${q.group.id}`}
                  className="text-sm hover:underline"
                >
                  {q.group.administrator}
                  <span className="text-muted-foreground ml-1 text-xs">
                    ({q.group.type})
                  </span>
                </Link>
              ) : (
                '—'
              )}
            </TableCell>
            <TableCell className="text-sm">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(q.monthly_payment)}
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={statusConfig[q.status]?.className ?? ''}
              >
                {statusConfig[q.status]?.label ?? q.status}
              </Badge>
            </TableCell>
            <TableCell>
              {q.status === 'contemplado' && q.post_contemplation_stage ? (
                <span className="text-xs text-muted-foreground">
                  {stageLabels[q.post_contemplation_stage] ?? q.post_contemplation_stage}
                </span>
              ) : (
                '—'
              )}
            </TableCell>
            <TableCell className="text-sm">
              {q.contemplation_date
                ? new Date(q.contemplation_date).toLocaleDateString('pt-BR')
                : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

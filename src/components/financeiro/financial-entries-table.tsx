'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
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
import { Badge } from '@/components/ui/badge'
import { FinancialStatusBadge, type FinancialEntryStatus } from './financial-status-badge'
import { MarkPaidDialog } from './mark-paid-dialog'
import { softDeleteFinancialEntryAction } from '@/lib/actions/financial-entries'

export interface FinancialEntryRow {
  id: string
  entry_type: 'receivable' | 'payable'
  description: string
  amount: number
  due_date: string // YYYY-MM-DD
  status: FinancialEntryStatus
  paid_at: string | null
  policy_id: string | null
  quota_id: string | null
  client_id: string | null
  notes: string | null
}

interface Props {
  slug: string
  rows: FinancialEntryRow[]
  userRole: string // 'admin' | 'financeiro' (only these reach this component)
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function FinancialEntriesTable({ slug, rows, userRole }: Props) {
  const router = useRouter()
  const [markPaidEntry, setMarkPaidEntry] = useState<FinancialEntryRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">Nenhum lancamento encontrado para este filtro.</p>
      </div>
    )
  }

  async function handleDelete(id: string) {
    if (
      !confirm(
        'Excluir este lancamento? Esta acao pode ser revertida apenas pelo administrador.',
      )
    )
      return
    setDeletingId(id)
    try {
      const r = await softDeleteFinancialEntryAction(slug, id)
      if ('error' in r) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = r.error as any
        toast.error(err._form?.[0] ?? 'Erro ao excluir lancamento.')
      } else {
        toast.success('Lancamento excluido.')
        router.refresh()
      }
    } finally {
      setDeletingId(null)
    }
  }

  const canEdit = userRole === 'admin' || userRole === 'financeiro'

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descricao</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Acoes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const dueDate = new Date(r.due_date + 'T00:00:00')
            return (
              <TableRow
                key={r.id}
                className={r.status === 'paid' ? 'text-muted-foreground' : ''}
              >
                <TableCell>
                  <div className={r.status === 'paid' ? 'text-muted-foreground' : 'font-medium'}>
                    {r.description}
                  </div>
                  {r.notes && (
                    <div className="text-xs text-muted-foreground">{r.notes}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {r.entry_type === 'receivable' ? 'Receber' : 'Pagar'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">{formatBRL(r.amount)}</TableCell>
                <TableCell>{format(dueDate, 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                <TableCell>
                  <FinancialStatusBadge status={r.status} />
                </TableCell>
                <TableCell className="text-right">
                  {canEdit && r.status === 'pending' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMarkPaidEntry(r)}
                      className="mr-2"
                    >
                      Marcar como pago
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deletingId === r.id}
                      onClick={() => handleDelete(r.id)}
                    >
                      Excluir
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {markPaidEntry && (
        <MarkPaidDialog
          slug={slug}
          entryId={markPaidEntry.id}
          description={markPaidEntry.description}
          amount={markPaidEntry.amount}
          open={!!markPaidEntry}
          onOpenChange={(v) => {
            if (!v) setMarkPaidEntry(null)
          }}
        />
      )}
    </>
  )
}

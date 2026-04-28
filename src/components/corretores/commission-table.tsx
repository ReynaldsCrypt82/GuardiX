import Link from 'next/link'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { CommissionEntryBadge, type CommissionEntryType } from './commission-entry-badge'

export interface CommissionEntryRow {
  id: string
  entry_type: CommissionEntryType
  amount: number
  rate_used: number | null
  reference_month: string // YYYY-MM-DD
  notes: string | null
  created_at: string // ISO
  policy?: { id: string; policy_number: string } | null
  quota?: { id: string; quota_number: string; group_id: string } | null
}

interface Props {
  slug: string
  rows: CommissionEntryRow[]
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function formatPercent(v: number | null): string {
  if (v === null || v === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
  }).format(v)
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export function CommissionTable({ slug, rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhuma comissao registrada neste periodo.
        </p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Referencia</TableHead>
          <TableHead className="text-right">Valor (R$)</TableHead>
          <TableHead>Taxa</TableHead>
          <TableHead>Notas</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{formatDate(r.created_at)}</TableCell>
            <TableCell>
              <CommissionEntryBadge entryType={r.entry_type} />
            </TableCell>
            <TableCell>
              {r.policy ? (
                <Link
                  href={`/${slug}/seguros/${r.policy.id}`}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Apolice {r.policy.policy_number}
                </Link>
              ) : r.quota ? (
                <Link
                  href={`/${slug}/consorcio/${r.quota.group_id}`}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Cota {r.quota.quota_number}
                </Link>
              ) : (
                '—'
              )}
            </TableCell>
            <TableCell className={`text-right ${r.amount < 0 ? 'text-destructive' : ''}`}>
              {formatBRL(r.amount)}
            </TableCell>
            <TableCell>{formatPercent(r.rate_used)}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{r.notes ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { BrokerRankingRow } from '@/lib/utils/dashboard-queries'

interface Props {
  slug: string
  monthLabel: string
  rows: BrokerRankingRow[]
}

function formatBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function BrokerRankingTable({ slug, monthLabel, rows }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ranking de Corretores — {monthLabel}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Corretor</TableHead>
              <TableHead className="text-right">Producao do mes</TableHead>
              <TableHead className="text-right">Comissao (R$)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                  Nenhum corretor com producao neste periodo.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.brokerId} className="hover:bg-muted/50">
                  <TableCell>
                    <Link
                      href={`/${slug}/corretores/${r.brokerId}`}
                      className="hover:underline"
                    >
                      {r.fullName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{r.productionCount}</TableCell>
                  <TableCell className="text-right">{formatBRL(r.commissionTotal)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

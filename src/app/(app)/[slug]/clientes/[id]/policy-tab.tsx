'use client'
import Link from 'next/link'
import { VigenciaBadge } from '@/components/seguros/vigencia-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Car, Heart, Home, Building2, HeartPulse, Shield } from 'lucide-react'

const typeIcons: Record<string, React.ReactNode> = {
  auto: <Car size={14} />,
  vida: <Heart size={14} />,
  residencial: <Home size={14} />,
  empresarial: <Building2 size={14} />,
  saude: <HeartPulse size={14} />,
  outros: <Shield size={14} />,
}

const typeLabels: Record<string, string> = {
  auto: 'Auto',
  vida: 'Vida',
  residencial: 'Residencial',
  empresarial: 'Empresarial',
  saude: 'Saúde',
  outros: 'Outros',
}

interface PolicyRow {
  id: string
  policy_number: string
  type: string
  insurer: string
  vigencia_fim: string
  premio_total: number
}

export function PolicyTab({ policies, slug }: { policies: PolicyRow[]; slug: string }) {
  if (policies.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Nenhuma apólice vinculada a este cliente.{' '}
        <Link href={`/${slug}/seguros/nova`} className="text-primary underline">
          Cadastrar apólice
        </Link>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Número</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Seguradora</TableHead>
          <TableHead>Vigência</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Prêmio</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {policies.map((p) => (
          <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50">
            <TableCell>
              <Link
                href={`/${slug}/seguros/${p.id}`}
                className="font-medium hover:underline"
              >
                {p.policy_number}
              </Link>
            </TableCell>
            <TableCell>
              <span className="flex items-center gap-1.5 text-sm">
                {typeIcons[p.type]}
                {typeLabels[p.type] ?? p.type}
              </span>
            </TableCell>
            <TableCell className="text-sm">{p.insurer}</TableCell>
            <TableCell className="text-sm">
              {new Date(p.vigencia_fim).toLocaleDateString('pt-BR')}
            </TableCell>
            <TableCell>
              <VigenciaBadge vigencia_fim={p.vigencia_fim} />
            </TableCell>
            <TableCell className="text-right text-sm">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(p.premio_total)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

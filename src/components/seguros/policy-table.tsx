'use client'
import Link from 'next/link'
import { Car, Heart, Home, Building2, HeartPulse, Shield } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { VigenciaBadge } from './vigencia-badge'

export interface PolicyRow {
  id: string
  policy_number: string
  type: string
  insurer: string
  vigencia_fim: string
  premio_total: number
  client?: { name: string } | null
  profile?: { full_name: string } | null
}

const typeConfig: Record<string, { label: string; icon: React.ReactNode }> = {
  auto: { label: 'Auto', icon: <Car size={14} /> },
  vida: { label: 'Vida', icon: <Heart size={14} /> },
  residencial: { label: 'Residencial', icon: <Home size={14} /> },
  empresarial: { label: 'Empresarial', icon: <Building2 size={14} /> },
  saude: { label: 'Saúde', icon: <HeartPulse size={14} /> },
  outros: { label: 'Outros', icon: <Shield size={14} /> },
}

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

interface Props {
  policies: PolicyRow[]
  slug: string
}

export function PolicyTable({ policies, slug }: Props) {
  if (policies.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12">
        <p className="text-muted-foreground">Nenhuma apólice encontrada para os filtros aplicados.</p>
        <Link
          href={`/${slug}/seguros/nova`}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + Cadastrar apólice
        </Link>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nº Apólice</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Seguradora</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Corretor</TableHead>
          <TableHead>Vigência até</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Prêmio</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {policies.map((policy) => {
          const typeInfo = typeConfig[policy.type] ?? { label: policy.type, icon: <Shield size={14} /> }
          return (
            <TableRow key={policy.id} className="cursor-pointer">
              <TableCell>
                <Link
                  href={`/${slug}/seguros/${policy.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {policy.policy_number}
                </Link>
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-1.5 text-sm">
                  {typeInfo.icon}
                  {typeInfo.label}
                </span>
              </TableCell>
              <TableCell className="text-sm">{policy.insurer}</TableCell>
              <TableCell className="text-sm">{policy.client?.name ?? '—'}</TableCell>
              <TableCell className="text-sm">{policy.profile?.full_name ?? '—'}</TableCell>
              <TableCell className="text-sm">{formatDate(policy.vigencia_fim)}</TableCell>
              <TableCell>
                <VigenciaBadge vigencia_fim={policy.vigencia_fim} />
              </TableCell>
              <TableCell className="text-right text-sm font-medium">
                {formatBRL(policy.premio_total)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

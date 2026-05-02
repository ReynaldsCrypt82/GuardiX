'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreHorizontal } from 'lucide-react'
import { BrokerProfileDialog } from './broker-profile-dialog'

export interface BrokerRow {
  profile_id: string
  full_name: string
  susep_number: string | null
  monthly_goal: number | null
  production_count: number
  has_broker_profile: boolean
  broker_profile?: {
    susep_number: string | null
    monthly_goal: number
    commission_rate_default: number
    commission_rate_overrides: Record<string, number | undefined> | null
  }
}

interface Props {
  slug: string
  rows: BrokerRow[]
}

function formatBRL(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function BrokerListTable({ slug, rows }: Props) {
  const [editTarget, setEditTarget] = useState<BrokerRow | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  function handleEdit(row: BrokerRow) {
    setEditTarget(row)
    setDialogOpen(true)
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) setTimeout(() => setEditTarget(null), 200)
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>SUSEP</TableHead>
            <TableHead>Meta mensal</TableHead>
            <TableHead>Producao do mes</TableHead>
            <TableHead className="w-[50px]">Acoes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.profile_id}>
              <TableCell className="font-medium">{row.full_name}</TableCell>
              <TableCell className="text-sm">{row.susep_number ?? '—'}</TableCell>
              <TableCell className="text-sm">{formatBRL(row.monthly_goal)}</TableCell>
              <TableCell className="text-sm">{row.production_count} apolice(s)</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal size={16} />
                      <span className="sr-only">Abrir menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/${slug}/corretores/${row.profile_id}`}>
                        Ver dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleEdit(row)}>
                      {row.has_broker_profile ? 'Editar perfil' : 'Completar perfil de corretor'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Dialog sempre no DOM — evita problema de foco do Radix ao montar com open=true */}
      <BrokerProfileDialog
        slug={slug}
        profileId={editTarget?.profile_id ?? ''}
        brokerName={editTarget?.full_name ?? ''}
        existing={editTarget?.broker_profile
          ? {
              id: editTarget.profile_id,
              susep_number: editTarget.broker_profile.susep_number,
              monthly_goal: editTarget.broker_profile.monthly_goal,
              commission_rate_default: editTarget.broker_profile.commission_rate_default,
              commission_rate_overrides: editTarget.broker_profile.commission_rate_overrides,
            }
          : undefined
        }
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
      />
    </>
  )
}

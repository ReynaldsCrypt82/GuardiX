'use client'
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
import { PartnerDialog } from './partner-dialog'
import { PartnerDeleteConfirm } from './partner-delete-confirm'

export interface PartnerRow {
  id: string
  name: string
  cnpj: string | null
  contact_email: string | null
  contact_phone: string | null
  commission_rate_default: number
  commission_rate_overrides: Record<string, number | undefined> | null
}

interface Props {
  slug: string
  rows: PartnerRow[]
}

function formatPercent(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
  }).format(v)
}

export function PartnerTable({ slug, rows }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>CNPJ</TableHead>
          <TableHead>E-mail de contato</TableHead>
          <TableHead>Taxa padrao</TableHead>
          <TableHead className="w-[50px]">Acoes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell className="text-sm">{row.cnpj ?? '—'}</TableCell>
            <TableCell className="text-sm">{row.contact_email ?? '—'}</TableCell>
            <TableCell className="text-sm">{formatPercent(row.commission_rate_default)}</TableCell>
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
                    <span>
                      <PartnerDialog
                        slug={slug}
                        existing={row}
                        triggerVariant="ghost"
                        triggerSize="sm"
                        triggerLabel="Editar"
                      />
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <span>
                      <PartnerDeleteConfirm
                        slug={slug}
                        partnerId={row.id}
                        partnerName={row.name}
                      />
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

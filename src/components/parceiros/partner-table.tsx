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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { MoreHorizontal } from 'lucide-react'
import { PartnerDialog } from './partner-dialog'
import { softDeletePartnerAction } from '@/lib/actions/partners'

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
  const [deleteTarget, setDeleteTarget] = useState<PartnerRow | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setIsPending(true)
    const result = await softDeletePartnerAction(slug, deleteTarget.id)
    setIsPending(false)
    if (result && 'error' in result) {
      toast.error(typeof result.error === 'string' ? result.error : 'Erro ao excluir parceiro.')
      return
    }
    toast.info('Parceiro removido.')
    setDeleteTarget(null)
  }

  return (
    <>
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
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => setDeleteTarget(row)}
                    >
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* AlertDialog renderizado fora do DropdownMenu para evitar conflito de portais */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir parceiro?</AlertDialogTitle>
            <AlertDialogDescription>
              O parceiro <strong>{deleteTarget?.name}</strong> sera removido (soft delete).
              Lancamentos de comissao ja registrados sao mantidos no ledger.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Manter parceiro</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={isPending}>
              {isPending ? 'Excluindo...' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

'use client'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { softDeletePartnerAction } from '@/lib/actions/partners'

interface Props {
  slug: string
  partnerId: string
  partnerName: string
}

export function PartnerDeleteConfirm({ slug, partnerId, partnerName }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await softDeletePartnerAction(slug, partnerId)
      if (result && 'error' in result) {
        toast.error(
          typeof result.error === 'string' ? result.error : 'Erro ao excluir parceiro.',
        )
        return
      }
      toast.info('Parceiro removido.')
      setOpen(false)
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button className="text-destructive text-sm w-full text-left px-2 py-1.5 hover:bg-muted rounded-sm">
          Excluir
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir parceiro?</AlertDialogTitle>
          <AlertDialogDescription>
            O parceiro <strong>{partnerName}</strong> sera removido (soft delete).
            Lancamentos de comissao ja registrados sao mantidos no ledger.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Manter parceiro</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
            {isPending ? 'Excluindo...' : 'Sim, excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

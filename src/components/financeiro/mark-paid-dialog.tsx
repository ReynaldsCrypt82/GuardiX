'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { markFinancialEntryPaidAction } from '@/lib/actions/financial-entries'

interface Props {
  slug: string
  entryId: string
  description: string
  amount: number
  open: boolean
  onOpenChange: (v: boolean) => void
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function MarkPaidDialog({ slug, entryId, description, amount, open, onOpenChange }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  async function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const fd = new FormData(e.currentTarget)
      const dateStr = (fd.get('paid_at') as string) || todayStr
      // Converter YYYY-MM-DD para ISO datetime (meia-noite local -> UTC)
      const isoPaidAt = new Date(dateStr + 'T00:00:00').toISOString()
      const r = await markFinancialEntryPaidAction(slug, entryId, isoPaidAt)
      if ('error' in r) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = r.error as any
        toast.error(err._form?.[0] ?? 'Erro ao marcar como pago.')
      } else {
        toast.success('Lancamento marcado como pago.')
        onOpenChange(false)
        router.refresh()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar como pago</DialogTitle>
          <DialogDescription>
            Confirme a data de liquidacao. O lancamento ficara com status &quot;Pago&quot;.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleConfirm} className="space-y-4">
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-sm">
              <strong>{description}</strong>
            </p>
            <p className="text-sm text-muted-foreground">{formatBRL(amount)}</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="paid_at">Data de liquidacao</Label>
            <Input id="paid_at" name="paid_at" type="date" defaultValue={todayStr} required />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Confirmar pagamento'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

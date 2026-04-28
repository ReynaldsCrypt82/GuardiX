'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { registerEstornoAction } from '@/lib/actions/commission-entries'

interface Props {
  slug: string
  originalEntryId: string // usado como referencia visual
  originalAmount: number // valor a estornar (positivo — dialog cria negativo)
  // Campos necessarios para o registerEstornoSchema
  sourceType: 'policy' | 'quota'
  sourceId: string
  recipientType: 'broker' | 'partner'
  recipientId: string
  referenceMonth: string // YYYY-MM-DD (primeiro dia do mes)
  triggerVariant?: 'outline' | 'ghost'
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function EstornoDialog({
  slug,
  originalEntryId,
  originalAmount,
  sourceType,
  sourceId,
  recipientType,
  recipientId,
  referenceMonth,
  triggerVariant = 'outline',
}: Props) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Suppress unused variable warning — kept for caller reference/future use
  void originalEntryId

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const fd = new FormData(e.currentTarget)
      // amount deve ser negativo (estorno)
      fd.set('amount', String(-Math.abs(originalAmount)))
      fd.set('source_type', sourceType)
      fd.set('source_id', sourceId)
      fd.set('recipient_type', recipientType)
      fd.set('recipient_id', recipientId)
      fd.set('reference_month', referenceMonth)

      const result = await registerEstornoAction(slug, fd)
      if (result && 'error' in result) {
        const msg = result.error
        const firstMsg =
          typeof msg === 'string'
            ? msg
            : Array.isArray(msg)
              ? msg[0]
              : typeof msg === 'object' && msg !== null
                ? Object.values(msg).flat()[0]
                : null
        toast.error(
          typeof firstMsg === 'string'
            ? firstMsg
            : 'Erro ao registrar estorno. Tente novamente.',
        )
        return
      }
      toast.success('Estorno registrado no ledger.')
      setOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm">
          Estornar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar estorno</DialogTitle>
          <DialogDescription>
            Um estorno cria um novo lancamento negativo no ledger. O lancamento original nao e
            alterado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground">
              Estornando: <span className="font-medium text-foreground">{formatBRL(originalAmount)}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="estorno-notes">
              Motivo do estorno <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="estorno-notes"
              name="notes"
              placeholder="Descreva o motivo do estorno..."
              rows={3}
              required
              minLength={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Nao estornar
            </Button>
            <Button type="submit" disabled={isSubmitting} variant="destructive">
              {isSubmitting ? 'Estornando...' : 'Confirmar estorno'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

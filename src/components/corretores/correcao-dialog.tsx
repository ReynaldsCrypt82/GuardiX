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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { registerCorrecaoAction } from '@/lib/actions/commission-entries'

interface Props {
  slug: string
  brokerId?: string
  partnerId?: string
  policyId?: string
  quotaId?: string
  referenceMonth: string // YYYY-MM-DD (primeiro dia do mes)
}

export function CorrecaoDialog({
  slug,
  brokerId,
  partnerId,
  policyId,
  quotaId,
  referenceMonth,
}: Props) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const fd = new FormData(e.currentTarget)

      // Set recipient (broker XOR partner)
      if (brokerId) {
        fd.set('recipient_type', 'broker')
        fd.set('recipient_id', brokerId)
      } else if (partnerId) {
        fd.set('recipient_type', 'partner')
        fd.set('recipient_id', partnerId)
      }

      // Set source (policy XOR quota)
      if (policyId) {
        fd.set('source_type', 'policy')
        fd.set('source_id', policyId)
      } else if (quotaId) {
        fd.set('source_type', 'quota')
        fd.set('source_id', quotaId)
      }

      fd.set('reference_month', referenceMonth)

      const result = await registerCorrecaoAction(slug, fd)
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
            : 'Erro ao registrar correcao. Tente novamente.',
        )
        return
      }
      toast.success('Correcao registrada no ledger.')
      setOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Corrigir
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar correcao</DialogTitle>
          <DialogDescription>
            Uma correcao cria um novo lancamento complementar no ledger. Use para ajustar
            diferencas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="correcao-amount">
              Valor da diferenca (R$) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="correcao-amount"
              name="amount"
              type="number"
              step="0.01"
              placeholder="Ex.: 150.00 ou -50.00"
              required
            />
            <p className="text-xs text-muted-foreground">
              Use valor positivo para adicionar ou negativo para subtrair.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="correcao-notes">
              Motivo da correcao <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="correcao-notes"
              name="notes"
              placeholder="Descreva o motivo da correcao..."
              rows={3}
              required
              minLength={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Nao corrigir
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Registrando...' : 'Confirmar correcao'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

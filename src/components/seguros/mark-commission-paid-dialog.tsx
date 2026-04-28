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
import { markCommissionPaidAction } from '@/lib/actions/commission-entries'

interface CalculatedAmounts {
  brokerName: string
  brokerAmount: number
  brokerRate: number
  partnerName?: string
  partnerAmount?: number
  partnerRate?: number
}

interface Props {
  slug: string
  sourceType: 'policy' | 'quota'
  sourceId: string
  amounts: CalculatedAmounts
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function formatPercent(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
  }).format(v)
}

export function MarkCommissionPaidDialog({ slug, sourceType, sourceId, amounts }: Props) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const fd = new FormData(e.currentTarget)
      const notes = (fd.get('notes') as string) || undefined
      const result = await markCommissionPaidAction(slug, sourceType, sourceId, notes)
      if (result && 'error' in result) {
        // Cast to unknown first — markCommissionPaidAction returns a typed error object
        // but we need to handle all shapes gracefully in the UI
        const msg = result.error as unknown
        const isJaRegistrada = (v: unknown): boolean => {
          if (typeof v === 'string') return v.toLowerCase().includes('ja registrada')
          if (Array.isArray(v)) return v.some((m) => typeof m === 'string' && m.toLowerCase().includes('ja registrada'))
          if (typeof v === 'object' && v !== null) {
            return Object.values(v as Record<string, unknown>).flat().some(
              (m) => typeof m === 'string' && m.toLowerCase().includes('ja registrada'),
            )
          }
          return false
        }
        if (isJaRegistrada(msg)) {
          toast.error('Comissao ja registrada para este item.')
        } else {
          const firstMsg =
            typeof msg === 'string'
              ? msg
              : Array.isArray(msg)
                ? msg[0]
                : typeof msg === 'object' && msg !== null
                  ? (Object.values(msg as Record<string, unknown>).flat()[0])
                  : null
          toast.error(
            typeof firstMsg === 'string'
              ? firstMsg
              : 'Erro ao registrar comissao. Tente novamente.',
          )
        }
        return
      }
      toast.success('Comissao registrada no ledger.')
      setOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Marcar comissao como paga
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar comissao como paga</DialogTitle>
          <DialogDescription>
            Isso registrara a comissao no ledger. Este lancamento nao pode ser editado apos a
            confirmacao.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleConfirm} className="space-y-4">
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-sm">
              <strong>Corretor:</strong> {amounts.brokerName} — {formatBRL(amounts.brokerAmount)}
            </p>
            <p className="text-xs text-muted-foreground">
              Taxa aplicada: {formatPercent(amounts.brokerRate)}
            </p>
            {amounts.partnerName &&
              amounts.partnerAmount !== undefined &&
              amounts.partnerRate !== undefined && (
                <>
                  <p className="text-sm pt-2 border-t">
                    <strong>Parceiro:</strong> {amounts.partnerName} —{' '}
                    {formatBRL(amounts.partnerAmount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Taxa aplicada: {formatPercent(amounts.partnerRate)}
                  </p>
                </>
              )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="mark-commission-notes">Observacoes (opcional)</Label>
            <Textarea
              id="mark-commission-notes"
              name="notes"
              placeholder="Motivo, referencia ou informacao adicional..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Nao registrar agora
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Registrando...' : 'Confirmar pagamento'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

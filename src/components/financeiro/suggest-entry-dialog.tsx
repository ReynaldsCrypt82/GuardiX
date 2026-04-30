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
import { Textarea } from '@/components/ui/textarea'
import { createFinancialEntryAction } from '@/lib/actions/financial-entries'

interface Props {
  slug: string
  open: boolean
  onOpenChange: (v: boolean) => void
  defaultDescription: string
  defaultAmount: number
  policyId?: string
  quotaId?: string
  clientId?: string
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function SuggestEntryDialog({
  slug,
  open,
  onOpenChange,
  defaultDescription,
  defaultAmount,
  policyId,
  quotaId,
  clientId,
}: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const fd = new FormData(e.currentTarget)
      // entry_type fixo + IDs vindos das props (não confiar no FormData)
      fd.set('entry_type', 'receivable')
      if (policyId) fd.set('policy_id', policyId)
      if (quotaId) fd.set('quota_id', quotaId)
      if (clientId) fd.set('client_id', clientId)

      const r = await createFinancialEntryAction(slug, fd)
      if ('error' in r) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = r.error as any
        toast.error(err._form?.[0] ?? 'Erro ao criar lancamento.')
      } else {
        toast.success('Lancamento criado.')
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
          <DialogTitle>Criar lancamento financeiro?</DialogTitle>
          <DialogDescription>
            A comissao foi registrada. Deseja criar tambem um lancamento &quot;a receber&quot; com os
            mesmos dados? Voce pode editar antes de salvar ou dispensar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="sed-description">Descricao</Label>
            <Input
              id="sed-description"
              name="description"
              defaultValue={defaultDescription}
              required
              minLength={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="sed-amount">Valor (BRL)</Label>
              <Input
                id="sed-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={defaultAmount}
                required
              />
              <p className="text-xs text-muted-foreground">Sugerido: {formatBRL(defaultAmount)}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sed-due-date">Vencimento</Label>
              <Input
                id="sed-due-date"
                name="due_date"
                type="date"
                defaultValue={todayStr}
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sed-notes">Observacoes (opcional)</Label>
            <Textarea id="sed-notes" name="notes" rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Agora nao
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Criando...' : 'Criar lancamento'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

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
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createFinancialEntryAction } from '@/lib/actions/financial-entries'

interface Props {
  slug: string
  defaultEntryType?: 'receivable' | 'payable'
  clients?: Array<{ id: string; name: string }>
  policies?: Array<{ id: string; policy_number: string }>
  quotas?: Array<{ id: string; quota_number: string }>
}

export function NewEntryDialog({
  slug,
  defaultEntryType = 'receivable',
  clients = [],
  policies = [],
  quotas = [],
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [entryType, setEntryType] = useState<'receivable' | 'payable'>(defaultEntryType)
  const [clientId, setClientId] = useState<string>('')
  const [policyId, setPolicyId] = useState<string>('')
  const [quotaId, setQuotaId] = useState<string>('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const fd = new FormData(e.currentTarget)
      // Garantir que selects controlados sao incluidos (Select shadcn nao usa name nativamente)
      fd.set('entry_type', entryType)
      if (clientId) fd.set('client_id', clientId)
      if (policyId) fd.set('policy_id', policyId)
      if (quotaId) fd.set('quota_id', quotaId)

      const r = await createFinancialEntryAction(slug, fd)
      if ('error' in r) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = r.error as any
        toast.error(err._form?.[0] ?? 'Erro ao criar lancamento. Verifique os campos.')
      } else {
        toast.success('Lancamento criado.')
        setOpen(false)
        setClientId('')
        setPolicyId('')
        setQuotaId('')
        router.refresh()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ Novo lancamento</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo lancamento financeiro</DialogTitle>
          <DialogDescription>
            Registre uma conta a receber ou a pagar. Vinculo a apolice/cota/cliente eh opcional.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="entry_type">Tipo</Label>
              <Select
                value={entryType}
                onValueChange={(v) => setEntryType(v as 'receivable' | 'payable')}
              >
                <SelectTrigger id="entry_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receivable">A receber</SelectItem>
                  <SelectItem value="payable">A pagar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="due_date">Vencimento</Label>
              <Input
                id="due_date"
                name="due_date"
                type="date"
                defaultValue={todayStr}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Descricao</Label>
            <Input
              id="description"
              name="description"
              required
              minLength={3}
              placeholder="Ex: Premio Auto Bradesco - Joao Silva"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="amount">Valor (BRL)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0,00"
            />
          </div>

          {clients.length > 0 && (
            <div className="space-y-1">
              <Label>Cliente (opcional)</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {policies.length > 0 && (
            <div className="space-y-1">
              <Label>Apolice (opcional)</Label>
              <Select value={policyId} onValueChange={setPolicyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar apolice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {policies.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.policy_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {quotas.length > 0 && (
            <div className="space-y-1">
              <Label>Cota de consorcio (opcional)</Label>
              <Select value={quotaId} onValueChange={setQuotaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar cota" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {quotas.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.quota_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="notes">Observacoes (opcional)</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
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

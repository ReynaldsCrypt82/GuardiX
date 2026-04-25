'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { updateQuotaContemplationAction } from '@/lib/actions/consortium-quotas'

interface Props {
  slug: string
  groupId: string
  quotaId: string
  quotaNumber: string
}

export function ContemplationDialog({ slug, groupId, quotaId, quotaNumber }: Props) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [contemplationType, setContemplationType] = useState('sorteio')
  const [stage, setStage] = useState('aguardando_docs')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)

    const form = e.currentTarget
    const fd = new FormData(form)

    // Set controlled select values explicitly
    fd.set('contemplation_type', contemplationType)
    fd.set('post_contemplation_stage', stage)

    const result = await updateQuotaContemplationAction(slug, groupId, fd)

    setIsSubmitting(false)

    if (result?.error) {
      const firstError = Object.values(result.error)[0]
      toast.error(Array.isArray(firstError) ? firstError[0] : 'Erro ao registrar contemplação.')
      return
    }

    toast.success('Contemplação registrada com sucesso.')
    setOpen(false)
    form.reset()
    setContemplationType('sorteio')
    setStage('aguardando_docs')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Contemplar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Contemplação — Cota {quotaNumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Hidden: quota_id para updateQuotaContemplationAction */}
          <input type="hidden" name="quota_id" value={quotaId} />

          {/* Data de contemplação */}
          <div className="space-y-2">
            <Label htmlFor="contemplation_date">
              Data da contemplação <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contemplation_date"
              name="contemplation_date"
              type="date"
              required
            />
          </div>

          {/* Tipo de contemplação */}
          <div className="space-y-2">
            <Label htmlFor="contemplation_type">
              Tipo de contemplação <span className="text-destructive">*</span>
            </Label>
            <Select value={contemplationType} onValueChange={setContemplationType}>
              <SelectTrigger id="contemplation_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sorteio">Sorteio</SelectItem>
                <SelectItem value="lance">Lance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Valor do lance — exibido somente quando tipo='lance' */}
          {contemplationType === 'lance' && (
            <div className="space-y-2">
              <Label htmlFor="lance_value">
                Valor do lance (R$) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lance_value"
                name="lance_value"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Ex.: 15000"
                required
              />
            </div>
          )}

          {/* Estágio pós-contemplação */}
          <div className="space-y-2">
            <Label htmlFor="post_contemplation_stage">Estágio pós-contemplação</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger id="post_contemplation_stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aguardando_docs">Aguardando documentos</SelectItem>
                <SelectItem value="em_analise">Em análise</SelectItem>
                <SelectItem value="credito_liberado">Crédito liberado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notas pós-contemplação */}
          <div className="space-y-2">
            <Label htmlFor="post_contemplation_notes">Observações (opcional)</Label>
            <Textarea
              id="post_contemplation_notes"
              name="post_contemplation_notes"
              placeholder="Informações adicionais sobre a contemplação..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Registrando...' : 'Registrar contemplação'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

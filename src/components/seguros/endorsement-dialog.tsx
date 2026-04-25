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
import { createEndorsementAction } from '@/lib/actions/endorsements'

interface Props {
  slug: string
  policyId: string
}

export function EndorsementDialog({ slug, policyId }: Props) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [type, setType] = useState('alteracao')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)

    const form = e.currentTarget
    const fd = new FormData(form)
    fd.set('type', type)

    const result = await createEndorsementAction(slug, fd)

    setIsSubmitting(false)

    if (result?.error) {
      const firstError = Object.values(result.error)[0]
      toast.error(Array.isArray(firstError) ? firstError[0] : 'Erro ao registrar endosso.')
      return
    }

    toast.success('Endosso registrado com sucesso.')
    setOpen(false)
    form.reset()
    setType('alteracao')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Registrar endosso
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Endosso</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="policy_id" value={policyId} />

          <div className="space-y-2">
            <Label htmlFor="endorsement_date">
              Data do endosso <span className="text-destructive">*</span>
            </Label>
            <Input id="endorsement_date" name="endorsement_date" type="date" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">
              Tipo <span className="text-destructive">*</span>
            </Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inclusao">Inclusão</SelectItem>
                <SelectItem value="exclusao">Exclusão</SelectItem>
                <SelectItem value="alteracao">Alteração</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Descrição <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Descreva o endosso..."
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="premium_impact">Impacto no prêmio (R$)</Label>
            <Input
              id="premium_impact"
              name="premium_impact"
              type="number"
              step="0.01"
              placeholder="Opcional — positivo ou negativo"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Registrando...' : 'Registrar endosso'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

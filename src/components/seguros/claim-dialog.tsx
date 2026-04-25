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
import { createClaimAction } from '@/lib/actions/claims'

interface Props {
  slug: string
  policyId: string
}

export function ClaimDialog({ slug, policyId }: Props) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState('aberto')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)

    const form = e.currentTarget
    const fd = new FormData(form)
    fd.set('status', status)

    const result = await createClaimAction(slug, fd)

    setIsSubmitting(false)

    if (result?.error) {
      const firstError = Object.values(result.error)[0]
      toast.error(Array.isArray(firstError) ? firstError[0] : 'Erro ao registrar sinistro.')
      return
    }

    toast.success('Sinistro registrado com sucesso.')
    setOpen(false)
    form.reset()
    setStatus('aberto')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Registrar sinistro
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Sinistro</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="policy_id" value={policyId} />

          <div className="space-y-2">
            <Label htmlFor="claim_date">
              Data do sinistro <span className="text-destructive">*</span>
            </Label>
            <Input id="claim_date" name="claim_date" type="date" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">
              Tipo de sinistro <span className="text-destructive">*</span>
            </Label>
            <Input
              id="type"
              name="type"
              placeholder="Ex.: colisão, roubo, incêndio"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="protocol_number">Nº do protocolo</Label>
            <Input
              id="protocol_number"
              name="protocol_number"
              placeholder="Opcional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="em_analise">Em análise</SelectItem>
                <SelectItem value="encerrado">Encerrado</SelectItem>
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
              placeholder="Descreva o ocorrido..."
              rows={3}
              required
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
              {isSubmitting ? 'Registrando...' : 'Registrar sinistro'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createQuotaAction } from '@/lib/actions/consortium-quotas'

interface ClientOption {
  id: string
  name: string
  type: string
}

interface CorretorOption {
  id: string
  full_name: string | null
}

interface Props {
  slug: string
  groupId: string
  clients: ClientOption[]
  profiles: CorretorOption[]
}

export function QuotaForm({ slug, groupId, clients, profiles }: Props) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [clientId, setClientId] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors({})

    const form = e.currentTarget
    const fd = new FormData(form)
    fd.set('client_id', clientId)
    fd.set('assigned_to', assignedTo)

    const result = await createQuotaAction(slug, groupId, fd)

    setIsSubmitting(false)

    if (result?.error) {
      if (typeof result.error === 'object') {
        setErrors(result.error as Record<string, string[]>)
        const firstError = Object.values(result.error)[0]
        toast.error(Array.isArray(firstError) ? firstError[0] : 'Erro ao adicionar cota.')
      } else {
        toast.error('Erro ao adicionar cota.')
      }
      return
    }

    toast.success('Cota adicionada com sucesso.')
    setOpen(false)
    form.reset()
    setClientId('')
    setAssignedTo('')
    setErrors({})
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Adicionar cota</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Cota ao Grupo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cliente */}
          <div className="space-y-2">
            <Label htmlFor="client_id">
              Cliente <span className="text-destructive">*</span>
            </Label>
            <Select value={clientId} onValueChange={setClientId} required>
              <SelectTrigger id="client_id">
                <SelectValue placeholder="Selecione o cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.client_id && (
              <p className="text-xs text-destructive">{errors.client_id[0]}</p>
            )}
          </div>

          {/* Corretor responsável */}
          <div className="space-y-2">
            <Label htmlFor="assigned_to">
              Corretor responsável <span className="text-destructive">*</span>
            </Label>
            <Select value={assignedTo} onValueChange={setAssignedTo} required>
              <SelectTrigger id="assigned_to">
                <SelectValue placeholder="Selecione o corretor..." />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name ?? p.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.assigned_to && (
              <p className="text-xs text-destructive">{errors.assigned_to[0]}</p>
            )}
          </div>

          {/* Número da cota */}
          <div className="space-y-2">
            <Label htmlFor="quota_number">
              Número da cota <span className="text-destructive">*</span>
            </Label>
            <Input
              id="quota_number"
              name="quota_number"
              placeholder="Ex.: 001, A-15"
              required
            />
            {errors.quota_number && (
              <p className="text-xs text-destructive">{errors.quota_number[0]}</p>
            )}
          </div>

          {/* Parcela mensal */}
          <div className="space-y-2">
            <Label htmlFor="monthly_payment">
              Parcela mensal (R$) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="monthly_payment"
              name="monthly_payment"
              type="number"
              min="0"
              step="0.01"
              placeholder="Ex.: 500"
              required
            />
            {errors.monthly_payment && (
              <p className="text-xs text-destructive">{errors.monthly_payment[0]}</p>
            )}
          </div>

          {errors._form && (
            <p className="text-sm text-destructive">{errors._form[0]}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adicionando...' : 'Adicionar cota'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

'use client'
import { useRef, useState } from 'react'
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
import { updateGroupAction } from '@/lib/actions/consortium-groups'

interface GroupForEdit {
  id: string
  administrator: string
  type: string // 'auto' | 'imovel' | 'servico'
  credit_value: number
  term_months: number
  total_quotas: number
  next_assembly_date: string | null // ISO date string (yyyy-mm-dd) or null
}

interface Props {
  slug: string
  group: GroupForEdit
}

export function GroupEditDialog({ slug, group }: Props) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [typeState, setTypeState] = useState(group.type)
  const dateInputRef = useRef<HTMLInputElement>(null)

  // Strip time/timezone component so native date input receives yyyy-mm-dd
  const initialDateValue = group.next_assembly_date
    ? group.next_assembly_date.split('T')[0]
    : ''

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const form = e.currentTarget
      const fd = new FormData(form)

      // Controlled select must be explicitly written to FormData
      fd.set('type', typeState)

      const result = await updateGroupAction(slug, group.id, fd)

      if (result?.error) {
        toast.error(result.error)
        return
      }

      toast.success('Grupo atualizado.')
      setOpen(false)
      // Do NOT reset form — pre-filled values would be lost.
      // Closing + reopening pulls fresh data via revalidatePath.
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Editar grupo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar grupo de consórcio</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Administradora */}
          <div className="space-y-2">
            <Label htmlFor="administrator">Administradora</Label>
            <Input
              id="administrator"
              name="administrator"
              defaultValue={group.administrator}
              required
            />
          </div>

          {/* Tipo de consórcio */}
          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <Select value={typeState} onValueChange={setTypeState}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="imovel">Imóvel</SelectItem>
                <SelectItem value="servico">Serviço</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Valor de crédito */}
          <div className="space-y-2">
            <Label htmlFor="credit_value">Valor de crédito (R$)</Label>
            <Input
              id="credit_value"
              name="credit_value"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={group.credit_value}
              required
            />
          </div>

          {/* Prazo em meses */}
          <div className="space-y-2">
            <Label htmlFor="term_months">Prazo (meses)</Label>
            <Input
              id="term_months"
              name="term_months"
              type="number"
              min="1"
              defaultValue={group.term_months}
              required
            />
          </div>

          {/* Total de cotas */}
          <div className="space-y-2">
            <Label htmlFor="total_quotas">Total de cotas</Label>
            <Input
              id="total_quotas"
              name="total_quotas"
              type="number"
              min="1"
              defaultValue={group.total_quotas}
              required
            />
          </div>

          {/* Próxima assembleia — nullable, pode ser limpa */}
          <div className="space-y-2">
            <Label htmlFor="next_assembly_date">Próxima assembleia</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={dateInputRef}
                id="next_assembly_date"
                name="next_assembly_date"
                type="date"
                defaultValue={initialDateValue}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (dateInputRef.current) dateInputRef.current.value = ''
                }}
              >
                Limpar data
              </Button>
            </div>
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
              {isSubmitting ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

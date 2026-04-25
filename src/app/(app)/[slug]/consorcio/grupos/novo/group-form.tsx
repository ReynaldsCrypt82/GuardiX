'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { createGroupAction } from '@/lib/actions/consortium-groups'

interface Props {
  slug: string
}

export function GroupForm({ slug }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [type, setType] = useState('auto')
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors({})

    const form = e.currentTarget
    const fd = new FormData(form)
    fd.set('type', type)

    const result = await createGroupAction(slug, fd)

    setIsSubmitting(false)

    if (result?.error) {
      if (typeof result.error === 'object') {
        setErrors(result.error as Record<string, string[]>)
        const firstError = Object.values(result.error)[0]
        toast.error(Array.isArray(firstError) ? firstError[0] : 'Erro ao criar grupo.')
      } else {
        toast.error('Erro ao criar grupo.')
      }
      return
    }

    if (result?.id) {
      toast.success('Grupo de consórcio criado com sucesso.')
      router.push(`/${slug}/consorcio/${result.id}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Administradora */}
      <div className="space-y-2">
        <Label htmlFor="administrator">
          Administradora <span className="text-destructive">*</span>
        </Label>
        <Input
          id="administrator"
          name="administrator"
          placeholder="Ex.: Bradesco Consórcios"
          required
        />
        {errors.administrator && (
          <p className="text-xs text-destructive">{errors.administrator[0]}</p>
        )}
      </div>

      {/* Tipo */}
      <div className="space-y-2">
        <Label htmlFor="type">
          Tipo de consórcio <span className="text-destructive">*</span>
        </Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger id="type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="imovel">Imóvel</SelectItem>
            <SelectItem value="servico">Serviço</SelectItem>
          </SelectContent>
        </Select>
        {errors.type && (
          <p className="text-xs text-destructive">{errors.type[0]}</p>
        )}
      </div>

      {/* Valor do crédito */}
      <div className="space-y-2">
        <Label htmlFor="credit_value">
          Valor do crédito (R$) <span className="text-destructive">*</span>
        </Label>
        <Input
          id="credit_value"
          name="credit_value"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="Ex.: 50000"
          required
        />
        {errors.credit_value && (
          <p className="text-xs text-destructive">{errors.credit_value[0]}</p>
        )}
      </div>

      {/* Prazo (meses) */}
      <div className="space-y-2">
        <Label htmlFor="term_months">
          Prazo (meses) <span className="text-destructive">*</span>
        </Label>
        <Input
          id="term_months"
          name="term_months"
          type="number"
          min="1"
          step="1"
          placeholder="Ex.: 60"
          required
        />
        {errors.term_months && (
          <p className="text-xs text-destructive">{errors.term_months[0]}</p>
        )}
      </div>

      {/* Data de início */}
      <div className="space-y-2">
        <Label htmlFor="start_date">
          Data de início <span className="text-destructive">*</span>
        </Label>
        <Input id="start_date" name="start_date" type="date" required />
        {errors.start_date && (
          <p className="text-xs text-destructive">{errors.start_date[0]}</p>
        )}
      </div>

      {/* Total de cotas */}
      <div className="space-y-2">
        <Label htmlFor="total_quotas">
          Total de cotas <span className="text-destructive">*</span>
        </Label>
        <Input
          id="total_quotas"
          name="total_quotas"
          type="number"
          min="1"
          step="1"
          placeholder="Ex.: 100"
          required
        />
        {errors.total_quotas && (
          <p className="text-xs text-destructive">{errors.total_quotas[0]}</p>
        )}
      </div>

      {/* Próxima assembleia (opcional) */}
      <div className="space-y-2">
        <Label htmlFor="next_assembly_date">
          Próxima assembleia (opcional)
        </Label>
        <Input id="next_assembly_date" name="next_assembly_date" type="date" />
        {errors.next_assembly_date && (
          <p className="text-xs text-destructive">{errors.next_assembly_date[0]}</p>
        )}
      </div>

      {errors._form && (
        <p className="text-sm text-destructive">{errors._form[0]}</p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Criando...' : 'Criar grupo'}
        </Button>
      </div>
    </form>
  )
}

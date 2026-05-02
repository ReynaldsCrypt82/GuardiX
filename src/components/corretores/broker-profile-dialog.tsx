'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { upsertBrokerProfileAction } from '@/lib/actions/broker-profiles'

interface BrokerProfileData {
  id: string
  susep_number: string | null
  monthly_goal: number
  commission_rate_default: number
  commission_rate_overrides: Record<string, number | undefined> | null
}

interface Props {
  slug: string
  profileId: string
  brokerName: string
  existing?: BrokerProfileData
  triggerVariant?: 'default' | 'outline' | 'ghost'
  triggerSize?: 'default' | 'sm'
  triggerLabel?: string
  // controlled mode: caller manages open state (no DialogTrigger rendered)
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function extractFirstMsg(
  error: Record<string, string[]> | { _form: string[] } | undefined,
): string | undefined {
  if (!error) return undefined
  if ('_form' in error) return error._form?.[0]
  return Object.values(error)[0]?.[0]
}

export function BrokerProfileDialog({
  slug,
  profileId,
  brokerName,
  existing,
  triggerVariant = 'outline',
  triggerSize = 'sm',
  triggerLabel,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setUncontrolledOpen

  const label = triggerLabel ?? (existing ? 'Editar perfil' : 'Completar perfil de corretor')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const fd = new FormData(e.currentTarget)
      const result = await upsertBrokerProfileAction(slug, fd)
      if (result && 'error' in result) {
        const errs = result.error as Record<string, string[]> | { _form: string[] } | undefined
        toast.error(extractFirstMsg(errs) ?? 'Erro ao salvar o perfil. Tente novamente.')
        return
      }
      toast.success('Perfil de corretor atualizado.')
      setOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const overrides = existing?.commission_rate_overrides ?? {}

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant={triggerVariant} size={triggerSize}>
            {label}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Perfil de corretor — {brokerName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Hidden: profile_id */}
          <input type="hidden" name="profile_id" value={profileId} />

          {/* Numero SUSEP */}
          <div className="space-y-2">
            <Label htmlFor="susep_number">Numero SUSEP</Label>
            <Input
              id="susep_number"
              name="susep_number"
              placeholder="Opcional — ex.: 100001234"
              defaultValue={existing?.susep_number ?? ''}
            />
          </div>

          {/* Meta mensal */}
          <div className="space-y-2">
            <Label htmlFor="monthly_goal">Meta mensal (R$)</Label>
            <Input
              id="monthly_goal"
              name="monthly_goal"
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex.: 10000,00"
              defaultValue={existing?.monthly_goal ?? ''}
            />
          </div>

          {/* Taxa de comissao padrao */}
          <div className="space-y-2">
            <Label htmlFor="commission_rate_default">Taxa de comissao padrao (%)</Label>
            <Input
              id="commission_rate_default"
              name="commission_rate_default"
              type="number"
              step="0.0001"
              min="0"
              max="1"
              placeholder="Ex.: 0.05"
              defaultValue={existing?.commission_rate_default ?? ''}
            />
            <p className="text-xs text-muted-foreground">
              Taxa aplicada quando nao ha override por tipo de produto
            </p>
          </div>

          {/* Taxas por tipo de produto */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Taxas por tipo de produto (opcional)</h3>
            <p className="text-xs text-muted-foreground">
              Deixe em branco para usar a taxa padrao
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="override_auto" className="text-xs">Auto</Label>
                <Input
                  id="override_auto"
                  name="override_auto"
                  type="number"
                  step="0.0001"
                  min="0"
                  max="1"
                  placeholder="0.00"
                  defaultValue={overrides['auto'] ?? ''}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="override_vida" className="text-xs">Vida</Label>
                <Input
                  id="override_vida"
                  name="override_vida"
                  type="number"
                  step="0.0001"
                  min="0"
                  max="1"
                  placeholder="0.00"
                  defaultValue={overrides['vida'] ?? ''}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="override_residencial" className="text-xs">Residencial</Label>
                <Input
                  id="override_residencial"
                  name="override_residencial"
                  type="number"
                  step="0.0001"
                  min="0"
                  max="1"
                  placeholder="0.00"
                  defaultValue={overrides['residencial'] ?? ''}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="override_empresarial" className="text-xs">Empresarial</Label>
                <Input
                  id="override_empresarial"
                  name="override_empresarial"
                  type="number"
                  step="0.0001"
                  min="0"
                  max="1"
                  placeholder="0.00"
                  defaultValue={overrides['empresarial'] ?? ''}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="override_saude" className="text-xs">Saude</Label>
                <Input
                  id="override_saude"
                  name="override_saude"
                  type="number"
                  step="0.0001"
                  min="0"
                  max="1"
                  placeholder="0.00"
                  defaultValue={overrides['saude'] ?? ''}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="override_outros" className="text-xs">Outros</Label>
                <Input
                  id="override_outros"
                  name="override_outros"
                  type="number"
                  step="0.0001"
                  min="0"
                  max="1"
                  placeholder="0.00"
                  defaultValue={overrides['outros'] ?? ''}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="override_consorcio_auto" className="text-xs">Consorcio Auto</Label>
                <Input
                  id="override_consorcio_auto"
                  name="override_consorcio_auto"
                  type="number"
                  step="0.0001"
                  min="0"
                  max="1"
                  placeholder="0.00"
                  defaultValue={overrides['consorcio_auto'] ?? ''}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="override_consorcio_imovel" className="text-xs">Consorcio Imovel</Label>
                <Input
                  id="override_consorcio_imovel"
                  name="override_consorcio_imovel"
                  type="number"
                  step="0.0001"
                  min="0"
                  max="1"
                  placeholder="0.00"
                  defaultValue={overrides['consorcio_imovel'] ?? ''}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="override_consorcio_servico" className="text-xs">Consorcio Servico</Label>
                <Input
                  id="override_consorcio_servico"
                  name="override_consorcio_servico"
                  type="number"
                  step="0.0001"
                  min="0"
                  max="1"
                  placeholder="0.00"
                  defaultValue={overrides['consorcio_servico'] ?? ''}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Fechar sem salvar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar perfil'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

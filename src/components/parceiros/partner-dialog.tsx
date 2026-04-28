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
import { createPartnerAction, updatePartnerAction } from '@/lib/actions/partners'

interface PartnerData {
  id: string
  name: string
  cnpj: string | null
  contact_email: string | null
  contact_phone: string | null
  commission_rate_default: number
  commission_rate_overrides: Record<string, number | undefined> | null
}

interface Props {
  slug: string
  existing?: PartnerData
  triggerLabel?: string
  triggerVariant?: 'default' | 'outline' | 'ghost'
  triggerSize?: 'default' | 'sm'
}

function extractFirstMsg(
  error: Record<string, string[]> | { _form: string[] } | undefined,
): string | undefined {
  if (!error) return undefined
  if ('_form' in error) return error._form?.[0]
  return Object.values(error)[0]?.[0]
}

export function PartnerDialog({
  slug,
  existing,
  triggerLabel,
  triggerVariant = 'default',
  triggerSize = 'default',
}: Props) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const label = triggerLabel ?? (existing ? 'Editar parceiro' : 'Novo parceiro')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const fd = new FormData(e.currentTarget)
      const result = existing
        ? await updatePartnerAction(slug, existing.id, fd)
        : await createPartnerAction(slug, fd)

      if (result && 'error' in result) {
        const errs = result.error as Record<string, string[]> | { _form: string[] } | undefined
        toast.error(
          extractFirstMsg(errs) ?? 'Erro ao cadastrar parceiro. Tente novamente.',
        )
        return
      }
      toast.success(existing ? 'Parceiro atualizado com sucesso.' : 'Parceiro cadastrado com sucesso.')
      setOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const overrides = existing?.commission_rate_overrides ?? {}

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existing ? 'Editar parceiro' : 'Novo parceiro'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome do parceiro */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Nome do parceiro <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              required
              minLength={2}
              placeholder="Ex.: Corretora Parceira Ltda."
              defaultValue={existing?.name ?? ''}
            />
          </div>

          {/* CNPJ */}
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ (opcional)</Label>
            <Input
              id="cnpj"
              name="cnpj"
              placeholder="00.000.000/0000-00"
              defaultValue={existing?.cnpj ?? ''}
            />
          </div>

          {/* E-mail de contato */}
          <div className="space-y-2">
            <Label htmlFor="contact_email">E-mail de contato</Label>
            <Input
              id="contact_email"
              name="contact_email"
              type="email"
              placeholder="contato@parceiro.com.br"
              defaultValue={existing?.contact_email ?? ''}
            />
          </div>

          {/* Telefone de contato */}
          <div className="space-y-2">
            <Label htmlFor="contact_phone">Telefone de contato</Label>
            <Input
              id="contact_phone"
              name="contact_phone"
              placeholder="(11) 99999-9999"
              defaultValue={existing?.contact_phone ?? ''}
            />
          </div>

          {/* Taxa de repasse padrao */}
          <div className="space-y-2">
            <Label htmlFor="commission_rate_default">Taxa de repasse padrao (%)</Label>
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
          </div>

          {/* Taxas por tipo de produto */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Taxas por tipo de produto (opcional)</h3>
            <p className="text-xs text-muted-foreground">
              Deixe em branco para usar a taxa padrao
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="p_override_auto" className="text-xs">Auto</Label>
                <Input
                  id="p_override_auto"
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
                <Label htmlFor="p_override_vida" className="text-xs">Vida</Label>
                <Input
                  id="p_override_vida"
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
                <Label htmlFor="p_override_residencial" className="text-xs">Residencial</Label>
                <Input
                  id="p_override_residencial"
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
                <Label htmlFor="p_override_empresarial" className="text-xs">Empresarial</Label>
                <Input
                  id="p_override_empresarial"
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
                <Label htmlFor="p_override_saude" className="text-xs">Saude</Label>
                <Input
                  id="p_override_saude"
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
                <Label htmlFor="p_override_outros" className="text-xs">Outros</Label>
                <Input
                  id="p_override_outros"
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
                <Label htmlFor="p_override_consorcio_auto" className="text-xs">Consorcio Auto</Label>
                <Input
                  id="p_override_consorcio_auto"
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
                <Label htmlFor="p_override_consorcio_imovel" className="text-xs">Consorcio Imovel</Label>
                <Input
                  id="p_override_consorcio_imovel"
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
                <Label htmlFor="p_override_consorcio_servico" className="text-xs">Consorcio Servico</Label>
                <Input
                  id="p_override_consorcio_servico"
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
              Descartar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? existing
                  ? 'Salvando...'
                  : 'Cadastrando...'
                : existing
                  ? 'Salvar parceiro'
                  : 'Cadastrar parceiro'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

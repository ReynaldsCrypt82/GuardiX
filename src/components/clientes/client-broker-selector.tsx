'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { updateClientBrokerAction } from '@/lib/actions/clients'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface Broker {
  id: string
  full_name: string
}

interface Partner {
  id: string
  name: string
}

interface Props {
  clientId: string
  slug: string
  currentAssignedTo: string | null
  currentPartnerId: string | null
  currentBrokerName: string | null
  currentPartnerName: string | null
  isClosed: boolean // stage.name === 'Fechado'
  brokers: Broker[]
  partners: Partner[]
}

export function ClientBrokerSelector({
  clientId,
  slug,
  currentBrokerName,
  currentPartnerName,
  isClosed,
  brokers,
  partners,
  currentAssignedTo,
  currentPartnerId,
}: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string>(
    currentAssignedTo
      ? `broker:${currentAssignedTo}`
      : currentPartnerId
        ? `partner:${currentPartnerId}`
        : '',
  )
  const [isPending, setIsPending] = useState(false)

  const displayName = currentPartnerName
    ? `Parceiro: ${currentPartnerName}`
    : currentBrokerName
      ? `Corretor: ${currentBrokerName}`
      : 'Sem atribuição'

  async function handleSave() {
    setIsPending(true)
    const assignedTo = selected.startsWith('broker:')
      ? selected.replace('broker:', '')
      : undefined
    const partnerId = selected.startsWith('partner:')
      ? selected.replace('partner:', '')
      : undefined
    const result = await updateClientBrokerAction({ clientId, assignedTo, partnerId, slug })
    setIsPending(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Corretor/parceiro atualizado.')
    setOpen(false)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{displayName}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isClosed}
            title={isClosed ? 'Bloqueado: cliente Fechado' : 'Alterar corretor/parceiro'}
          >
            {isClosed ? 'Bloqueado' : 'Alterar'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3" align="start">
          <p className="text-sm font-medium">Alterar corretor/parceiro</p>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {brokers.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Corretores Internos
                  </div>
                  {brokers.map((b) => (
                    <SelectItem key={b.id} value={`broker:${b.id}`}>
                      {b.full_name}
                    </SelectItem>
                  ))}
                </>
              )}
              {partners.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Parceiros Externos
                  </div>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={`partner:${p.id}`}>
                      {p.name}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={isPending || !selected}>
              {isPending ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

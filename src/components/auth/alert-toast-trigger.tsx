'use client'
import { useEffect } from 'react'
import { toast } from 'sonner'

interface AlertToastTriggerProps {
  policiesCount: number
  assembliesCount: number
}

export function AlertToastTrigger({
  policiesCount,
  assembliesCount,
}: AlertToastTriggerProps) {
  useEffect(() => {
    if (policiesCount > 0) {
      toast.warning(
        `${policiesCount} apólice${policiesCount > 1 ? 's' : ''} vencendo ou vencida${policiesCount > 1 ? 's' : ''}`,
        {
          description: 'Acesse Seguros para revisar.',
          duration: 6000,
          id: 'policies-alert', // evita toasts duplicados no mesmo render
        },
      )
    }
    if (assembliesCount > 0) {
      toast.info(
        `${assembliesCount} assembleia${assembliesCount > 1 ? 's' : ''} nos próximos 3 dias`,
        {
          description: 'Acesse Consórcio para verificar.',
          duration: 6000,
          id: 'assembly-alert',
        },
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // dispara apenas no mount — ao abrir o sistema

  return null // sem UI — apenas side effect de toast
}

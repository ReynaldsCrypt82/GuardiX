'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ChevronDown } from 'lucide-react'
import { updateClientStage } from '@/lib/actions/pipeline'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Stage {
  id: string
  name: string
  color: string
}

interface ClientStageSelectorProps {
  slug: string
  clientId: string
  currentStage: Stage | null
  stages: Stage[]
  canEdit: boolean
}

export function ClientStageSelector({
  slug,
  clientId,
  currentStage,
  stages,
  canEdit,
}: ClientStageSelectorProps) {
  // Optimistic state — imediatamente atualiza antes da resposta do server
  const [optimisticStage, setOptimisticStage] = useState<Stage | null>(currentStage)
  const [isPending, startTransition] = useTransition()

  function handleSelect(stage: Stage) {
    if (stage.id === optimisticStage?.id) return

    const previousStage = optimisticStage
    // Optimistic update
    setOptimisticStage(stage)

    startTransition(async () => {
      const result = await updateClientStage(slug, {
        clientId,
        stageId: stage.id,
      })

      if (result?.error) {
        // Reverter em caso de erro
        setOptimisticStage(previousStage)
        toast.error(result.error._form?.[0] ?? 'Erro ao atualizar estágio')
      }
      // Sucesso: o estado local já foi atualizado optimisticamente;
      // revalidatePath no server action atualiza o cache para recarregamentos futuros
    })
  }

  // Badge sem interação (somente leitura)
  const stageBadge = optimisticStage ? (
    <Badge
      style={{
        backgroundColor: optimisticStage.color,
        color: '#fff',
        border: 'none',
        opacity: isPending ? 0.6 : 1,
        transition: 'opacity 150ms',
      }}
    >
      {optimisticStage.name}
    </Badge>
  ) : (
    <span className="text-muted-foreground">—</span>
  )

  if (!canEdit) {
    return <>{stageBadge}</>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          disabled={isPending}
          aria-label="Alterar estágio do cliente"
        >
          {stageBadge}
          <ChevronDown className="size-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        {stages.map((stage) => (
          <DropdownMenuItem
            key={stage.id}
            onSelect={() => handleSelect(stage)}
            className="flex items-center gap-2"
          >
            <div
              className="size-3 rounded-full"
              style={{ backgroundColor: stage.color }}
            />
            <span>{stage.name}</span>
            {stage.id === optimisticStage?.id && (
              <span className="ml-auto text-xs text-muted-foreground">atual</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

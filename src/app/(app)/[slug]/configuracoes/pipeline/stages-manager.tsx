'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createStage } from '@/lib/actions/pipeline'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StageDeleteDialog } from './stage-delete-dialog'

interface Stage {
  id: string
  name: string
  color: string
  position: number
  is_closed: boolean
  clientCount: number
}

interface StagesManagerProps {
  slug: string
  stages: Stage[]
}

export function StagesManager({ slug, stages }: StagesManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Form state para novo estágio
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')
  const [isClosed, setIsClosed] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  // Estágio default para o dialog de deleção (primeiro da lista excluindo o alvo)
  function getDefaultStageFor(excludeId: string): string {
    return stages.find((s) => s.id !== excludeId)?.name ?? '—'
  }

  async function handleAddStage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFieldErrors({})

    const fd = new FormData()
    fd.append('name', name)
    fd.append('color', color)
    fd.append('is_closed', String(isClosed))

    startTransition(async () => {
      const result = await createStage(slug, fd)
      if (result?.error) {
        setFieldErrors(result.error)
        const formErr = result.error._form?.[0]
        if (formErr) toast.error(formErr)
        return
      }
      toast.success('Estágio criado com sucesso!')
      setName('')
      setColor('#3b82f6')
      setIsClosed(false)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* Lista de estágios */}
      <section className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <h2 className="font-medium">Estágios ativos ({stages.length})</h2>
        </div>

        {stages.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhum estágio configurado. Adicione o primeiro estágio abaixo.
          </div>
        ) : (
          <ul className="divide-y">
            {stages.map((stage) => (
              <li
                key={stage.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                {/* Swatch de cor + info */}
                <div className="flex items-center gap-3">
                  <div
                    className="size-4 rounded-full border"
                    style={{ backgroundColor: stage.color }}
                    aria-label={`Cor ${stage.color}`}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{stage.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Posição {stage.position} &middot; {stage.clientCount} cliente(s)
                    </span>
                  </div>
                </div>

                {/* Badges e ação */}
                <div className="flex items-center gap-2">
                  {stage.is_closed && (
                    <Badge variant="secondary" className="text-xs">
                      Fechado
                    </Badge>
                  )}

                  <StageDeleteDialog
                    stage={{
                      id: stage.id,
                      name: stage.name,
                      clientCount: stage.clientCount,
                    }}
                    defaultStageName={getDefaultStageFor(stage.id)}
                    slug={slug}
                    disabled={stages.length <= 1}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Formulário para adicionar novo estágio */}
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 font-medium">Adicionar estágio</h2>
        <form onSubmit={handleAddStage} className="space-y-3">
          {/* Nome */}
          <div className="space-y-1">
            <label htmlFor="stage-name" className="text-sm font-medium">
              Nome
            </label>
            <Input
              id="stage-name"
              placeholder="Ex: Em análise"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              disabled={isPending}
            />
            {fieldErrors.name && (
              <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>
            )}
          </div>

          {/* Cor */}
          <div className="space-y-1">
            <label htmlFor="stage-color" className="text-sm font-medium">
              Cor
            </label>
            <div className="flex items-center gap-2">
              <input
                id="stage-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={isPending}
                className="h-9 w-14 cursor-pointer rounded border px-1"
              />
              <span className="font-mono text-sm text-muted-foreground">{color}</span>
            </div>
            {fieldErrors.color && (
              <p className="text-xs text-destructive">{fieldErrors.color[0]}</p>
            )}
          </div>

          {/* is_closed */}
          <div className="flex items-center gap-2">
            <input
              id="stage-closed"
              type="checkbox"
              checked={isClosed}
              onChange={(e) => setIsClosed(e.target.checked)}
              disabled={isPending}
              className="size-4 rounded"
            />
            <label htmlFor="stage-closed" className="text-sm">
              Estágio de encerramento (ganho ou perdido)
            </label>
          </div>

          {fieldErrors._form && (
            <p className="text-xs text-destructive">{fieldErrors._form[0]}</p>
          )}

          <Button type="submit" disabled={isPending} size="sm">
            {isPending ? 'Adicionando...' : 'Adicionar estágio'}
          </Button>
        </form>
      </section>
    </div>
  )
}

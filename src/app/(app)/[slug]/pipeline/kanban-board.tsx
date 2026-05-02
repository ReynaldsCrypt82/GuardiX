'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronRight, User } from 'lucide-react'
import { moveClientStage } from '@/lib/actions/crm'

interface Stage {
  id: string
  name: string
  color: string
  position: number
  is_closed: boolean
}

interface Client {
  id: string
  name: string
  type: string
  document: string
  stage_id: string | null
  assigned_to: { full_name: string } | null
}

interface Props {
  slug: string
  stages: Stage[]
  clients: Client[]
  canEdit: boolean
}

export function KanbanBoard({ slug, stages, clients, canEdit }: Props) {
  const [localClients, setLocalClients] = useState(clients)
  const [, startTransition] = useTransition()

  function getClientsForStage(stageId: string) {
    return localClients.filter((c) => c.stage_id === stageId)
  }

  // Sem stage definido
  const unassigned = localClients.filter((c) => !c.stage_id)

  function handleMove(clientId: string, newStageId: string) {
    // Optimistic update
    setLocalClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, stage_id: newStageId } : c)),
    )
    startTransition(async () => {
      await moveClientStage(clientId, newStageId, slug)
    })
  }

  function formatDoc(doc: string, type: string) {
    if (type === 'pf' && doc.length === 11)
      return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    if (type === 'pj' && doc.length === 14)
      return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    return doc
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
      {stages.map((stage) => {
        const stageClients = getClientsForStage(stage.id)
        return (
          <div key={stage.id} className="flex flex-col gap-2 min-w-72 w-72 shrink-0">
            {/* Cabeçalho da coluna */}
            <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: stage.color + '18' }}>
              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
              <span className="text-sm font-semibold flex-1 truncate" style={{ color: stage.color }}>
                {stage.name}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {stageClients.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 min-h-16">
              {stageClients.map((client) => (
                <KanbanCard
                  key={client.id}
                  client={client}
                  slug={slug}
                  stages={stages}
                  canEdit={canEdit}
                  onMove={handleMove}
                  formatDoc={formatDoc}
                />
              ))}
              {stageClients.length === 0 && (
                <div className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                  Sem clientes
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Coluna para clientes sem stage */}
      {unassigned.length > 0 && (
        <div className="flex flex-col gap-2 min-w-72 w-72 shrink-0">
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
            <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground shrink-0" />
            <span className="text-sm font-semibold flex-1 text-muted-foreground">Sem etapa</span>
            <span className="text-xs text-muted-foreground">{unassigned.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {unassigned.map((client) => (
              <KanbanCard
                key={client.id}
                client={client}
                slug={slug}
                stages={stages}
                canEdit={canEdit}
                onMove={handleMove}
                formatDoc={formatDoc}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function KanbanCard({
  client, slug, stages, canEdit, onMove, formatDoc,
}: {
  client: Client
  slug: string
  stages: Stage[]
  canEdit: boolean
  onMove: (clientId: string, stageId: string) => void
  formatDoc: (doc: string, type: string) => string
}) {
  const [showMove, setShowMove] = useState(false)

  return (
    <div className="group relative rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow">
      <div className="p-3 space-y-2">
        {/* Nome + link */}
        <div className="flex items-start justify-between gap-1">
          <Link
            href={`/${slug}/clientes/${client.id}`}
            className="text-sm font-semibold leading-tight hover:text-primary transition-colors flex-1 min-w-0 truncate"
          >
            {client.name}
          </Link>
          <Link href={`/${slug}/clientes/${client.id}`} className="shrink-0 text-muted-foreground hover:text-primary">
            <ChevronRight size={14} />
          </Link>
        </div>

        {/* Documento */}
        <p className="text-xs text-muted-foreground font-mono">
          {formatDoc(client.document, client.type)}
        </p>

        {/* Corretor */}
        {client.assigned_to && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <User size={11} />
            <span className="truncate">{client.assigned_to.full_name}</span>
          </div>
        )}

        {/* Mover etapa */}
        {canEdit && (
          <div className="pt-1">
            {showMove ? (
              <div className="space-y-1">
                {stages.map((s) =>
                  s.id === client.stage_id ? null : (
                    <button
                      key={s.id}
                      onClick={() => { onMove(client.id, s.id); setShowMove(false) }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-muted transition-colors"
                    >
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </button>
                  ),
                )}
                <button
                  onClick={() => setShowMove(false)}
                  className="w-full rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowMove(true)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
              >
                Mover etapa →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

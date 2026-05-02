'use client'
import { useState, useTransition } from 'react'
import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { updateClientCategory } from '@/lib/actions/crm'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Category = 'novo' | 'renovacao' | null

const LABELS: Record<string, string> = { novo: 'Novo', renovacao: 'Renovação' }
const COLORS: Record<string, string> = {
  novo:      'bg-blue-500/15 text-blue-600 border-blue-300',
  renovacao: 'bg-emerald-500/15 text-emerald-600 border-emerald-300',
}

interface Props {
  slug: string
  clientId: string
  current: Category
  canEdit: boolean
}

export function ClientCategorySelector({ slug, clientId, current, canEdit }: Props) {
  const [optimistic, setOptimistic] = useState<Category>(current)
  const [isPending, startTransition] = useTransition()

  function handleSelect(value: Category) {
    if (value === optimistic) return
    const prev = optimistic
    setOptimistic(value)
    startTransition(async () => {
      const res = await updateClientCategory(clientId, value, slug)
      if (res.error) {
        setOptimistic(prev)
        toast.error(res.error)
      }
    })
  }

  const badge = optimistic ? (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-opacity ${COLORS[optimistic]} ${isPending ? 'opacity-50' : ''}`}>
      {LABELS[optimistic]}
    </span>
  ) : (
    <span className="text-muted-foreground text-sm">—</span>
  )

  if (!canEdit) return <>{badge}</>

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isPending}
          className="flex cursor-pointer items-center gap-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {badge}
          <ChevronDown className="size-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => handleSelect('novo')}>
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-blue-500" />
          Novo
          {optimistic === 'novo' && <span className="ml-auto text-xs text-muted-foreground">atual</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleSelect('renovacao')}>
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Renovação
          {optimistic === 'renovacao' && <span className="ml-auto text-xs text-muted-foreground">atual</span>}
        </DropdownMenuItem>
        {optimistic && (
          <DropdownMenuItem onSelect={() => handleSelect(null)} className="text-muted-foreground">
            Remover categoria
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const config = {
  comissao: {
    label: 'Comissao',
    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  },
  estorno: {
    label: 'Estorno',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
  },
  correcao: {
    label: 'Correcao',
    className: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
  },
} as const

export type CommissionEntryType = keyof typeof config

export function CommissionEntryBadge({ entryType }: { entryType: CommissionEntryType }) {
  const c = config[entryType]
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', c.className)}>
      {c.label}
    </Badge>
  )
}

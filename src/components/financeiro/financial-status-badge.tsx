import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const config = {
  pending: {
    label: 'Pendente',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100',
  },
  paid: {
    label: 'Pago',
    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  },
  cancelled: {
    label: 'Cancelado',
    className: 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100',
  },
} as const

export type FinancialEntryStatus = keyof typeof config

export function FinancialStatusBadge({ status }: { status: FinancialEntryStatus }) {
  const c = config[status]
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', c.className)}>
      {c.label}
    </Badge>
  )
}

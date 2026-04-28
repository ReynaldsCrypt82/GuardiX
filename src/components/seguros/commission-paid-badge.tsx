import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Props {
  paidAt: string // ISO timestamp from commission_paid_at
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export function CommissionPaidBadge({ paidAt }: Props) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
      )}
    >
      Comissao paga em {formatDate(paidAt)}
    </Badge>
  )
}

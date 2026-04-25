import { Badge } from '@/components/ui/badge'
import { getVigenciaStatus } from '@/lib/utils/vigencia'
import { cn } from '@/lib/utils'

const statusConfig = {
  verde: {
    label: 'Vigente',
    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  },
  amarelo: {
    label: 'A vencer',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100',
  },
  vermelho: {
    label: 'Vencida',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
  },
}

export function VigenciaBadge({ vigencia_fim }: { vigencia_fim: string }) {
  const status = getVigenciaStatus(vigencia_fim)
  const { label, className } = statusConfig[status]
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', className)}>
      {label}
    </Badge>
  )
}

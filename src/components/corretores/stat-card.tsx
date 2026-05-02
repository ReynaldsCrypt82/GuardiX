import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

type Variant = 'default' | 'success' | 'warning' | 'danger'

interface Props {
  title: string
  value: string
  subtext?: string
  progress?: number
  progressOverflow?: boolean
  icon?: React.ReactNode
  variant?: Variant
}

const stripeClass: Record<Variant, string> = {
  default: 'bg-primary',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
}

const iconClass: Record<Variant, string> = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger:  'bg-red-50 text-red-600',
}

export function StatCard({ title, value, subtext, progress, progressOverflow, icon, variant = 'default' }: Props) {
  return (
    <div className="relative rounded-xl border bg-card shadow-sm overflow-hidden transition-shadow hover:shadow-md">
      <div className={cn('absolute top-0 left-0 right-0 h-0.5', stripeClass[variant])} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
              {title}
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
            {subtext && (
              <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
            )}
          </div>
          {icon && (
            <div className={cn('flex-shrink-0 rounded-lg p-2.5', iconClass[variant])}>
              {icon}
            </div>
          )}
        </div>
        {progress !== undefined && (
          <div className="mt-4">
            <Progress
              value={Math.min(progress, 100)}
              className={progressOverflow ? '[&>div]:bg-emerald-500' : ''}
            />
          </div>
        )}
      </div>
    </div>
  )
}

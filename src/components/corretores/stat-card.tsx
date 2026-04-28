import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface Props {
  title: string
  value: string
  subtext?: string
  progress?: number
  progressOverflow?: boolean
}

export function StatCard({ title, value, subtext, progress, progressOverflow }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-2xl font-semibold">{value}</p>
        {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
        {progress !== undefined && (
          <Progress
            value={Math.min(progress, 100)}
            className={progressOverflow ? '[&>div]:bg-green-500' : ''}
          />
        )}
      </CardContent>
    </Card>
  )
}

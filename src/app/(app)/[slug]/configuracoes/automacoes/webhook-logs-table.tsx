// Phase 07 Plan 03 — Server Component: tabela read-only de webhook_logs
// D-03: admin visualiza historico de disparos. T-07-01: RLS garante isolamento por tenant.

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Log = {
  id: string
  event_type: string
  url_destino: string
  http_status: number | null
  error_message: string | null
  triggered_at: string
}

interface WebhookLogsTableProps {
  logs: Log[]
  eventLabels: Record<string, string>
}

export function WebhookLogsTable({ logs, eventLabels }: WebhookLogsTableProps) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nenhum disparo registrado ainda.</p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Quando</TableHead>
          <TableHead>Evento</TableHead>
          <TableHead>URL</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Erro</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell>
              {format(new Date(log.triggered_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
            </TableCell>
            <TableCell>{eventLabels[log.event_type] ?? log.event_type}</TableCell>
            <TableCell className="max-w-xs truncate text-xs">{log.url_destino}</TableCell>
            <TableCell>
              <span
                className={
                  log.http_status != null && log.http_status >= 200 && log.http_status < 300
                    ? 'text-green-600 font-medium'
                    : 'text-destructive font-medium'
                }
              >
                {log.http_status ?? '—'}
              </span>
            </TableCell>
            <TableCell className="max-w-xs truncate text-xs text-destructive">
              {log.error_message ?? ''}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

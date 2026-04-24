'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatDocument } from '@/lib/utils/format-document'

interface Client {
  id: string
  name: string
  type: 'pf' | 'pj'
  document: string
  created_at: string
  assigned_to: { id: string; full_name: string | null } | null
  stage: { id: string; name: string; color: string } | null
}

interface ClientsTableProps {
  slug: string
  clients: Client[]
}

export function ClientsTable({ slug, clients }: ClientsTableProps) {
  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">Nenhum cliente corresponde aos filtros.</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Documento</TableHead>
          <TableHead>Corretor</TableHead>
          <TableHead>Estágio</TableHead>
          <TableHead>Cadastrado em</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((c) => (
          <TableRow key={c.id} className="cursor-pointer">
            <TableCell>
              <Link
                href={`/${slug}/clientes/${c.id}`}
                className="font-medium hover:underline"
              >
                {c.name}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant={c.type === 'pf' ? 'secondary' : 'outline'}>
                {c.type === 'pf' ? 'PF' : 'PJ'}
              </Badge>
            </TableCell>
            <TableCell className="font-mono text-sm">
              {formatDocument(c.document, c.type)}
            </TableCell>
            <TableCell>{c.assigned_to?.full_name ?? '—'}</TableCell>
            <TableCell>
              {c.stage ? (
                <Badge
                  style={{ backgroundColor: c.stage.color, color: '#fff', border: 'none' }}
                >
                  {c.stage.name}
                </Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {format(new Date(c.created_at), 'dd/MM/yyyy', { locale: ptBR })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

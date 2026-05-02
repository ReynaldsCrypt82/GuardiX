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
import { ClientStageSelector } from './client-stage-selector'
import { ClientCategorySelector } from './client-category-selector'

interface Stage {
  id: string
  name: string
  color: string
}

interface Client {
  id: string
  name: string
  type: 'pf' | 'pj'
  document: string
  created_at: string
  category: 'novo' | 'renovacao' | null
  assigned_to: { id: string; full_name: string | null } | null
  stage: Stage | null
}

interface ClientsTableProps {
  slug: string
  clients: Client[]
  stages: Stage[]
  userRole: string
  userId: string
  overdueClientIds: Set<string>
}

export function ClientsTable({
  slug,
  clients,
  stages,
  userRole,
  userId,
  overdueClientIds,
}: ClientsTableProps) {
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
          <TableHead>Categoria</TableHead>
          <TableHead>Cadastrado em</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((c) => {
          // canEdit: admin pode editar qualquer cliente;
          // corretor só pode editar clientes atribuídos a si mesmo (D-08, T-02-22)
          const canEdit =
            userRole === 'admin' ||
            (userRole === 'corretor' && c.assigned_to?.id === userId)

          return (
            <TableRow key={c.id} className="cursor-pointer">
              <TableCell>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/${slug}/clientes/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                  {overdueClientIds.has(c.id) && (
                    <Badge variant="destructive" className="text-[10px]">
                      Inadimplente
                    </Badge>
                  )}
                </div>
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
                <ClientStageSelector
                  slug={slug}
                  clientId={c.id}
                  currentStage={c.stage}
                  stages={stages}
                  canEdit={canEdit}
                />
              </TableCell>
              <TableCell>
                <ClientCategorySelector
                  slug={slug}
                  clientId={c.id}
                  current={c.category}
                  canEdit={canEdit}
                />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {format(new Date(c.created_at), 'dd/MM/yyyy', { locale: ptBR })}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

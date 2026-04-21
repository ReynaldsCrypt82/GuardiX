'use client'
import { useState, useTransition } from 'react'
import { MoreHorizontal, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { resendInvite, cancelInvite } from '@/lib/actions/invites'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Profile {
  id: string
  full_name: string | null
  role: 'admin' | 'corretor' | 'financeiro' | 'visualizador'
  active: boolean
}

interface Invite {
  id: string
  email: string
  role: 'admin' | 'corretor' | 'financeiro' | 'visualizador'
  expires_at: string
}

interface UserTableProps {
  profiles: Profile[]
  invites: Invite[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  corretor: 'Corretor',
  financeiro: 'Financeiro',
  visualizador: 'Visualizador',
}

const ROLE_BADGE_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline'
> = {
  admin: 'default',
  corretor: 'secondary',
  financeiro: 'outline',
  visualizador: 'outline',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function UserTable({ profiles, invites }: UserTableProps) {
  const [, startTransition] = useTransition()
  const [cancelTarget, setCancelTarget] = useState<Invite | null>(null)

  const isEmpty = profiles.length === 0 && invites.length === 0

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-12 text-center">
        <UserPlus className="h-10 w-10 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold">Nenhum usuário convidado ainda</h3>
          <p className="text-sm text-muted-foreground">
            Convide corretores, financeiro ou visualizadores para colaborar na
            sua corretora.
          </p>
        </div>
      </div>
    )
  }

  function handleResend(invite: Invite) {
    startTransition(async () => {
      const result = await resendInvite(invite.id)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`Convite reenviado para ${invite.email}`)
      }
    })
  }

  function handleCancelConfirm(invite: Invite) {
    setCancelTarget(invite)
  }

  function handleCancelExecute() {
    if (!cancelTarget) return
    const target = cancelTarget
    setCancelTarget(null)
    startTransition(async () => {
      const result = await cancelInvite(target.id)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.info('Convite cancelado')
      }
    })
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Papel</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Active profiles */}
          {profiles.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-semibold">
                {p.full_name ?? '—'}
              </TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell>
                <Badge variant={ROLE_BADGE_VARIANT[p.role] ?? 'secondary'}>
                  {ROLE_LABELS[p.role] ?? p.role}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-green-700 border-green-300">
                  Ativo
                </Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Ações</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled>Alterar papel</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" disabled>
                      Remover usuário
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}

          {/* Pending invites */}
          {invites.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell>{inv.email}</TableCell>
              <TableCell>
                <Badge variant={ROLE_BADGE_VARIANT[inv.role] ?? 'secondary'}>
                  {ROLE_LABELS[inv.role] ?? inv.role}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">Convite pendente</Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Ações</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleResend(inv)}>
                      Reenviar convite
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleCancelConfirm(inv)}
                    >
                      Cancelar convite
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Cancel invite confirmation dialog */}
      <AlertDialog
        open={cancelTarget !== null}
        onOpenChange={(isOpen: boolean) => { if (!isOpen) setCancelTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cancelar convite para {cancelTarget?.email}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O link de convite enviado deixará de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter convite</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCancelExecute}
            >
              Sim, cancelar convite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

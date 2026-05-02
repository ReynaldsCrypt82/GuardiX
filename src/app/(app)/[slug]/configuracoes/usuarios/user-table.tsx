'use client'
import { useState, useTransition } from 'react'
import { MoreHorizontal, UserPlus, UserCheck, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { deactivateUser, reactivateUser } from '@/lib/actions/users'
import { resendInvite, cancelInvite } from '@/lib/actions/invites'
import { EditUserDialog } from './edit-user-dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  role: 'admin' | 'corretor' | 'financeiro' | 'visualizador'
  active: boolean
}

interface Invite {
  id: string
  email: string
  role: 'admin' | 'corretor' | 'financeiro' | 'visualizador'
  expires_at: string
}

interface Props {
  slug: string
  currentUserId: string
  profiles: Profile[]
  invites: Invite[]
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  corretor: 'Corretor',
  financeiro: 'Financeiro',
  visualizador: 'Visualizador',
}

const ROLE_COLORS: Record<string, string> = {
  admin:        'bg-blue-500/10 text-blue-600 border-blue-200',
  corretor:     'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  financeiro:   'bg-amber-500/10 text-amber-600 border-amber-200',
  visualizador: 'bg-muted text-muted-foreground border-border',
}

export function UserTable({ slug, currentUserId, profiles, invites }: Props) {
  const [, startTransition] = useTransition()
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string; action: 'deactivate' | 'reactivate' } | null>(null)
  const [cancelTarget, setCancelTarget]   = useState<Invite | null>(null)

  const active   = profiles.filter((p) => p.active)
  const inactive = profiles.filter((p) => !p.active)
  const isEmpty  = profiles.length === 0 && invites.length === 0

  function handleDeactivate(profile: Profile) {
    setConfirmTarget({ id: profile.id, name: profile.full_name ?? profile.email ?? 'Usuário', action: 'deactivate' })
  }

  function handleReactivate(profile: Profile) {
    setConfirmTarget({ id: profile.id, name: profile.full_name ?? profile.email ?? 'Usuário', action: 'reactivate' })
  }

  function executeConfirm() {
    if (!confirmTarget) return
    const target = confirmTarget
    setConfirmTarget(null)
    startTransition(async () => {
      const res = target.action === 'deactivate'
        ? await deactivateUser(slug, target.id)
        : await reactivateUser(slug, target.id)
      if (res.error) toast.error(res.error)
      else toast.success(target.action === 'deactivate' ? 'Usuário desativado' : 'Usuário reativado')
    })
  }

  function handleResend(invite: Invite) {
    startTransition(async () => {
      const res = await resendInvite(invite.id)
      if (res?.error) toast.error(res.error)
      else toast.success(`Convite reenviado para ${invite.email}`)
    })
  }

  function handleCancelInvite() {
    if (!cancelTarget) return
    const target = cancelTarget
    setCancelTarget(null)
    startTransition(async () => {
      const res = await cancelInvite(target.id)
      if (res?.error) toast.error(res.error)
      else toast.info('Convite cancelado')
    })
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-12 text-center">
        <UserPlus className="h-10 w-10 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold">Nenhum usuário cadastrado</h3>
          <p className="text-sm text-muted-foreground">
            Convide corretores, financeiro ou visualizadores para colaborar na sua corretora.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>

            {/* ── Usuários ativos ── */}
            {active.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  {p.full_name ?? <span className="text-muted-foreground italic">Sem nome</span>}
                  {p.id === currentUserId && (
                    <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {p.email ?? '—'}
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[p.role] ?? ''}`}>
                    {ROLE_LABELS[p.role] ?? p.role}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                    <UserCheck size={13} />
                    Ativo
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <EditUserDialog
                        slug={slug}
                        user={p}
                        isSelf={p.id === currentUserId}
                      />
                      {p.id !== currentUserId && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeactivate(p)}
                          >
                            <UserX size={14} className="mr-2" />
                            Desativar
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}

            {/* ── Usuários inativos ── */}
            {inactive.map((p) => (
              <TableRow key={p.id} className="opacity-50">
                <TableCell className="font-medium">
                  {p.full_name ?? <span className="italic">Sem nome</span>}
                </TableCell>
                <TableCell className="text-sm">{p.email ?? '—'}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[p.role] ?? ''}`}>
                    {ROLE_LABELS[p.role] ?? p.role}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <UserX size={13} />
                    Inativo
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => handleReactivate(p)}>
                        <UserCheck size={14} className="mr-2" />
                        Reativar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}

            {/* ── Convites pendentes ── */}
            {invites.map((inv) => (
              <TableRow key={inv.id} className="bg-muted/20">
                <TableCell className="text-muted-foreground italic text-sm">Aguardando aceite</TableCell>
                <TableCell className="text-sm">{inv.email}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[inv.role] ?? ''}`}>
                    {ROLE_LABELS[inv.role] ?? inv.role}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">Convite pendente</Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => handleResend(inv)}>
                        Reenviar convite
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setCancelTarget(inv)}
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
      </div>

      {/* Confirm deactivate / reactivate */}
      <AlertDialog open={confirmTarget !== null} onOpenChange={(o) => { if (!o) setConfirmTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmTarget?.action === 'deactivate'
                ? `Desativar ${confirmTarget?.name}?`
                : `Reativar ${confirmTarget?.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget?.action === 'deactivate'
                ? 'O usuário perderá acesso imediatamente e todas as sessões serão encerradas.'
                : 'O usuário poderá fazer login normalmente após a reativação.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeConfirm}
              className={confirmTarget?.action === 'deactivate' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {confirmTarget?.action === 'deactivate' ? 'Sim, desativar' : 'Sim, reativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm cancel invite */}
      <AlertDialog open={cancelTarget !== null} onOpenChange={(o) => { if (!o) setCancelTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar convite para {cancelTarget?.email}?</AlertDialogTitle>
            <AlertDialogDescription>O link de convite enviado deixará de funcionar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter convite</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCancelInvite}
            >
              Cancelar convite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

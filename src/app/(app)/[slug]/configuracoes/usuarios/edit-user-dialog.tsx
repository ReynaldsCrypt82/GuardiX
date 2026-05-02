'use client'
import { useState, useTransition } from 'react'
import { Pencil, Loader2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { updateUserProfile, generatePasswordLink } from '@/lib/actions/users'

const ROLES = [
  { value: 'admin',        label: 'Administrador' },
  { value: 'corretor',     label: 'Corretor' },
  { value: 'financeiro',   label: 'Financeiro' },
  { value: 'visualizador', label: 'Visualizador' },
]

interface Props {
  slug: string
  user: {
    id: string
    full_name: string | null
    email: string | null
    role: string
  }
  isSelf: boolean
}

export function EditUserDialog({ slug, user, isSelf }: Props) {
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState(user.full_name ?? '')
  const [email, setEmail]       = useState(user.email ?? '')
  const [role, setRole]         = useState(user.role)
  const [error, setError]       = useState('')
  const [link, setLink]         = useState('')
  const [copied, setCopied]     = useState(false)
  const [pending, startTransition] = useTransition()
  const [linkPending, startLinkTransition] = useTransition()

  function handleOpen() {
    setFullName(user.full_name ?? '')
    setEmail(user.email ?? '')
    setRole(user.role)
    setError('')
    setLink('')
    setOpen(true)
  }

  function handleSave() {
    setError('')
    startTransition(async () => {
      const res = await updateUserProfile(slug, user.id, {
        full_name: fullName,
        role: role as 'admin' | 'corretor' | 'financeiro' | 'visualizador',
        email,
      })
      if (res.error) {
        setError(res.error)
      } else {
        toast.success('Usuário atualizado')
        setOpen(false)
      }
    })
  }

  function handleGenerateLink() {
    startLinkTransition(async () => {
      const res = await generatePasswordLink(user.id)
      if (res.error) {
        toast.error(res.error)
      } else {
        setLink(res.link ?? '')
      }
    })
  }

  function handleCopy() {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded-sm"
      >
        <Pencil size={14} />
        Editar
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nome */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nome completo</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nome do usuário"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* E-mail */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">E-mail</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="email@exemplo.com"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Perfil de acesso */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Perfil de acesso</label>
              <Select
                value={role}
                onValueChange={setRole}
                disabled={isSelf}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isSelf && (
                <p className="text-xs text-muted-foreground">
                  Você não pode alterar seu próprio perfil.
                </p>
              )}
            </div>

            {/* Resetar senha */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-sm font-medium">Redefinir senha</p>
              <p className="text-xs text-muted-foreground">
                Gera um link de acesso único para enviar ao usuário.
              </p>
              {link ? (
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={link}
                    className="flex-1 rounded-md border bg-background px-2 py-1 text-xs font-mono truncate focus:outline-none"
                  />
                  <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0">
                    {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateLink}
                  disabled={linkPending}
                >
                  {linkPending && <Loader2 size={13} className="mr-1.5 animate-spin" />}
                  Gerar link de acesso
                </Button>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={pending}>
              {pending && <Loader2 size={13} className="mr-1.5 animate-spin" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

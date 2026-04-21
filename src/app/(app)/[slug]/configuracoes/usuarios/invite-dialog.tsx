'use client'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { inviteSchema } from '@/lib/validations/auth-schemas'
import { inviteUser } from '@/lib/actions/invites'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

type InviteValues = z.infer<typeof inviteSchema>

// Role options in UI-SPEC order (lines 315-316): Administrador, Corretor, Financeiro, Visualizador
const ROLE_OPTIONS = [
  {
    value: 'admin',
    label: 'Administrador',
    description: 'Acesso total, incluindo configurações e faturamento',
  },
  {
    value: 'corretor',
    label: 'Corretor',
    description: 'Gerencia sua própria carteira de clientes e apólices',
  },
  {
    value: 'financeiro',
    label: 'Financeiro',
    description: 'Visualiza e gerencia contas a receber e a pagar',
  },
  {
    value: 'visualizador',
    label: 'Visualizador',
    description: 'Apenas visualiza — não cria nem edita registros',
  },
] as const

export function InviteDialog() {
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'corretor', // default per UI-SPEC line 316
    },
  })

  const selectedRole = form.watch('role')
  const roleDescription =
    ROLE_OPTIONS.find((r) => r.value === selectedRole)?.description ?? ''

  function onSubmit(values: InviteValues) {
    setFormError(null)
    const fd = new FormData()
    fd.set('email', values.email)
    fd.set('role', values.role)

    startTransition(async () => {
      const result = await inviteUser(fd)
      if (result && 'error' in result && result.error) {
        const msg =
          result.error._form?.[0] ??
          result.error.email?.[0] ??
          'Erro ao enviar convite.'
        setFormError(msg)
        return
      }
      toast.success(`Convite enviado para ${values.email}`)
      form.reset()
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Convidar usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar novo usuário</DialogTitle>
        </DialogHeader>

        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="corretor@corretora.com.br"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Papel</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um papel" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {roleDescription && (
                    <p className="text-xs text-muted-foreground">{roleDescription}</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar convite'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

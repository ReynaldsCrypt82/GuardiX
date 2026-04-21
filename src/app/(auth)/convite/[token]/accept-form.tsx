'use client'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { z } from 'zod'
import { acceptInviteSchema } from '@/lib/validations/auth-schemas'
import { acceptInvite } from '@/lib/actions/invites'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

type AcceptInviteValues = z.infer<typeof acceptInviteSchema>

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  corretor: 'Corretor',
  financeiro: 'Financeiro',
  visualizador: 'Visualizador',
}

interface AcceptFormProps {
  token: string
  email: string
  role: string
  tenantName: string
}

export function AcceptForm({ token, email, role, tenantName }: AcceptFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()

  const form = useForm<AcceptInviteValues>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { fullName: '', password: '', passwordConfirm: '' },
  })

  async function onSubmit(values: AcceptInviteValues) {
    setError(null)
    const fd = new FormData()
    fd.set('fullName', values.fullName)
    fd.set('password', values.password)
    fd.set('passwordConfirm', values.passwordConfirm)

    startTransition(async () => {
      const result = await acceptInvite(token, fd)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Você foi convidado!</h1>
        <p className="text-sm text-muted-foreground">
          Configure sua senha para acessar a corretora{' '}
          <span className="font-semibold text-foreground">{tenantName}</span>.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Seu papel:</span>
          <Badge variant="secondary">{ROLE_LABELS[role] ?? role}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Entrando como: <span className="font-semibold">{email}</span>
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Seu nome completo</FormLabel>
                <FormControl>
                  <Input placeholder="Maria da Silva" autoComplete="name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Crie uma senha</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="passwordConfirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirmar senha</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="h-11 w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ativando...
              </>
            ) : (
              'Ativar minha conta'
            )}
          </Button>
        </form>
      </Form>
    </div>
  )
}

'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { z } from 'zod'
import { portalCadastroSchema } from '@/lib/validations/portal-auth-schemas'
import { formatCPF, stripCPF } from '@/lib/validations/cpf'
import { registerPortalClient } from '@/lib/actions/portal-auth'
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

type CadastroValues = z.infer<typeof portalCadastroSchema>

interface PortalCadastroFormProps {
  slug: string
}

export function PortalCadastroForm({ slug }: PortalCadastroFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<CadastroValues>({
    resolver: zodResolver(portalCadastroSchema),
    defaultValues: { cpf: '', email: '', password: '', slug },
  })

  function onSubmit(values: CadastroValues) {
    setFormError(null)
    const fd = new FormData()
    fd.set('cpf', stripCPF(values.cpf))
    fd.set('email', values.email)
    fd.set('password', values.password)
    fd.set('slug', slug)

    startTransition(async () => {
      const result = await registerPortalClient(fd)
      if (result?.error) {
        const err = result.error
        if (err._form?.[0]) setFormError(err._form[0])
        if (err.cpf?.[0]) form.setError('cpf', { message: err.cpf[0] })
        if (err.email?.[0]) form.setError('email', { message: err.email[0] })
        if (err.password?.[0]) form.setError('password', { message: err.password[0] })
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="cpf"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CPF</FormLabel>
                <FormControl>
                  <Input
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    autoComplete="off"
                    value={field.value}
                    onChange={(e) => {
                      const digits = stripCPF(e.target.value).slice(0, 11)
                      field.onChange(digits.length === 11 ? formatCPF(digits) : digits)
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="voce@email.com"
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
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Senha</FormLabel>
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

          <Button type="submit" className="h-11 w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando conta...
              </>
            ) : (
              'Criar conta'
            )}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{' '}
        <Link
          href={`/${slug}/portal/login`}
          className="font-semibold text-primary hover:underline"
        >
          Faça login
        </Link>
      </p>
    </div>
  )
}

'use client'
import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { registerTenant } from '@/lib/actions/auth'
import { useRegisterWizard } from '@/stores/register-wizard.store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'

export function StepPlano() {
  const { empresaData, adminData, setStep, reset } = useRegisterWizard()
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const PLAN_FEATURES = [
    'Usuários ilimitados',
    'Clientes e apólices ilimitados',
    'Suporte por e-mail',
  ]

  async function handleSubmit() {
    if (!empresaData || !adminData) return
    if (!acceptTerms) {
      setFormError('Você deve aceitar os termos para continuar.')
      return
    }

    setFormError(null)

    const fd = new FormData()
    fd.set('cnpj', empresaData.cnpj)
    fd.set('companyName', empresaData.companyName)
    fd.set('segment', empresaData.segment)
    fd.set('adminName', adminData.adminName)
    fd.set('email', adminData.email)
    fd.set('password', adminData.password)
    fd.set('passwordConfirm', adminData.passwordConfirm)
    fd.set('acceptTerms', 'true')

    startTransition(async () => {
      const result = await registerTenant(fd)
      if (result?.error) {
        const firstError =
          result.error._form?.[0] ??
          result.error.cnpj?.[0] ??
          result.error.email?.[0] ??
          'Ocorreu um erro inesperado. Tente novamente.'
        setFormError(firstError)
      } else {
        reset()
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Comece com 14 dias grátis</h1>
        <p className="text-sm text-muted-foreground">
          Sem cartão de crédito. Cancele quando quiser.
        </p>
      </div>

      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      {/* Plan card */}
      <div className="rounded-xl border bg-card p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">Starter</span>
          <Badge variant="secondary">14 dias gratuitos</Badge>
        </div>

        <Separator />

        <ul className="flex flex-col gap-2">
          {PLAN_FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm">
              <span className="text-green-500">✓</span>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {/* Accept terms checkbox */}
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
        />
        <span className="text-xs text-muted-foreground leading-relaxed">
          Ao criar sua conta, você concorda com os{' '}
          <Link href="#" className="text-primary hover:underline">
            Termos de Uso
          </Link>{' '}
          e a{' '}
          <Link href="#" className="text-primary hover:underline">
            Política de Privacidade
          </Link>
          .
        </span>
      </label>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1"
          onClick={() => setStep(2)}
          disabled={isPending}
        >
          Voltar
        </Button>
        <Button
          type="button"
          className="h-11 flex-1"
          onClick={handleSubmit}
          disabled={isPending || !acceptTerms}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Criando conta...
            </>
          ) : (
            'Criar minha conta'
          )}
        </Button>
      </div>
    </div>
  )
}

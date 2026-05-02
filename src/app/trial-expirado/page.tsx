import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { signOut } from '@/lib/actions/auth'

export default function TrialExpiradoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl font-semibold">
            Seu período de teste chegou ao fim
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">
            Seus dados estão seguros. Escolha um plano para continuar usando o GuardiX.
          </p>

          <div className="flex flex-col gap-3">
            <Button asChild className="h-11 w-full">
              <Link href="#">Ver planos</Link>
            </Button>
            <Button variant="outline" asChild className="h-11 w-full">
              <a href="mailto:suporte@guardix.app">Falar com suporte</a>
            </Button>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              Sair da conta
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

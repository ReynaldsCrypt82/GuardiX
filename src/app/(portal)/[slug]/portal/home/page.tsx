import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function PortalHomePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bem-vindo ao portal</CardTitle>
        <CardDescription>
          Sua área para acompanhar apólices, consórcio e financeiro.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Em breve: visualização de apólices ativas, cotas de consórcio e parcelas em aberto.
        </p>
      </CardContent>
    </Card>
  )
}

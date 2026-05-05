import { PortalCadastroForm } from './portal-cadastro-form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function PortalCadastroPage({ params }: PageProps) {
  const { slug } = await params
  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar conta no portal</CardTitle>
        <CardDescription>
          Acesse suas apólices, consórcio e financeiro com seu CPF.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PortalCadastroForm slug={slug} />
      </CardContent>
    </Card>
  )
}

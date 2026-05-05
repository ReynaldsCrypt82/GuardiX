import { PortalLoginForm } from './portal-login-form'
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

export default async function PortalLoginPage({ params }: PageProps) {
  const { slug } = await params
  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar no portal</CardTitle>
        <CardDescription>Acesse com seu e-mail e senha.</CardDescription>
      </CardHeader>
      <CardContent>
        <PortalLoginForm slug={slug} />
      </CardContent>
    </Card>
  )
}

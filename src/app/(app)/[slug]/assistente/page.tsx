// src/app/(app)/[slug]/assistente/page.tsx
// Phase 07 Plan 04 — Pagina de chat interno assistido por IA (AUTO-06)
// Server Component: auth guard bloqueia visualizador com notFound()
// Roles permitidos: admin, corretor, financeiro (D-09 analogia — todos exceto visualizador)

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ChatInterface } from '@/components/assistente/chat-interface'

export const metadata = { title: 'Assistente IA — GuardiX' }

export default async function AssistentePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) notFound()

  const meta = (user.app_metadata as { role?: string }) ?? {}

  // Visualizador nao tem acesso ao chat interno (analogia com /financeiro — D-05)
  if (meta.role === 'visualizador') notFound()

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Assistente IA</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Consulte informacoes sobre clientes, apolices e financeiro usando linguagem natural.
        </p>
      </header>
      <ChatInterface slug={slug} />
    </div>
  )
}

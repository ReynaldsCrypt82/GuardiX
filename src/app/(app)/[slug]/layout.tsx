import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarShell } from '@/components/auth/sidebar-shell'
import { UserMenu } from '@/components/auth/user-menu'
import { Toaster } from '@/components/ui/sonner'
import { AlertToastTrigger } from '@/components/auth/alert-toast-trigger'

export default async function SlugLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/${slug}/dashboard`)
  }

  const meta = user.app_metadata as { slug?: string; tenant_id?: string } | undefined
  if (meta?.slug && meta.slug !== slug) {
    redirect(`/${meta.slug}/dashboard`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? 'Usuário'
  const email = user.email ?? ''

  // Alertas in-app (D-06): apólices com vigencia_fim ≤ 30 dias (SEG-03)
  // Fallback gracioso: se tabelas não existirem (antes do db push), usa count=0 (T-03-19)
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]
  const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any

  let policiesAlertCount = 0
  let assemblyAlertCount = 0

  try {
    const { count: pCount } = await supabaseAny
      .from('policies')
      .select('id', { count: 'exact', head: true })
      .lte('vigencia_fim', thirtyDaysLater)
      .is('deleted_at', null)
    policiesAlertCount = pCount ?? 0
  } catch {
    // tabela não existe ainda — fallback gracioso
  }

  try {
    // CRITICAL (Pitfall 5): filtrar next_assembly_date IS NOT NULL antes da comparação com data
    const { count: aCount } = await supabaseAny
      .from('consortium_groups')
      .select('id', { count: 'exact', head: true })
      .not('next_assembly_date', 'is', null)
      .gte('next_assembly_date', today)
      .lte('next_assembly_date', threeDaysLater)
      .is('deleted_at', null)
    assemblyAlertCount = aCount ?? 0
  } catch {
    // tabela não existe ainda — fallback gracioso
  }

  const alertCounts = {
    policies: policiesAlertCount,
    assemblies: assemblyAlertCount,
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SidebarShell slug={slug} alertCounts={alertCounts} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div />
          <UserMenu fullName={fullName} email={email} />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      <Toaster position="top-right" />
      <AlertToastTrigger
        policiesCount={alertCounts.policies}
        assembliesCount={alertCounts.assemblies}
      />
    </div>
  )
}

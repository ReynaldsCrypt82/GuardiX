import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarShell } from '@/components/auth/sidebar-shell'
import { UserMenu } from '@/components/auth/user-menu'
import { Toaster } from '@/components/ui/sonner'

export default async function AppLayout({
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
  // Verify user belongs to this slug
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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SidebarShell slug={slug} />

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
    </div>
  )
}

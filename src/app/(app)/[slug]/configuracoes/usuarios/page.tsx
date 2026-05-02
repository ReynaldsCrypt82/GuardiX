import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { UserTable } from './user-table'
import { InviteDialog } from './invite-dialog'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function UsersPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const role = (user.app_metadata as { role?: string })?.role
  if (role !== 'admin') notFound()

  const admin = createAdminClient()

  const [{ data: profiles }, { data: invites }, { data: { users: authUsers } }] =
    await Promise.all([
      admin
        .from('profiles')
        .select('id, full_name, role, active')
        .is('deleted_at', null)
        .order('full_name'),
      admin
        .from('user_invitations')
        .select('id, email, role, expires_at')
        .is('accepted_at', null)
        .is('cancelled_at', null)
        .gt('expires_at', new Date().toISOString()),
      admin.auth.admin.listUsers({ perPage: 1000 }),
    ])

  // Mapa userId → email
  const emailMap: Record<string, string> = {}
  for (const u of authUsers ?? []) {
    if (u.email) emailMap[u.id] = u.email
  }

  const enrichedProfiles = (profiles ?? []).map((p) => ({
    ...p,
    email: emailMap[p.id] ?? null,
  }))

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Usuários</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie membros da equipe e seus perfis de acesso
          </p>
        </div>
        <InviteDialog />
      </header>
      <UserTable
        slug={slug}
        currentUserId={user.id}
        profiles={enrichedProfiles}
        invites={invites ?? []}
      />
    </div>
  )
}

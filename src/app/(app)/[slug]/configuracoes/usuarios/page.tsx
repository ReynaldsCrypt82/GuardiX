import { createClient } from '@/lib/supabase/server'
import { UserTable } from './user-table'
import { InviteDialog } from './invite-dialog'

export default async function UsersPage() {
  const supabase = await createClient()

  const [{ data: profiles }, { data: invites }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, role, active')
      .eq('active', true)
      .is('deleted_at', null),
    supabase
      .from('user_invitations')
      .select('id, email, role, expires_at')
      .is('accepted_at', null)
      .is('cancelled_at', null),
  ])

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuários</h1>
        <InviteDialog />
      </header>
      <UserTable profiles={profiles ?? []} invites={invites ?? []} />
    </div>
  )
}

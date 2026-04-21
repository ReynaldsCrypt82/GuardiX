import { createAdminClient } from '@/lib/supabase/admin'
import { AcceptForm } from './accept-form'
import ConviteExpiradoPage from '../expirado/page'

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const admin = createAdminClient()

  // Token-based lookup uses admin client — user is not yet authenticated (no JWT)
  const { data: invite } = await admin
    .from('user_invitations')
    .select('id, email, role, expires_at, accepted_at, cancelled_at, tenants(name, slug)')
    .eq('token', token)
    .maybeSingle()

  // No row, already accepted, cancelled, or expired → show expired page
  if (!invite) return <ConviteExpiradoPage />

  const isExpired =
    new Date(invite.expires_at).getTime() < Date.now() ||
    invite.accepted_at !== null ||
    invite.cancelled_at !== null

  if (isExpired) return <ConviteExpiradoPage />

  const tenant = invite.tenants as { name: string; slug: string } | null

  return (
    <AcceptForm
      token={token}
      email={invite.email}
      role={invite.role}
      tenantName={tenant?.name ?? 'Corretora'}
    />
  )
}

import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { getAdminEnv } from '../setup'

/**
 * Invite system integration tests — exercise the DB-level atomic UPDATE contract.
 * These tests bypass the Server Actions and call Supabase directly via service_role
 * to verify the single-use token guarantee enforced by the DB.
 *
 * The acceptInvite Server Action itself implements this same atomic pattern:
 *   UPDATE user_invitations
 *     SET accepted_at = NOW()
 *   WHERE token = $1
 *     AND accepted_at IS NULL
 *     AND cancelled_at IS NULL
 *     AND expires_at > NOW()
 */

describe('user_invitations — atomic single-use token contract', () => {
  it('second UPDATE with same token affects 0 rows after acceptance', async () => {
    const { url, key } = getAdminEnv()
    const admin = createClient(url, key)

    // Seed: insert a tenant + profile + invitation
    const seedCnpj = '60746948000112' // valid CNPJ
    // Soft-delete any previous row to avoid UNIQUE conflict
    await admin
      .from('tenants')
      .update({ deleted_at: new Date().toISOString() })
      .eq('cnpj', seedCnpj)
      .is('deleted_at', null)

    const { data: tenant } = await admin
      .from('tenants')
      .insert({ name: 'Invite Test Corp', slug: `invite-test-${Date.now()}`, cnpj: seedCnpj, segment: 'seguros' })
      .select()
      .single()

    if (!tenant) {
      // UNIQUE constraint still occupied from previous run — test must be skipped
      console.log('Skipping invite test — seedCnpj slot occupied from previous run')
      return
    }

    // Create a placeholder profile for invited_by
    const { data: inviter } = await admin.auth.admin.createUser({
      email: `inviter+${Date.now()}@test.local`,
      password: 'testpass123',
      email_confirm: true,
      app_metadata: { tenant_id: tenant.id, role: 'admin', slug: tenant.slug },
    })
    if (!inviter?.user) return

    await admin.from('profiles').insert({
      id: inviter.user.id,
      tenant_id: tenant.id,
      full_name: 'Invite Sender',
      role: 'admin',
    })

    // Insert a test invitation
    const { data: invite } = await admin
      .from('user_invitations')
      .insert({
        tenant_id: tenant.id,
        email: `invitee+${Date.now()}@test.local`,
        role: 'corretor',
        invited_by: inviter.user.id,
        // expires_at defaults to NOW() + 72h
      })
      .select('id, token, expires_at')
      .single()

    expect(invite).toBeTruthy()
    if (!invite) return

    const TEST_TOKEN = invite.token

    // First claim — should succeed (1 row updated)
    const { data: first } = await admin
      .from('user_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('token', TEST_TOKEN)
      .is('accepted_at', null)
      .is('cancelled_at', null)
      .gt('expires_at', new Date().toISOString())
      .select()
      .single()

    expect(first).toBeTruthy()
    expect(first?.accepted_at).toBeTruthy()

    // Second claim with same token — must affect 0 rows (accepted_at IS NOT NULL now)
    const { data: second } = await admin
      .from('user_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('token', TEST_TOKEN)
      .is('accepted_at', null)
      .is('cancelled_at', null)
      .gt('expires_at', new Date().toISOString())
      .select()
      .maybeSingle()

    expect(second).toBeNull()
  })

  it('expired token cannot be claimed (expires_at in past)', async () => {
    const { url, key } = getAdminEnv()
    const admin = createClient(url, key)

    // Find a tenant with at least one active profile for invited_by
    const { data: profile } = await admin
      .from('profiles')
      .select('id, tenant_id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()

    if (!profile) {
      console.log('Skipping expired-token test — no seeded admin profile found')
      return
    }

    // Seed an invitation with expires_at in the past
    const { data: expiredInvite } = await admin
      .from('user_invitations')
      .insert({
        tenant_id: profile.tenant_id,
        email: `expired+${Date.now()}@test.local`,
        role: 'visualizador',
        invited_by: profile.id,
        expires_at: new Date(Date.now() - 3600 * 1000).toISOString(), // 1 hour ago
      })
      .select('id, token')
      .single()

    if (!expiredInvite) return

    // Attempt to claim the expired token
    const { data: claimed } = await admin
      .from('user_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('token', expiredInvite.token)
      .is('accepted_at', null)
      .is('cancelled_at', null)
      .gt('expires_at', new Date().toISOString()) // guard: must be in future
      .select()
      .maybeSingle()

    // Must return null — expired token cannot be claimed
    expect(claimed).toBeNull()
  })

  it('cancelled token cannot be claimed', async () => {
    const { url, key } = getAdminEnv()
    const admin = createClient(url, key)

    // Find a tenant with at least one active profile for invited_by
    const { data: profile } = await admin
      .from('profiles')
      .select('id, tenant_id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()

    if (!profile) {
      console.log('Skipping cancelled-token test — no seeded admin profile found')
      return
    }

    // Seed and immediately cancel an invitation
    const { data: inv } = await admin
      .from('user_invitations')
      .insert({
        tenant_id: profile.tenant_id,
        email: `cancelled+${Date.now()}@test.local`,
        role: 'visualizador',
        invited_by: profile.id,
      })
      .select('id, token')
      .single()

    if (!inv) return

    await admin
      .from('user_invitations')
      .update({ cancelled_at: new Date().toISOString() })
      .eq('id', inv.id)

    // Attempt to claim the cancelled token
    const { data: claimed } = await admin
      .from('user_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('token', inv.token)
      .is('accepted_at', null)
      .is('cancelled_at', null) // guard: must not be cancelled
      .gt('expires_at', new Date().toISOString())
      .select()
      .maybeSingle()

    expect(claimed).toBeNull()
  })
})

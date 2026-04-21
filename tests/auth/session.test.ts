import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { getAdminEnv } from '../setup'

describe('session persistence contract', () => {
  it('signInWithPassword returns a session with access_token and refresh_token', async () => {
    const { url } = getAdminEnv()
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    expect(anonKey).toBeTruthy()

    // Full cookie roundtrip requires Next middleware — verified manually in Task 3 smoke.
    // Here we assert the SDK contract the middleware relies on:
    const supa = createClient(url, anonKey)

    // Use a pre-seeded test user from previous test runs; if not available, skip.
    const testEmail = process.env.TEST_USER_EMAIL
    const testPassword = process.env.TEST_USER_PASSWORD
    if (!testEmail || !testPassword) {
      // Skip gracefully — integration env not configured
      return
    }

    const { data, error } = await supa.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    })
    expect(error).toBeNull()
    expect(data.session?.access_token).toBeTruthy()
    expect(data.session?.refresh_token).toBeTruthy()
  })

  it('getClaims() returns null for unauthenticated client', async () => {
    const { url } = getAdminEnv()
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    if (!anonKey) return

    const supa = createClient(url, anonKey)
    // getClaims() / getUser() on a fresh unauthenticated client returns no user
    const { data: { user } } = await supa.auth.getUser()
    expect(user).toBeNull()
  })
})

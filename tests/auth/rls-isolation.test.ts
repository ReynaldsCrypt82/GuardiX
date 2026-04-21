import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { getAdminEnv } from '../setup'

describe('cross-tenant RLS isolation', () => {
  it('tenant A user cannot SELECT tenant B rows via anon key', async () => {
    const { url } = getAdminEnv()
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    // This test MUST be fleshed out in later waves after RLS policies exist.
    // For now we assert the contract exists in the DB:
    expect(anonKey).toBeTruthy()
    // TODO(wave-1): create two tenants via admin, sign in as user A, query profiles, expect 0 rows of tenant B
    expect.fail(
      'RLS isolation test not yet implemented — requires wave 1 schema + wave 2 auth clients'
    )
  })
})

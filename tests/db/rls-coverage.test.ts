import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { getAdminEnv } from '../setup'

describe('RLS coverage gate', () => {
  it('every table in public schema has RLS enabled', async () => {
    const { url, key } = getAdminEnv()
    const admin = createClient(url, key)
    const { data, error } = await admin.rpc('check_rls_coverage')
    if (error) {
      expect.fail(
        `check_rls_coverage RPC missing — create in wave 1: ${error.message}`
      )
    }
    expect(data).toEqual([])
  })
})

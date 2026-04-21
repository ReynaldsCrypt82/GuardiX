import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { getAdminEnv } from '../setup'

// @ts-expect-error — module does not exist yet (Wave 2 implements it)
import { registerTenant } from '@/lib/actions/auth'

describe('registerTenant', () => {
  it('creates tenant + admin user atomically', async () => {
    const { url, key } = getAdminEnv()
    const admin = createClient(url, key)
    const cnpj = '11222333000181'
    // cleanup
    await admin.from('tenants').delete().eq('cnpj', cnpj)
    const fd = new FormData()
    fd.set('companyName', 'Test Corretora')
    fd.set('cnpj', cnpj)
    fd.set('segment', 'seguros')
    fd.set('adminName', 'Test Admin')
    fd.set('email', `admin+${Date.now()}@test.local`)
    fd.set('password', 'testpass123')
    const result = await registerTenant(fd)
    expect(result).not.toHaveProperty('error')
    const { data: tenants } = await admin.from('tenants').select().eq('cnpj', cnpj)
    expect(tenants).toHaveLength(1)
  })
  it.todo('rolls back tenant when auth.createUser fails')
})

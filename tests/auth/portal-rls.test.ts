import { describe, it } from 'vitest'

/**
 * Phase 01 Plan 01 — Test scaffold.
 * Implementations land in Plan 02 (portal_clients RLS isolation).
 *
 * Threats covered:
 *   T-1-01 — Cross-tenant CPF enumeration / portal_clients leakage
 *   T-1-03 — Internal user accessing portal_client data
 */

describe('portal_clients RLS isolation', () => {
  it.skip('blocks portal_client from reading another portal_client row (cross-tenant)', () => {
    // Plan 02 Task: seed two tenants + two portal_clients, sign in as A, query B.
  })

  it.skip('blocks portal_client from reading internal tables (pipeline_stages, profiles)', () => {
    // Plan 02 Task: sign in as portal_client, attempt SELECT on tenant_users / pipeline_stages.
  })

  it.skip('allows portal_client to read only their own row via portal_clients_self_select', () => {
    // Plan 02 Task: sign in, SELECT portal_clients — should return exactly 1 row (own).
  })

  it.skip('portal_client cannot SELECT from pipeline_stages (role guard active)', async () => {
    // Plan 02 Task (integration): sign in as portal_client, attempt:
    //   supabase.from('pipeline_stages').select('id').limit(1)
    // Expected: returns empty array (RLS blocks, no error thrown)
  })
})

import { describe, it } from 'vitest'

/**
 * Phase 01 Plan 01 — Test scaffold.
 * Implementations land in Plan 02 (registerPortalClient Server Action).
 *
 * Threats covered:
 *   T-1-01 — CPF enumeration via signup
 *   T-1-04 — Mass account creation via CPF brute-force
 *   T-1-05 — Timing leak revealing tenant data
 */

describe('registerPortalClient Server Action', () => {
  it.skip('rejects invalid CPF (módulo-11 verifier)', () => {
    // Plan 02 Task: portalCadastroSchema rejects 12345678900.
  })

  it.skip('returns generic error when CPF not found in tenant clients', () => {
    // Plan 02 Task: error message is "CPF não encontrado para esta corretora" — no info leak.
  })

  it.skip('creates auth user with app_metadata role=portal_client + tenant_id + portal_slug', () => {
    // Plan 02 Task: assert admin.auth.admin.createUser called with the right app_metadata.
  })

  it.skip('rolls back auth user when portal_clients INSERT fails', () => {
    // Plan 02 Task: simulate UNIQUE violation on client_id → admin.auth.admin.deleteUser called.
  })

  it.skip('blocks duplicate CPF via UNIQUE(client_id) constraint', () => {
    // Plan 02 Task: second signup with same CPF returns "Já existe uma conta para este CPF".
  })
})

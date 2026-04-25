import { describe, it } from 'vitest'

// ---------------------------------------------------------------------------
// Wave 0 stubs — implementados pelo Plan 03-02
// ---------------------------------------------------------------------------
describe('createPolicyAction — validação e campos core', () => {
  it.todo('createPolicyAction valida campos core e rejeita tipo inválido')
  it.todo('createPolicyAction extrai type_data JSONB corretamente para tipo auto')
  it.todo('createPolicyAction bloqueia corretor atribuindo apólice a outro corretor')
  it.todo('createPolicyAction rejeita tenant_id ausente na sessão')
  it.todo('createPolicyAction rejeita número de apólice duplicado (23505)')
  it.todo('filtro por vigencia_fim ≤ 30 dias usado na query de alertas')
})

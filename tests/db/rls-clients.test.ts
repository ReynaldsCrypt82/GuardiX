import { describe, it } from 'vitest'

describe('clients RLS — tenant isolation', () => {
  it.todo('tenant A nunca vê clientes do tenant B (SELECT)')
  it.todo('INSERT de cliente com tenant_id mismatch é bloqueado')
  it.todo('hard DELETE é bloqueado por trigger prevent_hard_delete')
})

describe('clients RLS — RBAC corretor', () => {
  it.todo('corretor vê apenas clientes com assigned_to = auth.uid()')
  it.todo('corretor não pode fazer UPDATE em cliente de outro corretor')
  it.todo('admin vê todos os clientes do tenant')
  it.todo('financeiro vê todos (read), não pode INSERT')
  it.todo('visualizador vê todos (read), não pode INSERT/UPDATE')
})

describe('pipeline_stages RLS', () => {
  it.todo('todos os roles autenticados do tenant veem os estágios')
  it.todo('apenas admin pode CREATE/UPDATE/DELETE estágios')
})

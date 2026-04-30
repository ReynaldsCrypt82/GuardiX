import { describe, it } from 'vitest'

describe('financial_entries RLS — tenant isolation', () => {
  it.todo('tenant A nunca vê financial_entries do tenant B (SELECT)')
  it.todo('INSERT de financial_entry com tenant_id mismatch é bloqueado')
  it.todo('hard DELETE é bloqueado por trigger prevent_hard_delete')
})

describe('financial_entries RLS — RBAC admin/financeiro', () => {
  it.todo('admin vê todos lançamentos do tenant (com e sem client_id)')
  it.todo('financeiro vê todos lançamentos do tenant (com e sem client_id)')
  it.todo('admin pode INSERT lançamento receivable e payable')
  it.todo('financeiro pode INSERT lançamento receivable e payable')
  it.todo('admin pode UPDATE status pending → paid')
  it.todo('financeiro pode UPDATE status pending → paid')
})

describe('financial_entries RLS — RBAC corretor (D-10)', () => {
  it.todo('corretor vê lançamentos de clientes próprios (clients.assigned_to = auth.uid())')
  it.todo('corretor NÃO vê lançamentos de clientes de outro corretor')
  it.todo('corretor NÃO vê lançamentos avulsos sem client_id (apenas admin/financeiro)')
  it.todo('corretor NÃO pode INSERT (FOR INSERT WITH CHECK falha)')
  it.todo('corretor NÃO pode UPDATE (FOR UPDATE USING/WITH CHECK falha)')
})

describe('financial_entries RLS — RBAC visualizador', () => {
  it.todo('visualizador NÃO vê lançamentos (não está em admin/financeiro/corretor)')
  it.todo('visualizador NÃO pode INSERT')
})

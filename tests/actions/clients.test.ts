import { describe, it } from 'vitest'

describe('createClientAction (PF)', () => {
  it.todo('valida CPF via validateCPF e rejeita inválidos')
  it.todo('rejeita CPF duplicado no mesmo tenant (constraint 23505)')
  it.todo('aceita CPF válido e insere com document sem máscara')
  it.todo('exige assigned_to (corretor responsável) obrigatório (D-04)')
  it.todo('define name obrigatório (min 2 chars) para PF')
})

describe('createClientAction (PJ)', () => {
  it.todo('valida CNPJ via validateCNPJ existente')
  it.todo('aceita responsible opcional')
  it.todo('rejeita CNPJ duplicado no mesmo tenant')
})

describe('updateClientStage (CRM-05)', () => {
  it.todo('corretor só pode mover seus próprios clientes (RLS)')
  it.todo('admin pode mover qualquer cliente do tenant')
  it.todo('rejeita stage_id de outro tenant')
})

describe('listClients filters (CRM-09)', () => {
  it.todo('filtro por assigned_to retorna apenas clientes do corretor')
  it.todo('filtro por stage_id restringe ao estágio')
  it.todo('filtro por type (pf|pj) segrega tipos')
  it.todo('paginação reseta para page=1 ao aplicar filtro novo (Pitfall 4)')
})

describe('searchClients (CRM-08)', () => {
  it.todo('busca por nome via ilike case-insensitive')
  it.todo('busca por CPF com máscara normaliza via stripCPF antes de ilike')
  it.todo('busca por CNPJ com máscara normaliza via stripCNPJ antes de ilike')
})

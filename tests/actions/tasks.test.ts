import { describe, it } from 'vitest'

describe('createTask (CRM-06)', () => {
  it.todo('description e due_date são obrigatórios')
  it.todo('assigned_to default = usuário atual quando omitido')
  it.todo('assigned_to pode ser outro usuário do tenant')
  it.todo('rejeita client_id de outro tenant (RLS)')
})

describe('completeTask', () => {
  it.todo('marca completed_at com NOW() e invalida cache do layout')
})

describe('getOverdueTasks (CRM-07)', () => {
  it.todo('retorna tarefas com due_date <= hoje e completed_at null')
  it.todo('filtra por assigned_to = usuário corrente')
  it.todo('exclui tarefas soft-deleted')
  it.todo('count exato para o badge de notificação')
})

import { describe, it } from 'vitest'

describe('RBAC enforcement', () => {
  it.todo('visualizador cannot INSERT into profiles (RLS blocks)')
  it.todo('visualizador CAN SELECT from profiles (RLS allows)')
  it.todo('admin CAN INSERT into user_invitations')
  it.todo('corretor CANNOT INSERT into user_invitations')
})

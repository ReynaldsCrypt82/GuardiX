import { describe, it } from 'vitest'

// @ts-expect-error — module does not exist yet (Wave 2 implements it)
import { acceptInvite } from '@/lib/actions/auth'

describe('acceptInvite', () => {
  it.todo('consumes valid token, sets accepted_at')
  it.todo('returns error on second use of same token (single-use)')
  it.todo('returns error when expires_at < NOW()')
  it.todo('returns error when cancelled_at IS NOT NULL')
})

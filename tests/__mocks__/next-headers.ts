// Stub for next/headers in Vitest — cookies() returns a no-op store
import { vi } from 'vitest'

const cookieStore = {
  getAll: () => [],
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}

export const cookies = vi.fn(async () => cookieStore)
export const headers = vi.fn(async () => new Headers())

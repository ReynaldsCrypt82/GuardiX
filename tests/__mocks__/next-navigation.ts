// Stub for next/navigation in Vitest — redirect() throws a special sentinel
// so tests can assert redirect calls without a real Next.js server context.
import { vi } from 'vitest'

export class RedirectError extends Error {
  constructor(public readonly url: string) {
    super(`NEXT_REDIRECT: ${url}`)
    this.name = 'RedirectError'
  }
}

export const redirect = vi.fn((url: string): never => {
  throw new RedirectError(url)
})

export const notFound = vi.fn((): never => {
  throw new Error('NEXT_NOT_FOUND')
})

export const useRouter = vi.fn(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}))

export const usePathname = vi.fn(() => '/')
export const useSearchParams = vi.fn(() => new URLSearchParams())

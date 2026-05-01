import { describe, it, expect } from 'vitest'
import { isUrlSafe } from '@/lib/utils/webhook-url'

describe('isUrlSafe', () => {
  it('aceita https publico', () => {
    expect(isUrlSafe('https://api.example.com/webhook')).toBe(true)
  })
  it('rejeita http://localhost', () => {
    expect(isUrlSafe('http://localhost/x')).toBe(false)
  })
  it('rejeita IP RFC1918 10.x', () => {
    expect(isUrlSafe('http://10.0.0.1/x')).toBe(false)
  })
  it('rejeita IP RFC1918 192.168.x', () => {
    expect(isUrlSafe('https://192.168.1.1/y')).toBe(false)
  })
  it('rejeita protocolo ftp', () => {
    expect(isUrlSafe('ftp://x.com')).toBe(false)
  })
  it('rejeita 169.254.x (link-local)', () => {
    expect(isUrlSafe('http://169.254.169.254/')).toBe(false)
  })
  it('rejeita string nao-URL', () => {
    expect(isUrlSafe('not a url')).toBe(false)
  })
})

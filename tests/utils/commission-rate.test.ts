import { describe, it, expect } from 'vitest'
import { resolveCommissionRate } from '@/lib/utils/commission-rate'

describe('resolveCommissionRate', () => {
  it('retorna defaultRate quando overrides eh undefined', () => {
    expect(resolveCommissionRate(undefined, 0.05, 'auto')).toBe(0.05)
  })

  it('retorna defaultRate quando overrides eh null', () => {
    expect(resolveCommissionRate(null, 0.05, 'auto')).toBe(0.05)
  })

  it('retorna defaultRate quando overrides eh objeto vazio', () => {
    expect(resolveCommissionRate({}, 0.05, 'auto')).toBe(0.05)
  })

  it('retorna override quando chave existe — tipo de seguro', () => {
    expect(resolveCommissionRate({ auto: 0.06 }, 0.05, 'auto')).toBe(0.06)
  })

  it('retorna defaultRate quando productType nao tem override (chave ausente)', () => {
    expect(resolveCommissionRate({ vida: 0.08 }, 0.05, 'auto')).toBe(0.05)
  })

  it('aceita prefixo consorcio_ para cotas de consorcio', () => {
    expect(resolveCommissionRate({ consorcio_auto: 0.03 }, 0.05, 'consorcio_auto')).toBe(0.03)
    expect(resolveCommissionRate({ consorcio_imovel: 0.025 }, 0.05, 'consorcio_imovel')).toBe(0.025)
    expect(resolveCommissionRate({ consorcio_servico: 0.03 }, 0.05, 'consorcio_servico')).toBe(0.03)
  })

  it('aceita override de 0 (zero NAO cai no defaultRate — Pitfall: nullish vs falsy)', () => {
    expect(resolveCommissionRate({ auto: 0 }, 0.05, 'auto')).toBe(0)
  })

  it('seguro auto e consorcio_auto sao chaves distintas', () => {
    const overrides = { auto: 0.06, consorcio_auto: 0.03 }
    expect(resolveCommissionRate(overrides, 0.05, 'auto')).toBe(0.06)
    expect(resolveCommissionRate(overrides, 0.05, 'consorcio_auto')).toBe(0.03)
  })
})

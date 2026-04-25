import { describe, it, expect } from 'vitest'
import { addDays, subDays, format } from 'date-fns'
import { getVigenciaStatus } from '@/lib/utils/vigencia'

function dateStr(daysFromToday: number) {
  const d = daysFromToday >= 0 ? addDays(new Date(), daysFromToday) : subDays(new Date(), -daysFromToday)
  return format(d, 'yyyy-MM-dd')
}

describe('getVigenciaStatus', () => {
  it("retorna 'verde' para vigencia > 60 dias (hoje+90)", () => {
    expect(getVigenciaStatus(dateStr(90))).toBe('verde')
  })
  it("retorna 'verde' para vigencia exatamente > 60 dias (hoje+61)", () => {
    expect(getVigenciaStatus(dateStr(61))).toBe('verde')
  })
  it("retorna 'amarelo' para vigencia exatamente 60 dias (<=60 e >30)", () => {
    expect(getVigenciaStatus(dateStr(60))).toBe('amarelo')
  })
  it("retorna 'amarelo' para vigencia 45 dias", () => {
    expect(getVigenciaStatus(dateStr(45))).toBe('amarelo')
  })
  it("retorna 'amarelo' para vigencia exatamente 31 dias (>30)", () => {
    expect(getVigenciaStatus(dateStr(31))).toBe('amarelo')
  })
  it("retorna 'vermelho' para vigencia exatamente 30 dias (<=30)", () => {
    expect(getVigenciaStatus(dateStr(30))).toBe('vermelho')
  })
  it("retorna 'vermelho' para vigencia 15 dias", () => {
    expect(getVigenciaStatus(dateStr(15))).toBe('vermelho')
  })
  it("retorna 'vermelho' para apólice vencida (data passada)", () => {
    expect(getVigenciaStatus(dateStr(-5))).toBe('vermelho')
  })
})

import { describe, expect, it } from 'vitest'
import { addDays, todayIn, toZonedIso, tzOffsetMin, zonedToMs } from './time'

describe('fuso orario', () => {
  it('Shanghai è sempre +8', () => {
    expect(tzOffsetMin('Asia/Shanghai', Date.UTC(2026, 0, 1))).toBe(480)
    expect(tzOffsetMin('Asia/Shanghai', Date.UTC(2026, 6, 1))).toBe(480)
  })

  it('Roma cambia con l\'ora legale', () => {
    expect(tzOffsetMin('Europe/Rome', Date.UTC(2026, 0, 15))).toBe(60)
    expect(tzOffsetMin('Europe/Rome', Date.UTC(2026, 6, 15))).toBe(120)
  })

  it('mezzanotte e orari nel fuso utente', () => {
    expect(zonedToMs('2026-11-19', '00:00', 'Asia/Shanghai')).toBe(Date.UTC(2026, 10, 18, 16))
    expect(zonedToMs('2026-07-01', '09:30', 'Europe/Rome')).toBe(Date.UTC(2026, 6, 1, 7, 30))
    expect(zonedToMs('2026-03-29', '12:00', 'Europe/Rome')).toBe(Date.UTC(2026, 2, 29, 10))
  })

  it('ISO con offset per le chiamate a Calendar', () => {
    expect(toZonedIso(Date.UTC(2026, 10, 18, 16), 'Asia/Shanghai')).toBe('2026-11-19T00:00:00+08:00')
    expect(toZonedIso(Date.UTC(2026, 0, 1, 23, 5), 'Europe/Rome')).toBe('2026-01-02T00:05:00+01:00')
    expect(toZonedIso(Date.UTC(2026, 0, 1, 12), 'UTC')).toBe('2026-01-01T12:00:00Z')
  })

  it('giorni del calendario', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(todayIn('Asia/Shanghai', new Date(Date.UTC(2026, 10, 18, 17)))).toBe('2026-11-19')
  })
})

import { describe, expect, it } from 'vitest'
import { addDays, zonedToMs } from '../time'
import { busyFrom, findSlot, type Interval, type SlotOpts } from './findSlot'

// Test di Opus (riga 05): fissano il comportamento di findSlot e busyFrom. Non si cambiano.

const TZ = 'Asia/Shanghai'
const D = '2026-11-19'
const at = (time: string, day = D, tz = TZ) => zonedToMs(day, time, tz)
const span = (a: string, b: string, day = D): Interval => ({ start: at(a, day), end: at(b, day) })
const opts = (from: number, extra: Partial<SlotOpts> = {}): SlotOpts => ({
  from, tz: TZ, windowStart: '08:00', windowEnd: '22:45', marginMin: 5, ...extra,
})

describe('findSlot', () => {
  it('parte da adesso + 20 minuti, arrotondato al quarto d\'ora', () => {
    expect(findSlot([], 60, opts(at('10:00')))).toEqual(span('10:30', '11:30'))
    expect(findSlot([], 60, opts(at('10:10')))).toEqual(span('10:30', '11:30'))
    expect(findSlot([], 60, opts(at('10:25')))).toEqual(span('10:45', '11:45'))
    expect(findSlot([], 30, opts(at('09:55')))).toEqual(span('10:15', '10:45'))
  })

  it('prima della finestra: inizio della finestra', () => {
    expect(findSlot([], 60, opts(at('06:00')))).toEqual(span('08:00', '09:00'))
  })

  it('evento che occupa la finestra: primo spazio dopo, con il margine', () => {
    expect(findSlot([span('10:00', '12:00')], 60, opts(at('10:00')))).toEqual(span('12:15', '13:15'))
    // Occupata tutta la finestra di oggi: domani alle 08:00.
    expect(findSlot([span('07:00', '23:00')], 60, opts(at('10:00')))).toEqual(span('08:00', '09:00', addDays(D, 1)))
  })

  it('margine prima e dopo; toccare il bordo allargato va bene', () => {
    const busy = [span('09:30', '10:00')]
    expect(findSlot(busy, 60, opts(at('08:00')))).toEqual(span('10:15', '11:15'))
    expect(findSlot(busy, 60, opts(at('08:00'), { marginMin: 0 }))).toEqual(span('08:30', '09:30'))
    expect(findSlot(busy, 45, opts(at('08:00')))).toEqual(span('08:30', '09:15'))
    expect(findSlot([span('08:00', '09:10')], 30, opts(at('07:00'), { marginMin: 5 }))).toEqual(span('09:15', '09:45'))
  })

  it('spazio tra due eventi: entra solo se basta con i margini', () => {
    const busy = [span('08:00', '09:00'), span('10:20', '12:00')]
    expect(findSlot(busy, 60, opts(at('07:00')))).toEqual(span('09:15', '10:15'))
    expect(findSlot(busy, 60, opts(at('07:00'), { marginMin: 10 }))).toEqual(span('12:15', '13:15'))
  })

  it('fine giornata: la sessione deve finire entro la fine della finestra', () => {
    expect(findSlot([], 15, opts(at('22:00')))).toEqual(span('22:30', '22:45'))
    expect(findSlot([], 30, opts(at('22:00')))).toEqual(span('08:00', '08:30', addDays(D, 1)))
    // Dopo la fine della finestra: il giorno dopo.
    expect(findSlot([], 60, opts(at('23:30')))).toEqual(span('08:00', '09:00', addDays(D, 1)))
  })

  it('nessuno spazio entro 12 giorni: null; l\'ultimo giorno cercato è l\'undicesimo dopo oggi', () => {
    const until = (day: number) => [{ start: at('00:00'), end: at('07:00', addDays(D, day)) }]
    expect(findSlot(until(11), 60, opts(at('10:00')))).toEqual(span('08:00', '09:00', addDays(D, 11)))
    expect(findSlot([{ start: at('00:00'), end: at('23:59', addDays(D, 11)) }], 60, opts(at('10:00')))).toBeNull()
    expect(findSlot(until(3), 60, opts(at('10:00'), { days: 3 }))).toBeNull()
  })

  it('durata più lunga della finestra: null', () => {
    expect(findSlot([], 14 * 60, opts(at('06:00'), { windowEnd: '22:00' }))).toEqual(span('08:00', '22:00'))
    expect(findSlot([], 15 * 60, opts(at('06:00'), { windowEnd: '22:00' }))).toBeNull()
  })

  it('fuso orario: finestra sull\'orologio del fuso utente', () => {
    const from = Date.UTC(2026, 10, 19, 5, 0) // 06:00 a Roma, 13:00 a Shanghai
    expect(findSlot([], 60, opts(from, { tz: 'Europe/Rome' }))?.start).toBe(Date.UTC(2026, 10, 19, 7, 0))
    expect(findSlot([], 60, opts(from))?.start).toBe(at('13:30'))
    // A Roma alle 21:00 (Shanghai già notte): ancora spazio a Roma, non a Shanghai.
    const late = Date.UTC(2026, 10, 19, 20, 0)
    expect(findSlot([], 60, opts(late, { tz: 'Europe/Rome' }))?.start).toBe(Date.UTC(2026, 10, 19, 20, 30))
    expect(findSlot([], 60, opts(late))?.start).toBe(at('08:00', addDays(D, 1)))
  })

  it('l\'ordine degli intervalli occupati non conta', () => {
    const busy = [span('11:00', '12:00'), span('08:00', '10:30')]
    expect(findSlot(busy, 30, opts(at('07:00')))).toEqual(span('12:15', '12:45'))
  })
})

describe('busyFrom', () => {
  const ev = (id: string, a: string, b: string, extra: { allDay?: boolean; transparency?: 'opaque' | 'transparent' } = {}) =>
    ({ id, ...span(a, b), allDay: false, transparency: 'opaque' as const, ...extra })

  it('eventi con orario e occupati; esclusi "libero", tutto il giorno e quelli da spostare', () => {
    const events = [
      ev('a', '09:00', '10:00'),
      ev('libero', '10:00', '11:00', { transparency: 'transparent' }),
      ev('giorno', '00:00', '23:59', { allDay: true }),
      ev('sposta', '12:00', '13:00'),
    ]
    expect(busyFrom(events, [], ['sposta'])).toEqual([span('09:00', '10:00')])
    expect(busyFrom(events, [])).toEqual([span('09:00', '10:00'), span('12:00', '13:00')])
  })

  it('aggiunge solo gli inserimenti in coda da inviare', () => {
    const ops = [
      { action: 'insert' as const, state: 'pending' as const, toStart: at('15:00'), toEnd: at('16:00') },
      { action: 'insert' as const, state: 'rejected' as const, toStart: at('17:00'), toEnd: at('18:00') },
      { action: 'notDone' as const, state: 'pending' as const, toStart: at('19:00'), toEnd: at('20:00') },
    ]
    expect(busyFrom([], ops)).toEqual([span('15:00', '16:00')])
  })
})

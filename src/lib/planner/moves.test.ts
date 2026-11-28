import { describe, expect, it } from 'vitest'
import type { CalEvent, QueueOp } from '../../db/schema'
import type { ViewEvent } from '../calendar/queue'
import { addDays, DAY, zonedToMs } from '../time'
import type { SlotOpts } from './findSlot'
import { IN_REVIEW, isFar, NO_SLOT, partialActualMin, planImprevisto, restoDescription, restoMinutes, restoTitle } from './moves'

// Test di Opus (riga 05): regole pure di Parziale e Imprevisto. Non si cambiano.

const TZ = 'Asia/Shanghai'
const D = '2026-11-19'
const at = (time: string, day = D) => zonedToMs(day, time, TZ)
const opts = (from: number): SlotOpts => ({ from, tz: TZ, windowStart: '08:00', windowEnd: '22:45', marginMin: 5 })
const ev = (id: string, a: string, b: string, extra: Partial<ViewEvent> = {}): ViewEvent => ({
  id, calendarId: 'primary', etag: `"e-${id}"`, title: `DSP Study: ${id}`, cleanTitle: `DSP Study: ${id}`, status: 'todo',
  kind: 'study', subjectId: 'dsp', appTag: true, start: at(a), end: at(b), transparency: 'opaque', allDay: false,
  description: '', updated: '', ...extra,
} as CalEvent)

describe('Parziale', () => {
  it('minuti reali precompilati e durata del resto (minimo 30)', () => {
    expect(partialActualMin(90, 50)).toBe(45)
    expect(partialActualMin(50, 25)).toBe(13)
    expect(restoMinutes(120, 25)).toBe(90)
    expect(restoMinutes(90, 50)).toBe(45)
    expect(restoMinutes(90, 75)).toBe(30)
    expect(restoMinutes(60, 75)).toBe(30)
    expect(restoMinutes(60, 75, 15)).toBe(15)
    expect(restoMinutes(50, 25)).toBe(38)
  })

  it('titolo del resto senza ripetere "(resto)"', () => {
    expect(restoTitle('DSP Study: FFT')).toBe('DSP Study: FFT (resto)')
    expect(restoTitle('DSP Study: FFT (resto)')).toBe('DSP Study: FFT (resto)')
  })

  it('descrizione: "Resume from" in testa, vecchie righe tolte', () => {
    expect(restoDescription('Material: slide 3-9\nTask: es. 2', ' es. 2b ')).toBe('Resume from: es. 2b\nMaterial: slide 3-9\nTask: es. 2')
    expect(restoDescription('resume from: vecchio\n\nMaterial: x\n', 'nuovo')).toBe('Resume from: nuovo\nMaterial: x')
    expect(restoDescription('', 'pag. 4')).toBe('Resume from: pag. 4')
  })
})

describe('isFar', () => {
  it('più di 3 giorni da adesso', () => {
    const now = at('10:00')
    expect(isFar({ start: now + 3 * DAY, end: now + 3 * DAY + 1 }, now)).toBe(false)
    expect(isFar({ start: now + 3 * DAY + 60_000, end: now + 4 * DAY }, now)).toBe(true)
  })
})

describe('planImprevisto', () => {
  const imp = { start: at('14:00'), end: at('17:00') }
  const now = at('10:00')

  it('sposta solo le sessioni da fare che toccano l\'imprevisto, ognuna nel primo spazio libero', () => {
    const events = [
      ev('dentro', '14:30', '15:30'),
      ev('bordo', '16:30', '17:30', { status: 'moved' }),
      ev('fuori', '17:00', '18:00'),
      ev('fatta', '15:00', '16:00', { status: 'done' }),
      ev('lezione', '14:00', '16:00', { kind: undefined }),
      ev('giorno', '00:00', '23:59', { allDay: true }),
      ev('prima', '10:00', '11:00'),
    ]
    const r = planImprevisto(events, [], imp, opts(now))
    expect(r.map((x) => x.ev.id)).toEqual(['dentro', 'bordo'])
    // 'dentro': dopo 'prima' (10-11) + margine → 11:15; 'bordo': dopo 'dentro' + margine, prima della lezione (14:00 − 5').
    expect(r[0].slot).toEqual({ start: at('11:15'), end: at('12:15') })
    expect(r[1].slot).toEqual({ start: at('12:30'), end: at('13:30') })
    expect(r.every((x) => x.reason === undefined)).toBe(true)
  })

  it('sessione finita prima di adesso: non si sposta', () => {
    const r = planImprevisto([ev('vecchia', '08:00', '09:00')], [], { start: at('08:30'), end: at('12:00') }, opts(now))
    expect(r).toEqual([])
  })

  it('azione da rivedere: resta ferma e occupa il suo posto', () => {
    const queued = { state: 'conflict' } as QueueOp
    const events = [ev('rivedi', '14:00', '15:00', { queued }), ev('sposta', '15:00', '16:00')]
    const r = planImprevisto(events, [], imp, opts(at('13:00')))
    expect(r[0]).toMatchObject({ slot: null, reason: IN_REVIEW })
    expect(r[1].slot).toEqual({ start: at('17:15'), end: at('18:15') })
  })

  it('nessuno spazio: slot null con il motivo', () => {
    const wall = ev('muro', '00:00', '23:59', { kind: undefined, end: at('23:59', addDays(D, 12)) })
    const r = planImprevisto([wall, ev('s', '14:00', '15:00')], [], imp, opts(now))
    expect(r).toEqual([{ ev: expect.objectContaining({ id: 's' }), slot: null, reason: NO_SLOT }])
  })

  it('gli inserimenti in coda occupano il loro spazio', () => {
    const ops = [{ action: 'insert', state: 'pending', toStart: at('11:00'), toEnd: at('13:30') } as QueueOp]
    const r = planImprevisto([ev('s', '14:00', '15:00')], ops, imp, opts(now))
    expect(r[0].slot).toEqual({ start: at('17:15'), end: at('18:15') })
  })
})

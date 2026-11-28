import { describe, expect, it } from 'vitest'
import type { CalEvent, LogEntry, QueueOp } from '../../db/schema'
import { stripStatus } from '../../lib/calendar/parse'
import type { ViewEvent } from '../../lib/calendar/queue'
import { addDays, zonedToMs } from '../../lib/time'
import { actionsFor, countdownText, daySummary, examCountdown, fmtHours, groupSessions, plannedMinutes } from './today'

// Test di Opus (riga 04): liste, azioni e riepilogo della scheda Oggi. Non si cambiano.

const TZ = 'Asia/Shanghai'
const TODAY = '2026-11-19'
const NOW = zonedToMs(TODAY, '12:00', TZ)

const at = (id: string, day: number, time: string, min: number, title: string, extra: Partial<ViewEvent> = {}): ViewEvent => {
  const start = zonedToMs(addDays(TODAY, day), time, TZ)
  const { status, clean } = stripStatus(title)
  const ev: CalEvent = {
    id, calendarId: 'primary', etag: '"1"', title, cleanTitle: clean, status, kind: title === 'Pranzo' ? undefined : 'study',
    subjectId: 'dsp', appTag: false, start, end: start + min * 60_000, transparency: 'opaque', allDay: false, description: '', updated: '',
  }
  return { ...ev, ...extra }
}
const queued = (eventId: string, state: QueueOp['state'], action: QueueOp['action'] = 'done', actualMin?: number): QueueOp => ({
  seq: 1, eventId, calendarId: 'primary', action, etag: '', fromTitle: '', toTitle: '', actualMin, plannedStart: 0, plannedMin: 0, createdAt: 0, rev: 0, state,
})
const ids = (l: ViewEvent[]) => l.map((e) => e.id)

describe('groupSessions', () => {
  it('cinque liste, solo sessioni di studio, giorni nel fuso utente', () => {
    const evs = [
      at('vecchia', -8, '09:00', 60, 'DSP Study: vecchia'),
      // Finita da più di 7×24 h ma nel giorno −7: non da segnare e, non segnata, nemmeno in "Giorni scorsi".
      at('limite', -7, '09:00', 60, 'DSP Study: limite'),
      at('p2', -3, '09:00', 60, 'DSP Study: A'),
      at('p3', -2, '09:00', 60, '✅ DSP Study: B'),
      at('p13', -1, '09:00', 60, '✗ DSP Study: H'),
      at('p4', -1, '10:30', 60, '↻ DSP Review +1d: C'),
      at('p5', 0, '08:00', 60, 'DSP Study: D'),
      at('p7', 0, '10:00', 60, '✅ DSP Exercises: F'),
      at('pranzo', 0, '12:00', 60, 'Pranzo'),
      at('p6', 0, '15:00', 90, 'DSP Study: E'),
      at('notte', 0, '23:30', 60, 'DSP Study: notte'),
      at('p9', 1, '09:00', 60, 'DSP Study: G'),
      at('p11', 7, '09:00', 60, 'DSP Study: J'),
      at('p10', 2, '09:00', 60, 'DSP Study: I'),
      at('p12', 8, '09:00', 60, 'DSP Study: K'),
    ]
    const g = groupSessions(evs, NOW, TZ)
    expect(ids(g.toMark)).toEqual(['p2', 'p4', 'p5'])
    expect(ids(g.today)).toEqual(['p7', 'p6', 'notte'])
    expect(ids(g.tomorrow)).toEqual(['p9'])
    expect(ids(g.next)).toEqual(['p10', 'p11'])
    expect(ids(g.past)).toEqual(['p13', 'p3'])
  })
})

describe('actionsFor', () => {
  it.each([
    ['DSP Study: A', undefined, ['done', 'skip']],
    ['↻ DSP Study: A', undefined, ['done', 'skip']],
    ['✅ DSP Study: A', undefined, ['undo']],
    ['✗ DSP Study: A', undefined, ['undo']],
    ['◐ DSP Study: A', undefined, ['undo']],
    ['✅ DSP Study: A', 'pending', ['undo']],
    ['DSP Study: A', 'conflict', []],
    ['DSP Study: A', 'rejected', []],
  ] as const)('%s, coda %s', (title, state, out) => {
    const e = at('a', 0, '09:00', 60, title, state ? { queued: queued('a', state) } : {})
    expect(actionsFor(e)).toEqual(out)
  })
})

describe('daySummary', () => {
  it('pianificate: tutte le sessioni di oggi; fatte: minuti della coda, poi del registro più recente, poi pianificati', () => {
    const log = (eventId: string, status: LogEntry['status'], actualMin: number, date: number): LogEntry =>
      ({ id: `${eventId}-${date}`, eventId, status, actualMin, plannedStart: 0, plannedMin: 60, date, updatedAt: date })
    const evs = [
      at('s1', 0, '08:00', 60, 'DSP Study: D'),
      at('s2', 0, '15:00', 90, '✅ DSP Study: E', { queued: queued('s2', 'pending', 'done', 80) }),
      at('s3', 0, '10:00', 60, '✅ DSP Exercises: F'),
      at('s4', 0, '13:00', 60, '◐ DSP Study: P'),
      at('s5', 0, '18:00', 30, '✗ DSP Study: S'),
      at('s6', 0, '20:00', 30, '✅ DSP Study: N'),
      at('s7', 1, '09:00', 60, '✅ DSP Study: T'),
      at('pranzo', 0, '12:30', 60, 'Pranzo'),
    ]
    const logs = [log('s3', 'done', 10, 1), log('s3', 'done', 45, 2), log('s4', 'partial', 20, 3), log('s5', 'skipped', 0, 4)]
    expect(daySummary(evs, logs, NOW, TZ)).toEqual({ plannedMin: 330, doneMin: 175, toMark: 1 })
  })
})

describe('numeri e testi', () => {
  it('plannedMinutes', () => {
    expect(plannedMinutes({ start: 0, end: 5_400_000 })).toBe(90)
  })

  it('examCountdown: da oggi in poi, dal più vicino, poi per nome', () => {
    const subjects = [
      { name: 'Analog', examDate: '2026-12-01' }, { name: 'DSP', examDate: '2026-11-19' }, { name: 'ALP', examDate: '2026-11-18' },
      { name: 'CPT' }, { name: 'Cinese', examDate: '2026-12-01' },
    ]
    expect(examCountdown(subjects, NOW, TZ)).toEqual([{ name: 'DSP', days: 0 }, { name: 'Analog', days: 12 }, { name: 'Cinese', days: 12 }])
  })

  it.each([[90, '1,5'], [120, '2'], [0, '0'], [100, '1,7'], [175, '2,9']])('fmtHours(%i) = %s', (min, out) => {
    expect(fmtHours(min)).toBe(out)
  })

  it.each([[0, 'oggi'], [1, 'domani'], [12, 'tra 12 giorni']])('countdownText(%i) = %s', (d, out) => {
    expect(countdownText(d)).toBe(out)
  })
})

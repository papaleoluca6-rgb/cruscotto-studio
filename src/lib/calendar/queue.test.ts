import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, type CalEvent, type QueueOp } from '../../db/schema'
import { confirmConflict, describeFlush, discard, enqueue, withPending, type FlushResult } from './queue'

// Test di Opus (riga 04): fissano il comportamento di enqueue, overlay e riepilogo. Non si cambiano.

const NOW = Date.UTC(2026, 10, 19, 4)
const W = { workId: 'primary', excluded: [] as string[], now: NOW }
const cal = (id: string, title: string, extra: Partial<CalEvent> = {}): CalEvent => ({
  id, calendarId: 'primary', etag: `"e-${id}"`, title, cleanTitle: title.replace(/^(✅|✗|◐|↻) /, ''),
  status: title.startsWith('✅') ? 'done' : title.startsWith('✗') ? 'skipped' : title.startsWith('↻') ? 'moved' : 'todo',
  kind: 'study', subjectId: 'dsp', appTag: true, start: NOW - 7_200_000, end: NOW - 1_800_000,
  transparency: 'opaque', allDay: false, description: '', updated: '', ...extra,
})

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('enqueue', () => {
  it('Fatto: salva l\'azione con etag e titoli, senza toccare il registro', async () => {
    const op = await enqueue(cal('a', 'DSP Study: FFT'), 'done', { ...W, actualMin: 75 })
    expect(op).toMatchObject({
      eventId: 'a', calendarId: 'primary', action: 'done', etag: '"e-a"', fromTitle: 'DSP Study: FFT', toTitle: '✅ DSP Study: FFT',
      actualMin: 75, plannedStart: NOW - 7_200_000, plannedMin: 90, createdAt: NOW, rev: 0, state: 'pending',
    })
    expect(op.lastError).toBeUndefined()
    expect(typeof op.seq).toBe('number')
    expect(await db.calQueue.toArray()).toEqual([op])
    expect(await db.log.count()).toBe(0)
  })

  it('Salta su ↻ e Annulla segno su ✅', async () => {
    const skip = await enqueue(cal('a', '↻ DSP Study: FFT'), 'skip', W)
    expect(skip).toMatchObject({ toTitle: '✗ DSP Study: FFT' })
    expect(skip.actualMin).toBeUndefined()
    expect(await enqueue(cal('b', '✅ DSP Study: FFT'), 'undo', W)).toMatchObject({ toTitle: 'DSP Study: FFT' })
  })

  it('l\'ordine di invio segue l\'ordine di conferma', async () => {
    const a = await enqueue(cal('a', 'DSP Study: A'), 'skip', W)
    const b = await enqueue(cal('b', 'DSP Study: B'), 'skip', W)
    expect(b.seq).toBeGreaterThan(a.seq)
  })

  it('rifiuta eventi non scrivibili e azioni che non valgono per lo stato', async () => {
    await expect(enqueue(cal('a', 'Pranzo', { kind: undefined }), 'done', { ...W, actualMin: 30 })).rejects.toThrow(/non è una sessione/)
    await expect(enqueue(cal('a', 'DSP Study: X', { calendarId: 'altro' }), 'skip', W)).rejects.toThrow(/calendario di lavoro/)
    await expect(enqueue(cal('a', 'DSP Study: X'), 'skip', { ...W, excluded: ['primary'] })).rejects.toThrow(/calendario di lavoro/)
    await expect(enqueue(cal('a', 'DSP Study: X'), 'undo', W)).rejects.toThrow(/non ha un segno da annullare/)
    await expect(enqueue(cal('a', '✅ DSP Study: X'), 'done', { ...W, actualMin: 30 })).rejects.toThrow(/già segnata/)
    await expect(enqueue(cal('a', '✗ DSP Study: X'), 'skip', W)).rejects.toThrow(/già segnata/)
    expect(await db.calQueue.count()).toBe(0)
  })

  it.each([undefined, 0, 601, 1.5, Number.NaN])('Fatto con minuti non validi (%s): errore', async (actualMin) => {
    await expect(enqueue(cal('a', 'DSP Study: X'), 'done', { ...W, actualMin })).rejects.toThrow(/tra 1 e 600/)
    expect(await db.calQueue.count()).toBe(0)
  })

  it('una nuova azione sullo stesso evento sostituisce quella in attesa (vince l\'ultima)', async () => {
    const ev = cal('a', 'DSP Study: FFT')
    const first = await enqueue(ev, 'done', { ...W, actualMin: 60 })
    // Lo stato considerato è quello dopo l'azione in coda: su ✅ in coda vale solo Annulla segno.
    await expect(enqueue(ev, 'skip', W)).rejects.toThrow(/già segnata/)
    const undo = await enqueue(ev, 'undo', { ...W, now: NOW + 1000 })
    expect(undo).toMatchObject({ seq: first.seq, etag: '"e-a"', fromTitle: 'DSP Study: FFT', toTitle: 'DSP Study: FFT', action: 'undo', rev: 1, createdAt: NOW + 1000, state: 'pending' })
    expect(undo.actualMin).toBeUndefined()
    const skip = await enqueue(ev, 'skip', { ...W, now: NOW + 2000 })
    expect(skip).toMatchObject({ seq: first.seq, toTitle: '✗ DSP Study: FFT', action: 'skip', rev: 2 })
    expect(await db.calQueue.count()).toBe(1)
  })

  it('con un\'azione da rivedere sullo stesso evento: errore', async () => {
    const op = await enqueue(cal('a', 'DSP Study: FFT'), 'skip', W)
    await db.calQueue.update(op.seq, { state: 'conflict' })
    await expect(enqueue(cal('a', 'DSP Study: FFT'), 'done', { ...W, actualMin: 30 })).rejects.toThrow(/da rivedere/)
  })
})

describe('confirmConflict e discard', () => {
  it('riconferma: torna pending senza errore; scarta: tolta', async () => {
    const op = await enqueue(cal('a', 'DSP Study: FFT'), 'skip', W)
    await db.calQueue.update(op.seq, { state: 'conflict', lastError: 'cambiato' })
    await confirmConflict(op.seq)
    const back = await db.calQueue.get(op.seq)
    expect(back?.state).toBe('pending')
    expect(back?.lastError).toBeUndefined()
    await expect(confirmConflict(op.seq)).rejects.toThrow(/non è da riconfermare/)
    await discard(op.seq)
    expect(await db.calQueue.count()).toBe(0)
  })
})

describe('withPending', () => {
  it('pending: titolo e stato nuovi; conflict e rejected: evento com\'era, con l\'azione allegata', () => {
    const op = (eventId: string, state: QueueOp['state'], toTitle: string): QueueOp => ({
      seq: 1, eventId, calendarId: 'primary', action: 'done', etag: '', fromTitle: '', toTitle, plannedStart: 0, plannedMin: 0, createdAt: 0, rev: 0, state,
    })
    const evs = [cal('a', 'DSP Study: A'), cal('b', 'DSP Study: B'), cal('c', 'DSP Study: C')]
    const ops = [op('a', 'pending', '✅ DSP Study: A'), op('b', 'conflict', '✅ DSP Study: B')]
    const out = withPending(evs, ops)
    expect(out.map((e) => [e.id, e.title, e.status, e.cleanTitle, e.queued?.state])).toEqual([
      ['a', '✅ DSP Study: A', 'done', 'DSP Study: A', 'pending'],
      ['b', 'DSP Study: B', 'todo', 'DSP Study: B', 'conflict'],
      ['c', 'DSP Study: C', 'todo', 'DSP Study: C', undefined],
    ])
    expect(out[0].etag).toBe('"e-a"')
  })
})

describe('describeFlush', () => {
  const r = (p: Partial<FlushResult>): FlushResult => ({ sent: [], conflicts: [], rejected: [], left: 0, needsLogin: false, ...p })
  const ops = (n: number) => Array.from({ length: n }, () => ({}) as QueueOp)
  it.each([
    [r({}), 'Nessuna azione da inviare.'],
    [r({ sent: ops(2) }), 'Inviate a Calendar: 2.'],
    [r({ sent: ops(1), conflicts: ops(1), rejected: ops(1), left: 3, error: 'Google non raggiungibile: VPN spenta? (x)' }),
      'Inviate a Calendar: 1. Da riconfermare (cambiate su Calendar): 1. Non inviate: 1. Ancora in coda: 3. Google non raggiungibile: VPN spenta? (x)'],
    [r({ left: 2, error: 'Token scaduto o revocato: rifai l\'accesso a Google.' }), 'Ancora in coda: 2. Token scaduto o revocato: rifai l\'accesso a Google.'],
  ])('%#', (res, text) => {
    expect(describeFlush(res)).toBe(text)
  })
})

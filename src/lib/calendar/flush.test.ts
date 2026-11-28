import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/schema'
import { HttpError } from '../http'
import type { CalendarClient, EventBody, GEvent, WriteOpts } from './api'
import { refreshEvents } from './cache'
import { FakeCalendar } from './fake'
import { confirmConflict, enqueue, flushQueue } from './queue'

// Test di Opus (riga 04): invio della coda con il finto Calendar (ordine, If-Match, registro, 412, rete). Non si cambiano.

const TZ = 'Asia/Shanghai'
const NOW = Date.UTC(2026, 10, 19, 4)
const W = { workId: 'primary', excluded: [] as string[], now: NOW }
const ev = (id: string, summary: string, hour = -2): GEvent => ({
  id, summary, status: 'confirmed',
  start: { dateTime: new Date(NOW + hour * 3_600_000).toISOString() },
  end: { dateTime: new Date(NOW + (hour + 1) * 3_600_000).toISOString() },
})

/** Finto Calendar che registra le chiamate di scrittura e può fallire a comando. */
class Spy extends FakeCalendar {
  writes: { id: string; body: EventBody; ifMatch?: string }[] = []; failNext: Error[] = []; onPatch?: () => Promise<void>
  override async patch(id: string, body: EventBody, o?: WriteOpts) {
    this.writes.push({ id, body, ifMatch: o?.ifMatch })
    await this.onPatch?.()
    const err = this.failNext.shift()
    if (err) throw err
    return super.patch(id, body, o)
  }
}

let f: Spy
const cached = (id: string) => db.events.get(id).then((e) => e!)
const setup = async (...events: GEvent[]) => {
  f = new Spy({ events })
  await refreshEvents(f, TZ, { now: NOW })
}
const flush = (client: CalendarClient = f) => flushQueue({ client, tz: TZ, now: NOW + 60_000 })

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await db.subjects.add({ id: 'dsp', name: 'DSP', prefix: 'DSP', colorId: '8', difficulty: 3, importance: 3, updatedAt: 1 })
})

describe('flushQueue', () => {
  it('invia con If-Match, aggiorna titolo ed etag in cache, scrive il registro e svuota la coda', async () => {
    await setup(ev('a', 'DSP Study: FFT'))
    const before = await cached('a')
    const op = await enqueue(before, 'done', { ...W, actualMin: 50 })
    const r = await flush()
    expect(f.writes).toEqual([{ id: 'a', body: { summary: '✅ DSP Study: FFT' }, ifMatch: before.etag }])
    expect((await f.get('a')).summary).toBe('✅ DSP Study: FFT')
    const after = await cached('a')
    expect(after).toMatchObject({ title: '✅ DSP Study: FFT', status: 'done', etag: (await f.get('a')).etag })
    expect(after.etag).not.toBe(before.etag)
    expect(await db.calQueue.count()).toBe(0)
    const log = await db.log.toArray()
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ eventId: 'a', status: 'done', actualMin: 50, plannedMin: 60, plannedStart: before.start, date: NOW, updatedAt: NOW + 60_000 })
    expect(r).toMatchObject({ sent: [{ seq: op.seq, toTitle: '✅ DSP Study: FFT' }], conflicts: [], rejected: [], left: 0, needsLogin: false })
    expect(r.error).toBeUndefined()
  })

  it('ordine di conferma; Salta e Fatto sostituiscono le righe di segno precedenti, Annulla le toglie (con lapide)', async () => {
    await setup(ev('a', 'DSP Study: A'), ev('b', '✅ DSP Study: B'), ev('c', '✗ DSP Study: C'))
    const old = (id: string, eventId: string, status: 'done' | 'skipped' | 'moved') =>
      ({ id, eventId, status, plannedStart: 0, plannedMin: 60, date: 1, updatedAt: 1 })
    await db.log.bulkAdd([old('Lb', 'b', 'done'), old('Lc', 'c', 'skipped'), old('Lm', 'c', 'moved')])
    await enqueue(await cached('c'), 'undo', W)
    await enqueue(await cached('a'), 'skip', W)
    await enqueue(await cached('b'), 'undo', W)
    const r = await flush()
    expect(f.writes.map((w) => w.id)).toEqual(['c', 'a', 'b'])
    expect(r.sent.map((o) => o.eventId)).toEqual(['c', 'a', 'b'])
    const log = await db.log.toArray()
    expect(log.map((l) => [l.eventId, l.status]).sort()).toEqual([['a', 'skipped'], ['c', 'moved']])
    expect(log.find((l) => l.eventId === 'a')?.actualMin).toBeUndefined()
    expect((await db.tombstones.toArray()).map((t) => [t.table, t.id]).sort()).toEqual([['log', 'Lb'], ['log', 'Lc']])
  })

  it('412: non invia, rilegge l\'evento, la cache si aggiorna e l\'azione aspetta la riconferma; le altre partono', async () => {
    await setup(ev('a', 'DSP Study: FFT'), ev('b', 'DSP Study: B'))
    await enqueue(await cached('a'), 'done', { ...W, actualMin: 40 })
    await enqueue(await cached('b'), 'skip', W)
    const changed = f.touch('a', { summary: 'DSP Study: FFT e DFT' })
    const r = await flush()
    expect(r.conflicts).toHaveLength(1)
    expect(r.conflicts[0]).toMatchObject({ eventId: 'a', state: 'conflict', etag: changed.etag, fromTitle: 'DSP Study: FFT e DFT', toTitle: '✅ DSP Study: FFT e DFT', actualMin: 40 })
    expect(r.conflicts[0].lastError).toMatch(/cambiato su Calendar/)
    expect(r.sent.map((o) => o.eventId)).toEqual(['b'])
    expect((await f.get('a')).summary).toBe('DSP Study: FFT e DFT')
    expect(await cached('a')).toMatchObject({ title: 'DSP Study: FFT e DFT', etag: changed.etag })
    expect((await db.log.toArray()).map((l) => l.eventId)).toEqual(['b'])
    // Un nuovo invio senza riconferma non la tocca.
    f.writes = []
    expect(await flush()).toMatchObject({ sent: [], left: 0 })
    expect(f.writes).toEqual([])
    await confirmConflict(r.conflicts[0].seq)
    const r2 = await flush()
    expect(r2.sent.map((o) => o.toTitle)).toEqual(['✅ DSP Study: FFT e DFT'])
    expect((await f.get('a')).summary).toBe('✅ DSP Study: FFT e DFT')
    expect(await db.log.where('eventId').equals('a').count()).toBe(1)
  })

  it('412 e l\'evento non è più una sessione di studio: non inviata', async () => {
    await setup(ev('a', 'DSP Study: FFT'))
    await enqueue(await cached('a'), 'skip', W)
    f.touch('a', { summary: 'Pranzo' })
    const r = await flush()
    expect(r.rejected[0]).toMatchObject({ eventId: 'a', state: 'rejected', lastError: 'Non è più una sessione di studio: azione non inviata.' })
  })

  it('errore di rete: si ferma, l\'azione resta in coda con l\'errore, le successive non partono, niente registro', async () => {
    await setup(ev('a', 'DSP Study: A'), ev('b', 'DSP Study: B'))
    await enqueue(await cached('a'), 'skip', W)
    await enqueue(await cached('b'), 'skip', W)
    f.failNext = [new HttpError('network', 'Server non raggiungibile (rete bloccata, DNS o CORS): Failed to fetch')]
    const r = await flush()
    expect(f.writes.map((w) => w.id)).toEqual(['a'])
    expect(r).toMatchObject({ sent: [], conflicts: [], rejected: [], left: 2, needsLogin: false })
    expect(r.error).toMatch(/VPN spenta/)
    const ops = await db.calQueue.orderBy('seq').toArray()
    expect(ops.map((o) => o.state)).toEqual(['pending', 'pending'])
    expect(ops[0].lastError).toMatch(/VPN spenta/)
    expect(await db.log.count()).toBe(0)
    expect((await f.get('a')).summary).toBe('DSP Study: A')
    const r2 = await flush()
    expect(r2.sent.map((o) => o.eventId)).toEqual(['a', 'b'])
    expect(r2.left).toBe(0)
  })

  it('401: si ferma e chiede un nuovo accesso', async () => {
    await setup(ev('a', 'DSP Study: A'))
    await enqueue(await cached('a'), 'skip', W)
    f.failNext = [new HttpError('http', 'HTTP 401 (token scaduto o permesso mancante): Invalid Credentials', 401)]
    const r = await flush()
    expect(r).toMatchObject({ needsLogin: true, left: 1, error: 'Token scaduto o revocato: rifai l\'accesso a Google.' })
  })

  it('evento cancellato su Calendar: non inviata, tolta dalla cache; le altre continuano', async () => {
    await setup(ev('a', 'DSP Study: A'), ev('b', 'DSP Study: B'))
    await enqueue(await cached('a'), 'skip', W)
    await enqueue(await cached('b'), 'skip', W)
    await f.delete('a')
    const r = await flush()
    expect(r.rejected[0]).toMatchObject({ eventId: 'a', state: 'rejected', lastError: 'Evento cancellato su Calendar: azione non inviata.' })
    expect(r.sent.map((o) => o.eventId)).toEqual(['b'])
    expect(await db.events.get('a')).toBeUndefined()
    expect(await db.calQueue.count()).toBe(1)
  })

  it('calendario di lavoro cambiato: non inviata, senza chiamare Google', async () => {
    await setup(ev('a', 'DSP Study: A'))
    await enqueue(await cached('a'), 'skip', W)
    const other = new Spy({ calendarId: 'studio', events: [] })
    const r = await flush(other)
    expect(other.writes).toEqual([])
    expect(r.rejected[0]).toMatchObject({ state: 'rejected', lastError: 'Calendario di lavoro cambiato: azione non inviata.' })
  })

  it('azione sostituita durante l\'invio: il registro non si scrive, resta in coda con il nuovo etag', async () => {
    await setup(ev('a', 'DSP Study: FFT'))
    await enqueue(await cached('a'), 'done', { ...W, actualMin: 30 })
    f.onPatch = async () => {
      f.onPatch = undefined
      await enqueue(await cached('a'), 'skip', W).catch(() => undefined)
      await enqueue({ ...(await cached('a')), title: '✅ DSP Study: FFT', status: 'done' }, 'undo', W)
    }
    const r = await flush()
    expect(r.sent).toHaveLength(1)
    expect(r.left).toBe(1)
    expect(await db.log.count()).toBe(0)
    const op = (await db.calQueue.toArray())[0]
    expect(op).toMatchObject({ action: 'undo', state: 'pending', fromTitle: '✅ DSP Study: FFT', toTitle: 'DSP Study: FFT', etag: (await f.get('a')).etag })
    const r2 = await flush()
    expect(r2.sent).toHaveLength(1)
    expect((await f.get('a')).summary).toBe('DSP Study: FFT')
    expect(await db.calQueue.count()).toBe(0)
  })

  it('azione sostituita mentre parte una precedente: si invia la versione nuova', async () => {
    await setup(ev('a', 'DSP Study: A'), ev('b', 'DSP Study: B'))
    await enqueue(await cached('a'), 'skip', W)
    await enqueue(await cached('b'), 'done', { ...W, actualMin: 20 })
    f.onPatch = async () => { f.onPatch = undefined; await enqueue({ ...(await cached('b')), title: '✅ DSP Study: B', status: 'done' }, 'undo', W) }
    await flush()
    expect(f.writes.map((w) => [w.id, w.body.summary])).toEqual([['a', '✗ DSP Study: A'], ['b', 'DSP Study: B']])
    expect(await db.log.where('eventId').equals('b').count()).toBe(0)
  })

  it('due invii insieme: ogni azione parte una sola volta', async () => {
    await setup(ev('a', 'DSP Study: A'))
    await enqueue(await cached('a'), 'skip', W)
    const [r1, r2] = await Promise.all([flush(), flush()])
    expect(f.writes).toHaveLength(1)
    expect(r1).toBe(r2)
  })
})

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/schema'
import type { GEvent } from './api'
import { refreshEvents } from './cache'
import { FakeCalendar } from './fake'
import { discard, enqueue, flushQueue, withPending } from './queue'
import { enqueueImprevisto, enqueueNotDone, enqueuePartial, type MoveOpts } from './queueMove'

// Test di Opus (riga 05): Non fatto, Parziale e Imprevisto nella coda e nell'invio, con il finto Calendar. Non si cambiano.

const TZ = 'Asia/Shanghai'
const NOW = Date.UTC(2026, 10, 19, 4) // 12:00 a Shanghai
const H = 3_600_000
let ids = 0
const O: MoveOpts = {
  workId: 'primary', excluded: [], now: NOW, reminderMin: 10,
  subjects: [{ id: 'dsp', prefix: 'DSP', colorId: '8' }], newEventId: () => `00new${++ids}`,
}
const g = (id: string, summary: string, hour = -2, len = 1): GEvent => ({
  id, summary, status: 'confirmed', description: 'Material: slide 3-9\nTask: es. 2',
  start: { dateTime: new Date(NOW + hour * H).toISOString() },
  end: { dateTime: new Date(NOW + (hour + len) * H).toISOString() },
})
const slot = (hour: number, len = 1) => ({ start: NOW + hour * H, end: NOW + (hour + len) * H })

let f: FakeCalendar
const cached = (id: string) => db.events.get(id).then((e) => e!)
const setup = async (...events: GEvent[]) => {
  f = new FakeCalendar({ events })
  await refreshEvents(f, TZ, { now: NOW })
}
const flush = () => flushQueue({ client: f, tz: TZ, now: NOW + 60_000 })

beforeEach(async () => {
  ids = 0
  await Promise.all(db.tables.map((t) => t.clear()))
  await db.subjects.add({ id: 'dsp', name: 'DSP', prefix: 'DSP', colorId: '8', difficulty: 3, importance: 3, updatedAt: 1 })
})

describe('Non fatto', () => {
  it('in coda con ↻, nuovi orari e tag; dopo l\'invio evento spostato e registro notDone', async () => {
    await setup(g('a', 'DSP Study: FFT'))
    const op = await enqueueNotDone(await cached('a'), slot(5), O)
    expect(op).toMatchObject({
      action: 'notDone', toTitle: '↻ DSP Study: FFT', toStart: NOW + 5 * H, toEnd: NOW + 6 * H, plannedMin: 60, state: 'pending',
      extra: {
        extendedProperties: { private: { cruscotto: '1', tipo: 'study', materia: 'DSP' } },
        reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 10 }] },
      },
    })
    const view = withPending([await cached('a')], [op])[0]
    expect([view.start, view.end, view.status]).toEqual([NOW + 5 * H, NOW + 6 * H, 'moved'])

    const r = await flush()
    expect(r.sent).toHaveLength(1)
    const remote = await f.get('a')
    expect(remote.summary).toBe('↻ DSP Study: FFT')
    expect(Date.parse(remote.start!.dateTime!)).toBe(NOW + 5 * H)
    expect(remote.start!.timeZone).toBe(TZ)
    expect(remote.extendedProperties?.private?.cruscotto).toBe('1')
    expect((await cached('a')).start).toBe(NOW + 5 * H)
    expect(await db.log.toArray()).toEqual([expect.objectContaining({ eventId: 'a', status: 'notDone', movedTo: NOW + 5 * H, plannedMin: 60 })])
    expect(await db.calQueue.count()).toBe(0)
  })

  it('rifiutato su una sessione già segnata o non di studio', async () => {
    await setup(g('a', '✅ DSP Study: FFT'), g('l', 'Lezione DSP'))
    await expect(enqueueNotDone(await cached('a'), slot(5), O)).rejects.toThrow('già segnata')
    await expect(enqueueNotDone(await cached('l'), slot(5), O)).rejects.toThrow('non è una sessione di studio')
    expect(await db.calQueue.count()).toBe(0)
  })

  it('Fatto dopo un Non fatto in attesa: lo sostituisce e lo spostamento resta', async () => {
    await setup(g('a', 'DSP Study: FFT'))
    const first = await enqueueNotDone(await cached('a'), slot(5), O)
    const done = await enqueue(await cached('a'), 'done', { ...O, actualMin: 40 })
    expect(done).toMatchObject({ seq: first.seq, action: 'done', toTitle: '✅ DSP Study: FFT', toStart: NOW + 5 * H, rev: 1 })
    await flush()
    expect(Date.parse((await f.get('a')).start!.dateTime!)).toBe(NOW + 5 * H)
    expect((await db.log.toArray()).map((l) => l.status)).toEqual(['done'])
  })
})

describe('Parziale', () => {
  const P = { percent: 50 as const, note: 'es. 2b', actualMin: 30, resto: slot(6, 0.5) }

  it('◐ sull\'evento e resto inserito con id dell\'app, descrizione e tag; registro partial', async () => {
    await setup(g('a', '↻ DSP Study: FFT'))
    const [p, ins] = await enqueuePartial(await cached('a'), P, O)
    expect(p).toMatchObject({ action: 'partial', toTitle: '◐ DSP Study: FFT', percent: 50, note: 'es. 2b', actualMin: 30 })
    expect(ins).toMatchObject({
      action: 'insert', eventId: '00new1', etag: '', fromTitle: '', toTitle: 'DSP Study: FFT (resto)', linkedTo: 'a',
      toStart: NOW + 6 * H, toEnd: NOW + 6.5 * H, plannedStart: NOW + 6 * H, plannedMin: 30,
    })
    expect(ins.seq).toBeGreaterThan(p.seq)

    const r = await flush()
    expect(r.sent.map((o) => o.action)).toEqual(['partial', 'insert'])
    expect((await f.get('a')).summary).toBe('◐ DSP Study: FFT')
    const resto = await f.get('00new1')
    expect(resto).toMatchObject({ summary: 'DSP Study: FFT (resto)', colorId: '8', description: 'Resume from: es. 2b\nMaterial: slide 3-9\nTask: es. 2' })
    expect(resto.extendedProperties?.private).toMatchObject({ cruscotto: '1', tipo: 'study', materia: 'DSP' })
    expect(await cached('00new1')).toMatchObject({ kind: 'study', status: 'todo', start: NOW + 6 * H })
    expect(await db.log.toArray()).toEqual([expect.objectContaining({ eventId: 'a', status: 'partial', percent: 50, note: 'es. 2b', actualMin: 30 })])
  })

  it('dati non validi: niente in coda', async () => {
    await setup(g('a', 'DSP Study: FFT'))
    const ev = await cached('a')
    await expect(enqueuePartial(ev, { ...P, note: '  ' }, O)).rejects.toThrow()
    await expect(enqueuePartial(ev, { ...P, actualMin: 0 }, O)).rejects.toThrow()
    await expect(enqueuePartial(ev, { ...P, percent: 40 as 50 }, O)).rejects.toThrow()
    expect(await db.calQueue.count()).toBe(0)
  })

  it('il resto aspetta finché il Parziale è da riconfermare; scartare il Parziale scarta anche il resto', async () => {
    await setup(g('a', 'DSP Study: FFT'))
    const [p] = await enqueuePartial(await cached('a'), P, O)
    f.touch('a', { description: 'cambiata' })
    const r = await flush()
    expect(r.conflicts).toHaveLength(1)
    expect(r.left).toBe(1)
    expect(f.calls.some((c) => c.startsWith('insert'))).toBe(false)
    await discard(p.seq)
    expect(await db.calQueue.count()).toBe(0)
  })

  it('Annulla segno su un Parziale in attesa toglie anche il resto in attesa', async () => {
    await setup(g('a', 'DSP Study: FFT'))
    await enqueuePartial(await cached('a'), P, O)
    const undo = await enqueue(await cached('a'), 'undo', O)
    expect(await db.calQueue.toArray()).toEqual([undo])
  })

  it('resto già creato ma risposta persa: il nuovo invio (409) non crea un doppione', async () => {
    await setup(g('a', 'DSP Study: FFT'))
    const [, ins] = await enqueuePartial(await cached('a'), P, O)
    await f.insert({ id: ins.eventId, summary: ins.toTitle, start: { dateTime: new Date(ins.toStart!).toISOString() }, end: { dateTime: new Date(ins.toEnd!).toISOString() } })
    const r = await flush()
    expect(r.sent.map((o) => o.action)).toEqual(['partial', 'insert'])
    expect(r.rejected).toEqual([])
    expect(await db.events.get(ins.eventId)).toBeDefined()
    expect(await db.calQueue.count()).toBe(0)
  })
})

describe('Imprevisto', () => {
  it('evento inserito (non una sessione) e sessioni spostate con il motivo nel registro', async () => {
    await setup(g('a', 'DSP Study: FFT', 2), g('b', 'DSP Review +1d: Z', 3))
    const ops = await enqueueImprevisto({
      what: ' Dentista ', start: NOW + 2 * H, end: NOW + 4 * H,
      moves: [{ ev: await cached('a'), slot: slot(5) }, { ev: await cached('b'), slot: slot(6, 1) }],
    }, O)
    expect(ops.map((o) => [o.action, o.toTitle])).toEqual([
      ['insert', 'Imprevisto: Dentista'], ['move', '↻ DSP Study: FFT'], ['move', '↻ DSP Review +1d: Z'],
    ])
    expect(ops[1].reason).toBe('Imprevisto: Dentista')
    const r = await flush()
    expect(r.sent).toHaveLength(3)
    const imp = await f.get('00new1')
    expect(imp.extendedProperties?.private).toEqual({ cruscotto: 'imprevisto' })
    expect((await cached('00new1')).kind).toBeUndefined()
    const log = await db.log.orderBy('eventId').toArray()
    expect(log.map((l) => [l.eventId, l.status, l.movedTo, l.reason])).toEqual([
      ['a', 'moved', NOW + 5 * H, 'Imprevisto: Dentista'], ['b', 'moved', NOW + 6 * H, 'Imprevisto: Dentista'],
    ])
  })

  it('una sessione non spostabile: niente in coda (o tutto o niente)', async () => {
    await setup(g('a', 'DSP Study: FFT', 2), g('b', '✅ DSP Study: Z', 3))
    await expect(enqueueImprevisto({
      what: 'Dentista', start: NOW + 2 * H, end: NOW + 4 * H,
      moves: [{ ev: await cached('a'), slot: slot(5) }, { ev: await cached('b'), slot: slot(6) }],
    }, O)).rejects.toThrow()
    expect(await db.calQueue.count()).toBe(0)
  })

  it('orari o testo non validi: errore', async () => {
    await setup()
    await expect(enqueueImprevisto({ what: '', start: NOW + H, end: NOW + 2 * H, moves: [] }, O)).rejects.toThrow()
    await expect(enqueueImprevisto({ what: 'x', start: NOW + 2 * H, end: NOW + H, moves: [] }, O)).rejects.toThrow()
    expect(await db.calQueue.count()).toBe(0)
  })
})

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/schema'
import { HttpError } from '../http'
import { DAY } from '../time'
import type { GEvent } from './api'
import { dropStaleCache, refreshEvents } from './cache'
import { FakeCalendar } from './fake'

const TZ = 'Asia/Shanghai'
const NOW = Date.UTC(2026, 10, 19, 4)
const ev = (id: string, dayOffset: number, summary = 'Pranzo', extra: Partial<GEvent> = {}): GEvent => ({
  id, summary, status: 'confirmed',
  start: { dateTime: new Date(NOW + dayOffset * DAY).toISOString() },
  end: { dateTime: new Date(NOW + dayOffset * DAY + 3_600_000).toISOString() },
  ...extra,
})

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await db.subjects.add({ id: 'dsp', name: 'DSP', prefix: 'DSP', colorId: '8', difficulty: 3, importance: 3, updatedAt: 1 })
})

describe('refreshEvents', () => {
  it('prima lettura completa: cache con etag, tag e syncToken; tolti i finiti da più di 7 giorni', async () => {
    const f = new FakeCalendar({ events: [ev('vecchio', -10), ev('ieri', -1, 'DSP Study: FFT'), ev('futuro', 200, 'x', { extendedProperties: { private: { cruscotto: '1', tipo: 'review', materia: 'DSP' } } })] })
    const r = await refreshEvents(f, TZ, { now: NOW })
    expect(r).toMatchObject({ mode: 'full', total: 2 })
    expect(f.calls[0]).toBe(`list ${JSON.stringify({ maxResults: 2500 })}`)
    const rows = await db.events.orderBy('start').toArray()
    expect(rows.map((e) => [e.id, e.kind, e.subjectId, e.appTag])).toEqual([['ieri', 'study', 'dsp', false], ['futuro', 'review', 'dsp', true]])
    expect(rows.every((e) => e.etag.startsWith('"fake-'))).toBe(true)
    expect(await db.calSync.get('work')).toMatchObject({ source: 'fake', calendarId: 'primary', mode: 'sync', lastSync: NOW })
  })

  it('letture successive con il solo syncToken: cambiati aggiornati, cancellati tolti', async () => {
    const f = new FakeCalendar({ events: [ev('a', 1), ev('b', 2), ev('c', 3)] })
    await refreshEvents(f, TZ, { now: NOW })
    const etagA = (await db.events.get('a'))!.etag
    f.touch('a', { summary: '✅ DSP Study: FFT' })
    await f.delete('b')
    const r = await refreshEvents(f, TZ, { now: NOW })
    expect(r).toEqual({ mode: 'incremental', changed: 1, removed: 1, total: 2 })
    expect(JSON.parse(f.calls.at(-1)!.slice(5))).toEqual({ syncToken: expect.any(String), maxResults: 2500 })
    const a = (await db.events.get('a'))!
    expect(a.etag).not.toBe(etagA)
    expect(a).toMatchObject({ status: 'done', kind: 'study' })
    expect(await db.events.get('b')).toBeUndefined()
  })

  it('410: scarta il token e rilegge tutto', async () => {
    const f = new FakeCalendar({ events: [ev('a', 1)] })
    await refreshEvents(f, TZ, { now: NOW })
    f.expireSyncTokens()
    await f.insert(ev('n', 2))
    const r = await refreshEvents(f, TZ, { now: NOW })
    expect(r.mode).toBe('full')
    expect(await db.events.count()).toBe(2)
  })

  it('lettura completa troppo pesante: ripiego a finestra -7/+15 giorni senza token', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ev(`r${i}`, i - 5))
    const f = new FakeCalendar({ events: many, pageSize: 5 })
    const r = await refreshEvents(f, TZ, { now: NOW, maxFullPages: 2 })
    expect(r.mode).toBe('window')
    const last = JSON.parse(f.calls.at(-1)!.slice(5)) as Record<string, string>
    expect(last.orderBy).toBe('startTime')
    expect(Date.parse(last.timeMax) - NOW).toBe(15 * DAY)
    expect(await db.calSync.get('work')).toMatchObject({ mode: 'window', syncToken: undefined })
    expect(await db.events.count()).toBe(20)
  })

  it('le materie cambiate si riapplicano a tutta la cache', async () => {
    const f = new FakeCalendar({ events: [ev('a', 1, 'Analog Study: bjt')] })
    await refreshEvents(f, TZ, { now: NOW })
    expect((await db.events.get('a'))!.kind).toBeUndefined()
    await db.subjects.add({ id: 'an', name: 'Analog', prefix: 'Analog', colorId: '6', difficulty: 3, importance: 3, updatedAt: 1 })
    await refreshEvents(f, TZ, { now: NOW })
    expect(await db.events.get('a')).toMatchObject({ kind: 'study', subjectId: 'an' })
  })

  it('altro calendario o altra fonte: cache sostituita', async () => {
    await refreshEvents(new FakeCalendar({ events: [ev('a', 1)] }), TZ, { now: NOW })
    await refreshEvents(new FakeCalendar({ calendarId: 'studio', events: [ev('z', 1)] }), TZ, { now: NOW })
    expect((await db.events.toArray()).map((e) => [e.id, e.calendarId])).toEqual([['z', 'studio']])
  })

  it('evento spostato nel passato lontano: tolto, niente fantasma nel futuro', async () => {
    const f = new FakeCalendar({ events: [ev('a', 1)] })
    await refreshEvents(f, TZ, { now: NOW })
    f.touch('a', { start: ev('x', -20).start, end: ev('x', -20).end })
    const r = await refreshEvents(f, TZ, { now: NOW })
    expect(r).toMatchObject({ mode: 'incremental', changed: 0, total: 0 })
    expect(await db.events.get('a')).toBeUndefined()
  })

  it('fuso cambiato: rilettura completa (gli eventi di tutto il giorno cambiano orario)', async () => {
    const f = new FakeCalendar({ events: [{ id: 'd', summary: 'Festa', start: { date: '2026-11-25' }, end: { date: '2026-11-26' } }] })
    await refreshEvents(f, TZ, { now: NOW })
    expect((await db.events.get('d'))!.start).toBe(Date.UTC(2026, 10, 24, 16))
    const r = await refreshEvents(f, 'Europe/Rome', { now: NOW })
    expect(r.mode).toBe('full')
    expect((await db.events.get('d'))!.start).toBe(Date.UTC(2026, 10, 24, 23))
  })

  it('ripiego a finestra: dopo 7 giorni si ritenta la lettura completa', async () => {
    const f = new FakeCalendar({ events: Array.from({ length: 12 }, (_, i) => ev(`r${i}`, i)), pageSize: 5 })
    await refreshEvents(f, TZ, { now: NOW, maxFullPages: 2 })
    expect((await refreshEvents(f, TZ, { now: NOW + DAY, maxFullPages: 2 })).mode).toBe('window')
    expect((await refreshEvents(f, TZ, { now: NOW + 8 * DAY })).mode).toBe('full')
    expect(await db.calSync.get('work')).toMatchObject({ mode: 'sync', fullTriedAt: NOW + 8 * DAY })
  })

  it('calendario di lavoro cambiato o escluso: cache svuotata', async () => {
    await refreshEvents(new FakeCalendar({ events: [ev('a', 1)] }), TZ, { now: NOW })
    expect(await dropStaleCache('primary', [])).toBe(false)
    expect(await db.events.count()).toBe(1)
    expect(await dropStaleCache('primary', ['primary'])).toBe(true)
    expect(await db.events.count()).toBe(0)
    expect(await db.calSync.get('work')).toBeUndefined()
    await refreshEvents(new FakeCalendar({ events: [ev('a', 1)] }), TZ, { now: NOW })
    expect(await dropStaleCache('studio', [])).toBe(true)
  })

  it('errore: cache e token restano com\'erano', async () => {
    const f = new FakeCalendar({ events: [ev('a', 1)] })
    await refreshEvents(f, TZ, { now: NOW })
    const before = await db.calSync.get('work')
    vi.spyOn(f, 'list').mockRejectedValue(new HttpError('network', 'giù'))
    await expect(refreshEvents(f, TZ, { now: NOW + 1000 })).rejects.toMatchObject({ kind: 'network' })
    expect(await db.calSync.get('work')).toEqual(before)
    expect(await db.events.count()).toBe(1)
  })
})

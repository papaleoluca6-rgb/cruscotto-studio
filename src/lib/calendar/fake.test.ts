import { describe, expect, it } from 'vitest'
import { EtagMismatchError, studyFields, timesBody } from './api'
import { FakeCalendar } from './fake'

const NOW = Date.UTC(2026, 10, 19, 4) // 12:00 a Shanghai
const fake = (pageSize = 250) => new FakeCalendar({ now: NOW, pageSize })

describe('finto Calendar', () => {
  it('eventi di esempio con etag, tag e promemoria', async () => {
    const { items, nextSyncToken } = await fake().list({})
    expect(items.length).toBeGreaterThan(10)
    expect(items.every((e) => e.etag)).toBe(true)
    expect(items.some((e) => e.extendedProperties?.private?.cruscotto === '1' && e.reminders?.overrides?.length)).toBe(true)
    expect(nextSyncToken).toBeTruthy()
  })

  it('paginazione: il syncToken arriva sull\'ultima pagina', async () => {
    const f = fake(5)
    const p1 = await f.list({})
    expect(p1.items).toHaveLength(5)
    expect(p1.nextPageToken).toBeTruthy()
    expect(p1.nextSyncToken).toBeUndefined()
    const p2 = await f.list({ pageToken: p1.nextPageToken })
    const p3 = await f.list({ pageToken: p2.nextPageToken })
    expect(p3.nextPageToken).toBeUndefined()
    expect(p3.nextSyncToken).toBeTruthy()
  })

  it('syncToken: solo i cambiati e i cancellati', async () => {
    const f = fake()
    const { items, nextSyncToken } = await f.list({})
    await f.patch(items[0].id, { summary: 'nuovo' })
    await f.delete(items[1].id)
    const inc = await f.list({ syncToken: nextSyncToken })
    expect(inc.items.map((e) => [e.id, e.status])).toEqual([[items[0].id, 'confirmed'], [items[1].id, 'cancelled']])
    expect((await f.list({ syncToken: inc.nextSyncToken })).items).toEqual([])
  })

  it('400 per syncToken con i filtri, 410 per token sconosciuto o scaduto', async () => {
    const f = fake()
    const { nextSyncToken } = await f.list({})
    await expect(f.list({ syncToken: nextSyncToken, timeMin: new Date(NOW).toISOString() })).rejects.toMatchObject({ status: 400 })
    await expect(f.list({ syncToken: nextSyncToken, privateExtendedProperty: 'cruscotto=1' })).rejects.toMatchObject({ status: 400 })
    await expect(f.list({ syncToken: 'boh' })).rejects.toMatchObject({ status: 410 })
    f.expireSyncTokens()
    await expect(f.list({ syncToken: nextSyncToken })).rejects.toMatchObject({ status: 410 })
  })

  it('filtro privateExtendedProperty e finestra ordinata, senza syncToken', async () => {
    const f = fake()
    const tagged = await f.list({ privateExtendedProperty: 'cruscotto=1' })
    expect(tagged.items.length).toBeGreaterThan(0)
    expect(tagged.items.every((e) => e.extendedProperties?.private?.cruscotto === '1')).toBe(true)
    expect(tagged.nextSyncToken).toBeUndefined()
    const w = await f.list({ timeMin: new Date(NOW).toISOString(), timeMax: new Date(NOW + 86_400_000).toISOString(), orderBy: 'startTime' })
    const starts = w.items.map((e) => Date.parse(e.start?.dateTime ?? `${e.start?.date}T00:00:00+08:00`))
    expect(starts).toEqual([...starts].sort((a, b) => a - b))
    expect(w.items.length).toBeGreaterThan(0)
  })

  it('412 se ifMatch non coincide, nuovo etag dopo ogni scrittura', async () => {
    const f = fake()
    const ev = (await f.list({})).items[0]
    const after = await f.patch(ev.id, { summary: 'x' }, { ifMatch: ev.etag })
    expect(after.etag).not.toBe(ev.etag)
    await expect(f.patch(ev.id, { summary: 'y' }, { ifMatch: ev.etag })).rejects.toBeInstanceOf(EtagMismatchError)
    await expect(f.delete(ev.id, { ifMatch: ev.etag })).rejects.toMatchObject({ status: 412 })
    await f.delete(ev.id, { ifMatch: after.etag })
    await expect(f.get(ev.id)).rejects.toMatchObject({ status: 410 })
    await expect(f.get('nessuno')).rejects.toMatchObject({ status: 404 })
  })

  it('insert con tag e promemoria; patch unisce il tag', async () => {
    const f = fake()
    const ev = await f.insert({ summary: 'DSP Study: FFT', ...timesBody(NOW, NOW + 3_600_000, 'Asia/Shanghai'), ...studyFields('study', 'DSP', 10) })
    expect(ev.start?.dateTime).toBe('2026-11-19T12:00:00+08:00')
    expect(ev.extendedProperties?.private).toEqual({ cruscotto: '1', tipo: 'study', materia: 'DSP' })
    expect(ev.reminders).toEqual({ useDefault: false, overrides: [{ method: 'popup', minutes: 10 }] })
    const moved = await f.patch(ev.id, { extendedProperties: { private: { tipo: 'review' } } })
    expect(moved.extendedProperties?.private).toEqual({ cruscotto: '1', tipo: 'review', materia: 'DSP' })
  })
})

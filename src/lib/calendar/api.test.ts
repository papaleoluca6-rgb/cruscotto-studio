import { afterEach, describe, expect, it, vi } from 'vitest'
import { googleJson, HttpError } from '../http'
import { calendarErrorMessage, EtagMismatchError, googleClient } from './api'

afterEach(() => vi.unstubAllGlobals())

const reply = (status: number, body: string) => vi.fn(async () => new Response(body, { status }))

describe('googleJson', () => {
  it('errore http con status e messaggio di Google', async () => {
    vi.stubGlobal('fetch', reply(401, JSON.stringify({ error: { message: 'Invalid Credentials' } })))
    const e = await googleJson('GET', 'https://x', {}).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(HttpError)
    expect(e).toMatchObject({ kind: 'http', status: 401 })
    expect((e as Error).message).toContain('Invalid Credentials')
  })

  it('rete bloccata = errore network', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(googleJson('GET', 'https://x', {})).rejects.toMatchObject({ kind: 'network' })
  })

  it('timeout anche se la risposta non arriva mai', async () => {
    vi.stubGlobal('fetch', vi.fn((_u: string, init: RequestInit) => new Promise((_r, rej) => {
      init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))
    })))
    await expect(googleJson('GET', 'https://x', {}, undefined, 10)).rejects.toMatchObject({ kind: 'timeout' })
  })
})

describe('googleClient', () => {
  const client = (excluded: string[] = []) => googleClient({ calendarId: 'lavoro@x', timeZone: 'Asia/Shanghai', excluded, token: async () => 'tok' })
  const call = (f: ReturnType<typeof vi.fn>, i = 0) => {
    const [url, init] = f.mock.calls[i] as unknown as [string, RequestInit]
    return { url: new URL(url), init, headers: init.headers as Record<string, string> }
  }

  it('list: singleEvents, timeZone, token, paginazione', async () => {
    const f = reply(200, JSON.stringify({ items: [{ id: 'a' }], nextSyncToken: 's1' }))
    vi.stubGlobal('fetch', f)
    expect(await client().list({ pageToken: 'p2' })).toEqual({ items: [{ id: 'a' }], nextPageToken: undefined, nextSyncToken: 's1' })
    const { url, headers } = call(f)
    expect(url.pathname).toBe('/calendar/v3/calendars/lavoro%40x/events')
    expect(Object.fromEntries(url.searchParams)).toEqual({ singleEvents: 'true', timeZone: 'Asia/Shanghai', maxResults: '2500', pageToken: 'p2' })
    expect(headers.Authorization).toBe('Bearer tok')
  })

  it('syncToken con filtri: rifiutato prima di chiamare Google', async () => {
    const f = reply(200, '{}')
    vi.stubGlobal('fetch', f)
    await expect(client().list({ syncToken: 's', orderBy: 'startTime' })).rejects.toMatchObject({ status: 400 })
    expect(f).not.toHaveBeenCalled()
  })

  it('patch: If-Match, sendUpdates=none, timeZone negli orari', async () => {
    const f = reply(200, JSON.stringify({ id: 'e', etag: '"2"' }))
    vi.stubGlobal('fetch', f)
    await client().patch('e', { start: { dateTime: '2026-11-19T09:00:00+08:00' } }, { ifMatch: '"1"' })
    const { url, init, headers } = call(f)
    expect(init.method).toBe('PATCH')
    expect(url.searchParams.get('sendUpdates')).toBe('none')
    expect(headers['If-Match']).toBe('"1"')
    expect(JSON.parse(init.body as string)).toEqual({ start: { dateTime: '2026-11-19T09:00:00+08:00', timeZone: 'Asia/Shanghai' } })
  })

  it('412 → EtagMismatchError; delete con risposta vuota', async () => {
    vi.stubGlobal('fetch', reply(412, JSON.stringify({ error: { message: 'Precondition Failed' } })))
    await expect(client().delete('e', { ifMatch: '"1"' })).rejects.toBeInstanceOf(EtagMismatchError)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    await expect(client().delete('e')).resolves.toBeUndefined()
  })

  it('calendario escluso: mai letto né scritto', () => {
    expect(() => client(['lavoro@x'])).toThrow(/esclusi/)
  })
})

describe('calendarErrorMessage', () => {
  const http = (status: number, msg = '') => new HttpError('http', `HTTP ${status}: ${msg}`, status)
  it.each([
    [new HttpError('network', 'x'), 'VPN spenta?'],
    [new HttpError('timeout', 'x'), 'VPN spenta?'],
    [http(401), 'Token scaduto'],
    [http(403, 'Calendar API has not been used in project 1'), 'non abilitata'],
    [http(403, 'Rate Limit Exceeded'), 'Quota'],
    [http(403, 'Calendar usage limits exceeded.'), 'Quota'],
    [http(403, 'Cannot generate token'), 'Permesso negato'],
    [http(429), 'Quota'],
    [http(404), 'non trovato'],
    [http(410), 'rileggere tutto'],
    [new EtagMismatchError(), 'cambiato su Calendar'],
  ])('%s', (e, text) => expect(calendarErrorMessage(e)).toContain(text))
})

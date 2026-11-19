import { afterEach, describe, expect, it, vi } from 'vitest'
import { getJson, HttpError } from '../http'
import { calendarErrorMessage, listEvents } from './api'

afterEach(() => vi.unstubAllGlobals())

const reply = (status: number, body: string) => vi.fn(async () => new Response(body, { status }))

describe('getJson', () => {
  it('errore http con status e messaggio di Google', async () => {
    vi.stubGlobal('fetch', reply(401, JSON.stringify({ error: { message: 'Invalid Credentials' } })))
    const e = await getJson('https://x', {}).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(HttpError)
    expect(e).toMatchObject({ kind: 'http', status: 401 })
    expect((e as Error).message).toContain('Invalid Credentials')
  })

  it('rete bloccata = errore network', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(getJson('https://x', {})).rejects.toMatchObject({ kind: 'network' })
  })

  it('timeout anche se la risposta non arriva mai', async () => {
    vi.stubGlobal('fetch', vi.fn((_u: string, init: RequestInit) => new Promise((_r, rej) => {
      init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))
    })))
    await expect(getJson('https://x', {}, 10)).rejects.toMatchObject({ kind: 'timeout' })
  })
})

describe('listEvents', () => {
  it('passa timeZone, singleEvents e il token', async () => {
    const f = reply(200, JSON.stringify({ items: [{ id: 'a', summary: 'Analisi' }] }))
    vi.stubGlobal('fetch', f)
    const items = await listEvents('tok', 'primary', new Date(0), new Date(1000), 'Asia/Shanghai')
    expect(items).toEqual([{ id: 'a', summary: 'Analisi' }])
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    const q = new URL(url).searchParams
    expect(q.get('timeZone')).toBe('Asia/Shanghai')
    expect(q.get('singleEvents')).toBe('true')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
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
    [http(404), 'Calendario non trovato'],
  ])('%s', (e, text) => expect(calendarErrorMessage(e)).toContain(text))
})

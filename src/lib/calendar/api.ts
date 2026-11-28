import type { SessionKind } from '../../db/schema'
import { googleJson, HttpError } from '../http'
import { toZonedIso } from '../time'

const BASE = 'https://www.googleapis.com/calendar/v3'

/** Campi di un evento usati dall'app (Calendar API v3). Il riconoscimento delle sessioni è in parse.ts. */
export interface GEvent {
  id: string
  etag?: string
  status?: 'confirmed' | 'tentative' | 'cancelled'
  summary?: string
  description?: string
  start?: { dateTime?: string; date?: string; timeZone?: string }
  end?: { dateTime?: string; date?: string; timeZone?: string }
  transparency?: 'opaque' | 'transparent'
  extendedProperties?: { private?: Record<string, string>; shared?: Record<string, string> }
  reminders?: { useDefault: boolean; overrides?: { method: 'popup' | 'email'; minutes: number }[] }
  colorId?: string
  updated?: string
}

/** Parametri di events.list. `syncToken` non si combina con timeMin/timeMax/orderBy/privateExtendedProperty (400). */
export interface ListParams {
  syncToken?: string
  pageToken?: string
  timeMin?: string
  timeMax?: string
  orderBy?: 'startTime'
  /** "chiave=valore", es. "cruscotto=1": solo una comodità, il riconoscimento passa sempre da parse.ts. */
  privateExtendedProperty?: string
  maxResults?: number
}

export interface ListPage { items: GEvent[]; nextPageToken?: string; nextSyncToken?: string }
export interface WriteOpts { /** etag atteso: header If-Match (412 se l'evento è cambiato). */ ifMatch?: string }
export type EventBody = Partial<Omit<GEvent, 'id' | 'etag' | 'updated'>>

/**
 * Client di un solo calendario (quello di lavoro): Google vero o finto (fake.ts), stessa interfaccia.
 * Le scritture le chiama solo chi ha già mostrato anteprima e conferma, e solo su eventi di studio.
 */
export interface CalendarClient {
  readonly source: 'google' | 'fake'
  readonly calendarId: string
  list(p: ListParams): Promise<ListPage>
  get(id: string): Promise<GEvent>
  patch(id: string, body: EventBody, o?: WriteOpts): Promise<GEvent>
  insert(body: EventBody): Promise<GEvent>
  delete(id: string, o?: WriteOpts): Promise<void>
}

/** 412: l'evento su Calendar non ha più l'etag atteso (cambiato altrove). Lo gestisce la coda (riga 04). */
export class EtagMismatchError extends HttpError {
  constructor(message = 'Evento cambiato su Calendar dopo l\'ultima lettura.') {
    super('http', message, 412)
    this.name = 'EtagMismatchError'
  }
}

export const SYNC_FORBIDDEN = ['timeMin', 'timeMax', 'orderBy', 'privateExtendedProperty'] as const

/** Un syncToken non si combina con i filtri: stesso controllo nel client vero e nel finto. */
export function checkListParams(p: ListParams) {
  const bad = SYNC_FORBIDDEN.filter((k) => p[k] !== undefined)
  if (p.syncToken && bad.length) throw new HttpError('http', `HTTP 400: syncToken insieme a ${bad.join(', ')}`, 400)
}

/** Rifiuta un calendario escluso: mai letto né scritto. */
export function assertNotExcluded(calendarId: string, excluded: string[]) {
  if (excluded.includes(calendarId)) throw new Error(`Il calendario "${calendarId}" è tra gli esclusi: scegli un altro calendario di lavoro.`)
}

/** Aggiunge `timeZone` agli orari con dateTime: Calendar li interpreta nel fuso dell'utente. */
const withZone = (b: EventBody, timeZone: string): EventBody => ({
  ...b,
  ...(b.start?.dateTime && { start: { timeZone, ...b.start } }),
  ...(b.end?.dateTime && { end: { timeZone, ...b.end } }),
})

interface GoogleOpts { calendarId: string; timeZone: string; excluded: string[]; token: () => Promise<string> }

/** Client per Google Calendar (fetch alla API v3, niente gapi). Sempre `timeZone` e `sendUpdates=none`. */
export function googleClient({ calendarId, timeZone, excluded, token }: GoogleOpts): CalendarClient {
  assertNotExcluded(calendarId, excluded)
  const events = `${BASE}/calendars/${encodeURIComponent(calendarId)}/events`
  const call = async <T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, body?: unknown, o?: WriteOpts): Promise<T> => {
    const headers: Record<string, string> = { Authorization: `Bearer ${await token()}` }
    if (o?.ifMatch) headers['If-Match'] = o.ifMatch
    try {
      return await googleJson<T>(method, url, headers, body)
    } catch (e) {
      if (e instanceof HttpError && e.status === 412) throw new EtagMismatchError()
      throw e
    }
  }
  const one = (id: string) => `${events}/${encodeURIComponent(id)}`
  const writeQ = `?${new URLSearchParams({ sendUpdates: 'none' })}`
  return {
    source: 'google',
    calendarId,
    async list(p) {
      checkListParams(p)
      const q = new URLSearchParams({ singleEvents: 'true', timeZone, maxResults: String(p.maxResults ?? 2500) })
      for (const k of ['syncToken', 'pageToken', ...SYNC_FORBIDDEN] as const) if (p[k] !== undefined) q.set(k, String(p[k]))
      const r = await call<{ items?: GEvent[]; nextPageToken?: string; nextSyncToken?: string }>('GET', `${events}?${q}`)
      return { items: r.items ?? [], nextPageToken: r.nextPageToken, nextSyncToken: r.nextSyncToken }
    },
    get: (id) => call<GEvent>('GET', `${one(id)}?${new URLSearchParams({ timeZone })}`),
    patch: (id, body, o) => call<GEvent>('PATCH', one(id) + writeQ, withZone(body, timeZone), o),
    insert: (body) => call<GEvent>('POST', events + writeQ, withZone(body, timeZone)),
    delete: (id, o) => call<void>('DELETE', one(id) + writeQ, undefined, o),
  }
}

/** Tag e promemoria che ogni evento creato o spostato dall'app porta (formato-calendar.md). Mai colorId per lo stato. */
export function studyFields(kind: SessionKind, materia: string, reminderMin: number): EventBody {
  return {
    extendedProperties: { private: { cruscotto: '1', tipo: kind, materia } },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: reminderMin }] },
  }
}

/** Orari di inizio e fine nel fuso dell'utente. */
export const timesBody = (start: number, end: number, timeZone: string): EventBody => ({
  start: { dateTime: toZonedIso(start, timeZone), timeZone },
  end: { dateTime: toZonedIso(end, timeZone), timeZone },
})

/** Messaggio specifico per un errore di Calendar: VPN spenta, token scaduto, API non abilitata, quota, calendario sbagliato. */
export function calendarErrorMessage(e: unknown): string {
  if (!(e instanceof HttpError)) return e instanceof Error ? e.message : String(e)
  if (e.kind !== 'http') return `Google non raggiungibile: VPN spenta? (${e.message})`
  const m = e.message.toLowerCase()
  switch (e.status) {
    case 401:
      return 'Token scaduto o revocato: rifai l\'accesso a Google.'
    case 403:
      if (m.includes('has not been used') || m.includes('disabled')) return 'Google Calendar API non abilitata nel progetto della Cloud Console.'
      if (['rate limit', 'ratelimit', 'usage limit', 'quota'].some((w) => m.includes(w))) return 'Quota di Google superata: riprova tra qualche minuto.'
      return `Permesso negato da Google: ${e.message}`
    case 404:
      return 'Calendario o evento non trovato: controlla "Calendario di lavoro" in Impostazioni.'
    case 410:
      return 'Dati di sincronizzazione scaduti: tocca di nuovo Aggiorna per rileggere tutto.'
    case 412:
      return 'Evento cambiato su Calendar dopo l\'ultima lettura: aggiorna e riprova.'
    case 429:
      return 'Quota di Google superata: riprova tra qualche minuto.'
    default:
      return `Errore di Google Calendar: ${e.message}`
  }
}

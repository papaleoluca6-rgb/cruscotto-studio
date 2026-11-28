import { HttpError } from '../http'
import { zonedToMs } from '../time'
import { assertNotExcluded, checkListParams, EtagMismatchError, type CalendarClient, type EventBody, type GEvent, type ListPage, type ListParams, type WriteOpts } from './api'
import { sampleEvents } from './fakeData'

// Finto Google Calendar in memoria (docs/spec/03-calendar-fake.md): stessa interfaccia del client vero, 400/404/410/412,
// syncToken con i cancellati. Si usa in sviluppo e nei test, mai dati reali.

interface Stored { ev: GEvent; seq: number; deleted: boolean }

const notFound = (id: string) => new HttpError('http', `HTTP 404: evento ${id} non trovato`, 404)
const timeOf = (t: GEvent['start'], tz: string) => (t?.date ? zonedToMs(t.date, '00:00', tz) : Date.parse(t?.dateTime ?? ''))

export interface FakeOpts {
  calendarId?: string
  timeZone?: string
  /** Eventi iniziali; default: esempi inventati attorno a `now`. */
  events?: GEvent[]
  /** Eventi per pagina (per provare la paginazione). */
  pageSize?: number
  now?: number
}

export class FakeCalendar implements CalendarClient {
  readonly source = 'fake'
  readonly calendarId: string
  private readonly tz: string
  private readonly pageSize: number
  private readonly store = new Map<string, Stored>()
  private seq = 0
  private nextId = 1
  /** syncToken emessi → numero di modifica a cui si riferiscono. */
  private readonly tokens = new Map<string, number>()
  /** Chiamate ricevute (per i test). */
  readonly calls: string[] = []

  constructor(o: FakeOpts = {}) {
    this.calendarId = o.calendarId ?? 'primary'
    this.tz = o.timeZone ?? 'Asia/Shanghai'
    this.pageSize = o.pageSize ?? 250
    for (const ev of o.events ?? sampleEvents(this.tz, o.now ?? Date.now())) this.save({ ...ev })
  }

  private save(ev: GEvent, deleted = false): GEvent {
    this.seq++
    const out = { ...ev, etag: `"fake-${this.seq}"`, updated: new Date().toISOString(), ...(deleted && { status: 'cancelled' as const }) }
    this.store.set(ev.id, { ev: out, seq: this.seq, deleted })
    return structuredClone(out)
  }

  private live(id: string, ifMatch?: string): Stored {
    const s = this.store.get(id)
    if (!s) throw notFound(id)
    // Come Google: un evento già cancellato risponde 410.
    if (s.deleted) throw new HttpError('http', `HTTP 410: evento ${id} già cancellato`, 410)
    if (ifMatch && ifMatch !== s.ev.etag) throw new EtagMismatchError()
    return s
  }

  async list(p: ListParams): Promise<ListPage> {
    this.calls.push(`list ${JSON.stringify(p)}`)
    checkListParams(p)
    let rows: Stored[]
    if (p.syncToken) {
      const since = this.tokens.get(p.syncToken)
      if (since === undefined) throw new HttpError('http', 'HTTP 410: syncToken scaduto o sconosciuto', 410)
      rows = [...this.store.values()].filter((s) => s.seq > since)
    } else {
      rows = [...this.store.values()].filter((s) => !s.deleted)
      const min = p.timeMin ? Date.parse(p.timeMin) : -Infinity
      const max = p.timeMax ? Date.parse(p.timeMax) : Infinity
      rows = rows.filter((s) => timeOf(s.ev.end, this.tz) > min && timeOf(s.ev.start, this.tz) < max)
      if (p.privateExtendedProperty) {
        const [k, v] = p.privateExtendedProperty.split('=')
        rows = rows.filter((s) => s.ev.extendedProperties?.private?.[k] === v)
      }
      if (p.orderBy === 'startTime') rows.sort((a, b) => timeOf(a.ev.start, this.tz) - timeOf(b.ev.start, this.tz))
    }
    const size = Math.min(p.maxResults ?? this.pageSize, this.pageSize)
    const from = Number(p.pageToken ?? 0)
    const page = rows.slice(from, from + size)
    const more = from + size < rows.length
    const out: ListPage = { items: page.map((s) => structuredClone(s.ev)) }
    if (more) out.nextPageToken = String(from + size)
    // Come Google: il token arriva sull'ultima pagina, e solo senza filtri di finestra.
    else if (p.syncToken || !p.timeMin && !p.timeMax && !p.orderBy && !p.privateExtendedProperty) {
      const t = `fake-sync-${this.seq}-${this.tokens.size}`
      this.tokens.set(t, this.seq)
      out.nextSyncToken = t
    }
    return out
  }

  async get(id: string): Promise<GEvent> {
    this.calls.push(`get ${id}`)
    return structuredClone(this.live(id).ev)
  }

  async patch(id: string, body: EventBody, o?: WriteOpts): Promise<GEvent> {
    this.calls.push(`patch ${id}`)
    const { ev } = this.live(id, o?.ifMatch)
    const priv = body.extendedProperties?.private && { private: { ...ev.extendedProperties?.private, ...body.extendedProperties.private } }
    return this.save({ ...ev, ...structuredClone(body), ...(priv && { extendedProperties: { ...ev.extendedProperties, ...priv } }) })
  }

  async insert(body: EventBody): Promise<GEvent> {
    this.calls.push('insert')
    return this.save({ ...structuredClone(body), id: `fake${this.nextId++}`, status: 'confirmed' })
  }

  async delete(id: string, o?: WriteOpts): Promise<void> {
    this.calls.push(`delete ${id}`)
    const { ev } = this.live(id, o?.ifMatch)
    this.save({ id: ev.id }, true)
  }

  /** Simula una modifica fatta altrove (da un altro dispositivo o a mano): cambia l'etag. */
  touch(id: string, body: EventBody = {}): GEvent {
    return this.save({ ...this.live(id).ev, ...body })
  }

  /** Simula la scadenza dei syncToken (la prossima lettura incrementale riceve 410). */
  expireSyncTokens() {
    this.tokens.clear()
  }
}

let dev: FakeCalendar | null = null

/** Finto Calendar condiviso in sviluppo (si azzera ricaricando la pagina). */
export function devFakeCalendar(calendarId: string, timeZone: string, excluded: string[]): FakeCalendar {
  assertNotExcluded(calendarId, excluded)
  if (!dev || dev.calendarId !== calendarId) dev = new FakeCalendar({ calendarId, timeZone })
  return dev
}

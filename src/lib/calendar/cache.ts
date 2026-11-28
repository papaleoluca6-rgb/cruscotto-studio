import { db, type CalEvent, type CalSync } from '../../db/schema'
import { HttpError } from '../http'
import { DAY } from '../time'
import type { CalendarClient, GEvent, ListParams } from './api'
import { fromGoogle, reparse } from './parse'

// Cache del calendario di lavoro in `events` (docs/spec/03-calendar.md): lettura completa con syncToken, poi incrementali;
// ripiego a finestra se la lettura completa è troppo pesante. Si scrive tutto in una transazione: mai cache a metà.

/** Gli eventi finiti da più di così si tolgono; i futuri restano tutti. */
export const KEEP_PAST_MS = 7 * DAY
/** Oltre queste pagine (×2500 eventi) la lettura completa è troppo pesante: ripiego a finestra. */
export const MAX_FULL_PAGES = 4
export const PAGE_SIZE = 2500
/** Finestra del ripiego, in giorni da oggi. */
export const WINDOW_DAYS = { before: 7, after: 15 }
/** Nel ripiego a finestra si ritenta la lettura completa dopo questo tempo (servono anche gli eventi lontani, riga 06). */
export const RETRY_FULL_MS = 7 * DAY

export interface RefreshResult {
  mode: 'full' | 'incremental' | 'window'
  /** Eventi nuovi o cambiati arrivati da Calendar. */
  changed: number
  /** Eventi tolti dalla cache (cancellati su Calendar). */
  removed: number
  /** Eventi in cache dopo l'aggiornamento. */
  total: number
}

class TooHeavy extends Error {}

/** Tutte le pagine di una lettura; `maxPages` per fermare la lettura completa troppo pesante. */
async function readAll(client: CalendarClient, p: ListParams, maxPages = Infinity) {
  const items: GEvent[] = []
  let pageToken: string | undefined
  for (let pages = 1; ; pages++) {
    const r = await client.list({ ...p, maxResults: PAGE_SIZE, pageToken })
    items.push(...r.items)
    if (!r.nextPageToken) return { items, nextSyncToken: r.nextSyncToken }
    if (pages >= maxPages) throw new TooHeavy()
    pageToken = r.nextPageToken
  }
}

/** Stesso calendario, stessa fonte e stesso fuso (gli eventi di tutto il giorno dipendono dal fuso): si può proseguire. */
const sameSource = (s: CalSync | undefined, c: CalendarClient, tz: string): s is CalSync =>
  !!s && s.source === c.source && s.calendarId === c.calendarId && s.timeZone === tz

/**
 * Aggiorna la cache dal calendario di lavoro. Se fallisce lancia l'errore e la cache resta com'era.
 * Il calendario escluso è già rifiutato dal client.
 */
export async function refreshEvents(client: CalendarClient, tz: string, o: { now?: number; maxFullPages?: number } = {}): Promise<RefreshResult> {
  const now = o.now ?? Date.now()
  const state = await db.calSync.get('work')
  const known = sameSource(state, client, tz) ? state : undefined
  let mode: RefreshResult['mode']
  let read: { items: GEvent[]; nextSyncToken?: string }
  let fullTriedAt = known?.fullTriedAt

  const windowRead = () => readAll(client, {
    timeMin: new Date(now - WINDOW_DAYS.before * DAY).toISOString(),
    timeMax: new Date(now + WINDOW_DAYS.after * DAY).toISOString(),
    orderBy: 'startTime',
  })
  const fullRead = async () => {
    try {
      mode = 'full'
      fullTriedAt = now
      return await readAll(client, {}, o.maxFullPages ?? MAX_FULL_PAGES)
    } catch (e) {
      if (!(e instanceof TooHeavy)) throw e
      mode = 'window'
      return windowRead()
    }
  }

  if (known?.mode === 'sync' && known.syncToken) {
    try {
      mode = 'incremental'
      read = await readAll(client, { syncToken: known.syncToken })
    } catch (e) {
      // 410: token scaduto o non più valido, si scarta e si rilegge tutto.
      if (!(e instanceof HttpError && e.status === 410)) throw e
      read = await fullRead()
    }
  } else if (known?.mode === 'window' && now - (known.fullTriedAt ?? 0) < RETRY_FULL_MS) {
    mode = 'window'
    read = await windowRead()
  } else {
    read = await fullRead()
  }

  const result = { mode: mode!, changed: 0, removed: 0, total: 0 }
  const cutoff = now - KEEP_PAST_MS
  await db.transaction('rw', db.events, db.calSync, db.subjects, async () => {
    const subjects = await db.subjects.toArray()
    const replaceAll = result.mode !== 'incremental'
    if (replaceAll) await db.events.clear()
    else await db.events.where('calendarId').notEqual(client.calendarId).delete()
    const gone = read.items.filter((g) => g.status === 'cancelled').map((g) => g.id)
    const fresh = read.items.filter((g) => g.status !== 'cancelled').map((g) => fromGoogle(g, client.calendarId, subjects, tz))
    if (!replaceAll) result.removed = (await db.events.bulkGet(gone)).filter(Boolean).length
    await db.events.bulkDelete(gone)
    // Anche gli eventi spostati nel passato lontano: la potatura qui sotto toglie loro e la riga vecchia.
    await db.events.bulkPut(fresh)
    result.changed = fresh.filter((e) => e.end >= cutoff).length
    await db.events.where('start').below(cutoff).filter((e) => e.end < cutoff).delete()
    // Le materie possono essere cambiate dall'ultima lettura: si ricalcolano stato, materia e tipo di tutta la cache.
    const all = await db.events.toArray()
    await db.events.bulkPut(all.map((e): CalEvent => reparse(e, subjects)))
    result.total = all.length
    await db.calSync.put({
      key: 'work', source: client.source, calendarId: client.calendarId, timeZone: tz, lastSync: now, fullTriedAt,
      mode: result.mode === 'window' ? 'window' : 'sync',
      syncToken: result.mode === 'window' ? undefined : read.nextSyncToken,
    })
  })
  return result
}

/** Dimentica cache e token (passaggio finto ↔ vero, calendario cambiato o escluso). */
export async function clearEventCache(): Promise<void> {
  await db.transaction('rw', db.events, db.calSync, async () => {
    await db.events.clear()
    await db.calSync.clear()
  })
}

/**
 * Svuota la cache se viene da un calendario che non è più quello di lavoro o che è stato escluso:
 * quegli eventi non vanno più mostrati né usati. Vero se l'ha svuotata.
 */
export async function dropStaleCache(workId: string, excluded: string[]): Promise<boolean> {
  const s = await db.calSync.get('work')
  const stale = s ? s.calendarId !== workId || excluded.includes(s.calendarId) : (await db.events.count()) > 0
  if (stale) await clearEventCache()
  return stale
}

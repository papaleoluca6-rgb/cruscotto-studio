import { getJson, HttpError } from '../http'

const BASE = 'https://www.googleapis.com/calendar/v3'

/** Campi di un evento usati dall'app (Calendar API v3). Il parsing completo è in parse.ts (riga 03). */
export interface GEvent {
  id: string
  summary?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
}

/** Eventi di un calendario in un intervallo, ordinati per inizio, con orari nel fuso `timeZone`. */
export async function listEvents(token: string, calendarId: string, timeMin: Date, timeMax: Date, timeZone: string, maxResults = 50): Promise<GEvent[]> {
  const q = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    timeZone,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(maxResults),
  })
  const r = await getJson<{ items?: GEvent[] }>(`${BASE}/calendars/${encodeURIComponent(calendarId)}/events?${q}`, { Authorization: `Bearer ${token}` })
  return r.items ?? []
}

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
      return 'Calendario non trovato: controlla "Calendario di lavoro" in Impostazioni.'
    case 429:
      return 'Quota di Google superata: riprova tra qualche minuto.'
    default:
      return `Errore di Google Calendar: ${e.message}`
  }
}

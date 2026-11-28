import type { Id, SessionKind, SessionStatus } from './schema'

// Tipi delle tabelle `events` e `calSync` (definite in schema.ts): cache di Google Calendar, fuori da backup e sincronizzazione.

/** Tag dell'app negli eventi (extendedProperties.private con cruscotto = '1'); `materia` = prefisso o id. */
export interface AppTag { tipo?: string; materia?: string }

/**
 * Cache di un evento di Google Calendar (si rilegge da Calendar: fuori da backup e sincronizzazione). `id` di Google;
 * `etag` per If-Match nelle scritture (riga 04); `tag` così come arriva (per ricalcolare materia e tipo); `cleanTitle`
 * senza prefisso di stato; `appTag` = porta cruscotto=1; `start`/`end` in ms (tutto il giorno: mezzanotte nel fuso
 * utente); `updated` di Google (RFC 3339).
 */
export interface CalEvent {
  id: string
  calendarId: string
  etag: string
  tag?: AppTag
  title: string
  cleanTitle: string
  status: SessionStatus
  subjectId?: Id
  kind?: SessionKind
  appTag: boolean
  start: number
  end: number
  transparency: 'opaque' | 'transparent'
  allDay: boolean
  description: string
  updated: string
}

/**
 * Stato della lettura del calendario di lavoro (una riga, chiave 'work'; cache fuori da backup e sync).
 * `timeZone`: fuso degli orari in cache (se cambia si rilegge tutto). `mode`: 'sync' = lettura completa + incrementali
 * con `syncToken`; 'window' = ripiego a finestra (-7/+15 giorni) senza token, con nuova lettura completa tentata
 * 7 giorni dopo `fullTriedAt`. `lastSync`: ultimo aggiornamento riuscito (ms).
 */
export interface CalSync {
  key: 'work'
  source: 'google' | 'fake'
  calendarId: string
  timeZone: string
  syncToken?: string
  mode: 'sync' | 'window'
  lastSync: number
  fullTriedAt?: number
}

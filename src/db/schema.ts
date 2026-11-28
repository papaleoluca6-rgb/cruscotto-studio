import Dexie, { type EntityTable, type Table } from 'dexie'
import type { CalEvent, CalSync } from './calendarCache'

// Unico punto in cui è definito il modello dati (IndexedDB sul dispositivo).
// Ogni riga ha `id` UUID e `updatedAt` (ms) per la sincronizzazione (riga 12), tranne `events` (id di Google)
// e `settings` (chiave). Ogni cancellazione nelle tabelle sincronizzate scrive una lapide in `tombstones` (db/remove.ts).

export type Id = string
export const newId = (): Id => crypto.randomUUID()

/** Tipo di sessione di studio (vuoto = evento non di studio). Vedi docs/spec/formato-calendar.md. */
export type SessionKind = 'study' | 'review' | 'exercises' | 'simulazione' | 'pronto' | 'vocab'
/** Stato dal prefisso del titolo: nessuno, ✅ fatto, ◐ parziale, ↻ spostato, ✗ saltato. */
export type SessionStatus = 'todo' | 'done' | 'partial' | 'moved' | 'skipped'

export interface Setting {
  key: string
  value: unknown
  updatedAt: number
}

export interface Subject {
  id: Id
  name: string
  /** Inizio del titolo su Calendar, es. "Analisi 2" in "Analisi 2 Study: …". */
  prefix: string
  /** colorId di Google Calendar, "1"…"11". */
  colorId: string
  /** 0-5 */
  difficulty: number
  /** 0-5; 0 esclude la materia dalle quote. */
  importance: number
  /** Data dell'esame, "YYYY-MM-DD" nel fuso utente. */
  examDate?: string
  /** "Il prof è a": argomento a cui è arrivato il corso. */
  profAt?: string
  /** "Io sono a": argomento a cui sono arrivato io. */
  meAt?: string
  updatedAt: number
}

// Tipi della cache di Calendar (events, calSync) in calendarCache.ts; tabelle e versioni solo qui.
export type { AppTag, CalEvent, CalSync } from './calendarCache'

export type LogStatus = 'done' | 'partial' | 'skipped' | 'notDone' | 'moved'

/** Una riga per ogni volta che una sessione viene segnata o spostata. */
export interface LogEntry {
  id: Id
  eventId: string
  status: LogStatus
  /** 0-100, per le sessioni parziali. */
  percent?: number
  /** "Dove sono arrivato". */
  note?: string
  plannedStart: number
  plannedMin: number
  /** Minuti davvero studiati (correzione delle stime, riga 06). */
  actualMin?: number
  /** Nuovo inizio (ms) se spostata. */
  movedTo?: number
  reason?: string
  date: number
  updatedAt: number
}

/** Da fare / con soluzione / fatto da solo. */
export type ExerciseStatus = 'todo' | 'sol' | 'solo'

export interface Exercise {
  id: Id
  subjectId: Id
  name: string
  source: string
  topic: string
  status: ExerciseStatus
  order: number
  note: string
  updatedAt: number
}

/** Stato FSRS: 0 nuova, 1 in apprendimento, 2 in ripasso, 3 da reimparare. */
export type FsrsState = 0 | 1 | 2 | 3

/** Campi FSRS di una carta (nomi come nella libreria FSRS, riga 08). */
export interface FsrsFields {
  stability: number
  difficulty: number
  /** Prossimo ripasso, ms. */
  due: number
  reps: number
  lapses: number
  state: FsrsState
  /** Ultimo ripasso, ms. */
  last_review?: number
}

export interface Card extends FsrsFields {
  id: Id
  subjectId: Id
  question: string
  answer: string
  topic: string
  createdAt: number
  updatedAt: number
}

/** Un ripasso di una carta: solo in aggiunta, mai modificato. */
export interface RevlogEntry {
  id: Id
  cardId: Id
  date: number
  /** 1 di nuovo, 2 difficile, 3 bene, 4 facile. */
  rating: 1 | 2 | 3 | 4
  before: FsrsFields
  after: FsrsFields
  minutes: number
  updatedAt: number
}

export interface Tombstone {
  table: string
  id: string
  updatedAt: number
}

export interface Recalibration {
  id: Id
  date: number
  /** 'deterministic' oppure 'ai:<provider>'. */
  method: string
  /** Lista di operazioni proposte (tipo definito in lib/planner, riga 07). */
  proposal: unknown[]
  applied: boolean
  summary: string
  updatedAt: number
}

export const db = new Dexie('cruscotto-studio') as Dexie & {
  settings: EntityTable<Setting, 'key'>
  subjects: EntityTable<Subject, 'id'>
  events: EntityTable<CalEvent, 'id'>
  log: EntityTable<LogEntry, 'id'>
  exercises: EntityTable<Exercise, 'id'>
  cards: EntityTable<Card, 'id'>
  revlog: EntityTable<RevlogEntry, 'id'>
  tombstones: Table<Tombstone, [string, string]>
  recalibrations: EntityTable<Recalibration, 'id'>
  calSync: EntityTable<CalSync, 'key'>
}

// Per cambiare lo schema: aggiungere db.version(2) sotto, MAI modificare la versione 1.
db.version(1).stores({
  settings: 'key',
  subjects: 'id, name',
  events: 'id, start, subjectId, calendarId',
  log: 'id, eventId, date',
  exercises: 'id, subjectId, [subjectId+order]',
  cards: 'id, subjectId, due',
  revlog: 'id, cardId, date',
  tombstones: '[table+id], updatedAt',
  recalibrations: 'id, date',
})

// v2 (riga 03): stato della lettura di Calendar; cache eventi svuotata (le righe vecchie non hanno l'etag).
db.version(2).stores({ calSync: 'key' }).upgrade((tx) => tx.table('events').clear())

/** Tabelle sincronizzate: le cancellazioni lasciano una lapide. `events` è una cache e non ne fa parte. */
export const SYNCED_TABLES = ['settings', 'subjects', 'log', 'exercises', 'cards', 'revlog', 'recalibrations'] as const
export type SyncedTable = (typeof SYNCED_TABLES)[number]

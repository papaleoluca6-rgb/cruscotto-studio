import type { EventBody } from '../lib/calendar/api'
import type { LogStatus, SessionStatus } from './schema'

// Tipi della tabella `calQueue` (definita in schema.ts): scritture su Calendar confermate dall'utente e non ancora
// partite. Solo su questo dispositivo: fuori da backup e sincronizzazione (gli etag valgono solo con la sua cache).

/**
 * Riga 04: Fatto, Salta, Annulla segno. Riga 05: Non fatto (↻ + nuovi orari), Parziale (◐), sposta per imprevisto
 * (↻ + nuovi orari), inserimento di un evento nuovo (sessione "(resto)" o "Imprevisto: …").
 */
export type QueueAction = 'done' | 'skip' | 'undo' | 'notDone' | 'partial' | 'move' | 'insert'

/** Stato del titolo dopo l'azione (prefisso). 'insert': il titolo si invia così com'è, senza prefisso. */
export const ACTION_STATUS: Record<QueueAction, SessionStatus> = {
  done: 'done', skip: 'skipped', undo: 'todo', notDone: 'moved', partial: 'partial', move: 'moved', insert: 'todo',
}

/** Righe del registro che "segnano" una sessione: Fatto, Salta, Parziale e Annulla segno le sostituiscono o le tolgono. */
export const MARK_STATUSES: readonly LogStatus[] = ['done', 'skipped', 'partial']

/**
 * 'pending' = da inviare; 'conflict' = Google ha risposto 412: evento riletto, aspetta la riconferma dell'utente;
 * 'rejected' = non si può inviare (evento cancellato, calendario cambiato, richiesta rifiutata): resta finché l'utente la scarta.
 */
export type QueueState = 'pending' | 'conflict' | 'rejected'

/**
 * Un'azione confermata nell'anteprima. Al massimo una per evento: una nuova azione sullo stesso evento sostituisce
 * quella in attesa (vince l'ultima; nuovi orari ed `extra` di uno spostamento in attesa restano). Il registro (`log`)
 * si scrive solo dopo l'invio riuscito, nella stessa transazione che toglie l'azione dalla coda.
 */
export interface QueueOp {
  /** Ordine di invio (auto-incremento). */
  seq: number
  /** Id di Google. Per 'insert' è l'id scelto dall'app (esadecimale, 32 caratteri): un nuovo invio non crea doppioni. */
  eventId: string
  calendarId: string
  action: QueueAction
  /** etag atteso: header If-Match. Vuoto per 'insert'. */
  etag: string
  /** Titolo su Calendar quando l'utente ha confermato (vuoto per 'insert'), e titolo che si invia. */
  fromTitle: string
  toTitle: string
  /** Minuti davvero studiati (Fatto, Parziale). */
  actualMin?: number
  plannedStart: number
  plannedMin: number
  /** Nuovi orari (ms): Non fatto, sposta, insert. */
  toStart?: number
  toEnd?: number
  /** Altri campi da inviare (tag dell'app, promemoria, descrizione, colore). Mai `summary`, `start`, `end`. */
  extra?: EventBody
  /** Parziale: percentuale fatta (25/50/75) e "dove sono arrivato". */
  percent?: number
  note?: string
  /** Sposta: motivo per il registro, es. "Imprevisto: dentista". */
  reason?: string
  /** 'insert' del resto di un Parziale: id della sessione d'origine. Non parte finché l'azione d'origine è in coda. */
  linkedTo?: string
  /** Quando l'utente ha confermato l'ultima azione (ms): è la `date` della riga del registro. */
  createdAt: number
  /** Cresce a ogni sostituzione: un invio già partito con un `rev` vecchio non scrive il registro. */
  rev: number
  state: QueueState
  /** Ultimo errore di invio, già in italiano. */
  lastError?: string
}

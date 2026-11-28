import type { LogStatus, SessionStatus } from './schema'

// Tipi della tabella `calQueue` (definita in schema.ts): scritture su Calendar confermate dall'utente e non ancora
// partite. Solo su questo dispositivo: fuori da backup e sincronizzazione (gli etag valgono solo con la sua cache).

/** Azioni della riga 04. Le righe 05 e 07 ne aggiungono altre qui (Non fatto, Parziale, sposta…). */
export type QueueAction = 'done' | 'skip' | 'undo'

/** Stato del titolo dopo l'azione: Fatto → ✅, Salta → ✗, Annulla segno → nessun prefisso. */
export const ACTION_STATUS: Record<QueueAction, SessionStatus> = { done: 'done', skip: 'skipped', undo: 'todo' }

/** Righe del registro che "segnano" una sessione: Fatto, Salta e Annulla segno le sostituiscono o le tolgono. */
export const MARK_STATUSES: readonly LogStatus[] = ['done', 'skipped', 'partial']

/**
 * 'pending' = da inviare; 'conflict' = Google ha risposto 412: evento riletto, aspetta la riconferma dell'utente;
 * 'rejected' = non si può inviare (evento cancellato, calendario cambiato, richiesta rifiutata): resta finché l'utente la scarta.
 */
export type QueueState = 'pending' | 'conflict' | 'rejected'

/**
 * Un'azione confermata nell'anteprima. Al massimo una per evento: una nuova azione sullo stesso evento sostituisce
 * quella in attesa (vince l'ultima). Il registro (`log`) si scrive solo dopo l'invio riuscito, nella stessa transazione
 * che toglie l'azione dalla coda.
 */
export interface QueueOp {
  /** Ordine di invio (auto-incremento). */
  seq: number
  eventId: string
  calendarId: string
  action: QueueAction
  /** etag atteso: header If-Match. */
  etag: string
  /** Titolo su Calendar quando l'utente ha confermato, e titolo che si invia. */
  fromTitle: string
  toTitle: string
  /** Minuti davvero studiati (solo Fatto). */
  actualMin?: number
  plannedStart: number
  plannedMin: number
  /** Quando l'utente ha confermato l'ultima azione (ms): è la `date` della riga del registro. */
  createdAt: number
  /** Cresce a ogni sostituzione: un invio già partito con un `rev` vecchio non scrive il registro. */
  rev: number
  state: QueueState
  /** Ultimo errore di invio, già in italiano. */
  lastError?: string
}

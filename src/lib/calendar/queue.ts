import { db, type CalEvent, type QueueAction, type QueueOp, type QueueState } from '../../db/schema'
import { assertWritable, nextTitle, stripStatus } from './parse'

// Coda delle scritture su Calendar (docs/spec/04-oggi.md, .ai/lotti/04/01-SCELTE.md): l'utente conferma l'anteprima,
// l'azione si salva qui e parte quando c'è rete (flush.ts). La usano anche le righe 05 e 07.
// Firme e tipi fissati da Opus (piano 04-01): si scrivono solo i corpi.

export { flushQueue } from './flush'

/** Evento della cache con l'eventuale azione in coda: se è 'pending', titolo e stato sono già quelli nuovi. */
export type ViewEvent = CalEvent & { queued?: QueueOp }

/** Esito di un invio della coda: riepilogo esatto di cosa è partito e cosa no. */
export interface FlushResult {
  /** Inviate a Calendar (titolo nuovo scritto), nell'ordine di invio. */
  sent: QueueOp[]
  /** Passate a 'conflict' in questo invio (412: evento cambiato, riletto, da riconfermare). */
  conflicts: QueueOp[]
  /** Passate a 'rejected' in questo invio (evento cancellato, calendario cambiato, richiesta rifiutata). */
  rejected: QueueOp[]
  /** Azioni 'pending' rimaste in coda alla fine (non tentate, fermate da un errore, o arrivate durante l'invio). */
  left: number
  /** Motivo per cui l'invio si è fermato (VPN, token, quota…), già in italiano. */
  error?: string
  /** Google ha risposto 401: serve un nuovo accesso. */
  needsLogin: boolean
}

export interface EnqueueOpts {
  workId: string
  excluded: string[]
  /** Minuti reali: obbligatori per 'done', intero 1-600. */
  actualMin?: number
  now?: number
}

/** Minuti reali accettati per Fatto. */
export const ACTUAL_MIN = { min: 1, max: 600 } as const

/**
 * Salva un'azione confermata nell'anteprima (non scrive su Calendar né sul registro).
 * Lancia un errore con il motivo se l'evento non si può scrivere, se l'azione non vale per il suo stato,
 * se c'è già un'azione da rivedere sullo stesso evento o se i minuti non sono validi.
 */
export async function enqueue(ev: CalEvent, action: QueueAction, o: EnqueueOpts): Promise<QueueOp> {
  return db.transaction('rw', db.calQueue, async () => {
    assertWritable(ev, o.workId, o.excluded)
    const existing = await db.calQueue.where('eventId').equals(ev.id).first()
    if (existing && existing.state !== 'pending') throw new Error("Questa sessione ha un'azione da rivedere nella coda: risolvila prima.")
    const status = existing ? stripStatus(existing.toTitle).status : ev.status
    const marked = status !== 'todo' && status !== 'moved'
    if (action !== 'undo' && marked) throw new Error('Questa sessione è già segnata: prima annulla il segno.')
    if (action === 'undo' && !marked) throw new Error('Questa sessione non ha un segno da annullare.')
    const min = o.actualMin
    if (action === 'done' && !(min !== undefined && Number.isInteger(min) && min >= ACTUAL_MIN.min && min <= ACTUAL_MIN.max)) {
      throw new Error('Minuti non validi: scrivi un numero intero tra 1 e 600.')
    }
    const now = o.now ?? Date.now()
    const actual = action === 'done' ? { actualMin: min } : {}
    if (existing) {
      // Vince l'ultima azione: stesso posto in coda, stesso etag e stesso titolo di partenza.
      const next: QueueOp = { ...existing, action, toTitle: nextTitle(existing.fromTitle, action), createdAt: now, rev: existing.rev + 1 }
      delete next.actualMin
      delete next.lastError
      Object.assign(next, actual)
      await db.calQueue.put(next)
      return next
    }
    const row: Omit<QueueOp, 'seq'> = {
      eventId: ev.id, calendarId: ev.calendarId, action, etag: ev.etag, fromTitle: ev.title, toTitle: nextTitle(ev.title, action),
      ...actual, plannedStart: ev.start, plannedMin: Math.round((ev.end - ev.start) / 60_000), createdAt: now, rev: 0, state: 'pending',
    }
    const seq = (await db.calQueue.add({ ...row } as QueueOp)) as number
    return { ...row, seq }
  })
}

/** L'utente ha riconfermato un'azione in 'conflict': torna 'pending' (con l'etag e il titolo riletti). */
export async function confirmConflict(seq: number): Promise<void> {
  await db.transaction('rw', db.calQueue, async () => {
    const op = await db.calQueue.get(seq)
    if (op?.state !== 'conflict') throw new Error('Questa azione non è da riconfermare.')
    const next: QueueOp = { ...op, state: 'pending' }
    delete next.lastError
    await db.calQueue.put(next)
  })
}

/** Toglie un'azione dalla coda senza inviarla (nessun effetto su Calendar né sul registro). */
export async function discard(seq: number): Promise<void> {
  await db.calQueue.delete(seq)
}

/** Applica alla cache le azioni in coda (stesso ordine degli eventi). */
export function withPending(events: CalEvent[], ops: QueueOp[]): ViewEvent[] {
  const byEvent = new Map(ops.map((op) => [op.eventId, op]))
  return events.map((ev) => {
    const op = byEvent.get(ev.id)
    if (!op) return ev
    if (op.state !== 'pending') return { ...ev, queued: op }
    const { status, clean } = stripStatus(op.toTitle)
    return { ...ev, title: op.toTitle, status, cleanTitle: clean, queued: op }
  })
}

/** Riepilogo in italiano di un invio (conteggi; i titoli li elenca la UI). */
export function describeFlush(r: FlushResult): string {
  const counts: [string, number][] = [
    ['Inviate a Calendar', r.sent.length],
    ['Da riconfermare (cambiate su Calendar)', r.conflicts.length],
    ['Non inviate', r.rejected.length],
    ['Ancora in coda', r.left],
  ]
  const parts = counts.filter(([, n]) => n > 0).map(([label, n]) => `${label}: ${n}.`)
  if (r.error) parts.push(r.error)
  return parts.join(' ') || 'Nessuna azione da inviare.'
}

/** Etichetta breve di uno stato della coda, per i badge. */
export const QUEUE_LABEL: Record<QueueState, string> = { pending: 'In coda', conflict: 'Da rivedere', rejected: 'Non inviata' }

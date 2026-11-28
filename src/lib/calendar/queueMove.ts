import { db, type CalEvent, type QueueAction, type QueueOp, type Subject } from '../../db/schema'
import { MINUTE } from '../time'
import { PARTIAL_PERCENTS, restoDescription, restoTitle, type PartialPercent } from '../planner/moves'
import type { Interval } from '../planner/findSlot'
import { studyFields, type EventBody } from './api'
import { assertWritable, nextTitle, stripStatus } from './parse'
import { ACTUAL_MIN, type EnqueueOpts } from './queue'

// Azioni della riga 05 nella coda (docs/spec/05-sposta.md, .ai/plans/05-comune.md §Coda). Firme fissate da Opus:
// si scrivono solo i corpi. Niente scritture su Calendar qui: partono con flushQueue (flush.ts).

const newId = (o: MoveOpts) => o.newEventId?.() ?? crypto.randomUUID().replace(/-/g, '')
const BAD_TIMES = "Orari non validi: la fine deve venire dopo l'inizio."
const subjectOf = (ev: CalEvent, o: MoveOpts) => o.subjects.find((s) => s.id === ev.subjectId)
const studyOf = (ev: CalEvent, o: MoveOpts): EventBody => studyFields(ev.kind!, subjectOf(ev, o)?.prefix ?? ev.tag?.materia ?? '', o.reminderMin)

/** Dentro una transazione: stesse regole di enqueue; sostituisce un'azione in attesa (S7) o aggiunge la riga. */
async function prepare(ev: CalEvent, action: QueueAction, o: MoveOpts, patch: Partial<QueueOp>): Promise<QueueOp> {
  assertWritable(ev, o.workId, o.excluded)
  const existing = await db.calQueue.where('eventId').equals(ev.id).first()
  if (existing && existing.state !== 'pending') throw new Error("Questa sessione ha un'azione da rivedere nella coda: risolvila prima.")
  const status = existing ? stripStatus(existing.toTitle).status : ev.status
  if (status !== 'todo' && status !== 'moved') throw new Error('Questa sessione è già segnata: prima annulla il segno.')
  const now = o.now ?? Date.now()
  if (existing) {
    const next: QueueOp = { ...existing, action, toTitle: nextTitle(existing.fromTitle, action), createdAt: now, rev: existing.rev + 1 }
    for (const k of ['actualMin', 'lastError', 'percent', 'note', 'reason'] as const) delete next[k]
    Object.assign(next, patch)
    await db.calQueue.put(next)
    return next
  }
  const row: Omit<QueueOp, 'seq'> = {
    eventId: ev.id, calendarId: ev.calendarId, action, etag: ev.etag, fromTitle: ev.title, toTitle: nextTitle(ev.title, action),
    ...patch, plannedStart: ev.start, plannedMin: Math.round((ev.end - ev.start) / MINUTE), createdAt: now, rev: 0, state: 'pending',
  }
  return { ...row, seq: (await db.calQueue.add({ ...row } as QueueOp)) as number }
}

/** Dentro una transazione: evento nuovo con id dell'app, inviato così com'è (senza prefisso di stato). */
async function addInsert(title: string, at: Interval, calendarId: string, extra: EventBody, o: MoveOpts, linkedTo?: string): Promise<QueueOp> {
  if (!(at.end > at.start)) throw new Error(BAD_TIMES)
  const row: Omit<QueueOp, 'seq'> = {
    eventId: newId(o), calendarId, action: 'insert', etag: '', fromTitle: '', toTitle: title, plannedStart: at.start,
    plannedMin: Math.round((at.end - at.start) / MINUTE), toStart: at.start, toEnd: at.end, extra, ...(linkedTo && { linkedTo }),
    createdAt: o.now ?? Date.now(), rev: 0, state: 'pending',
  }
  return { ...row, seq: (await db.calQueue.add({ ...row } as QueueOp)) as number }
}

export interface MoveOpts extends EnqueueOpts {
  /** Minuti del promemoria popup (impostazione reminder.popupMin). */
  reminderMin: number
  /** Materie: prefisso per il tag `materia`, colore per gli eventi nuovi. */
  subjects: Pick<Subject, 'id' | 'prefix' | 'colorId'>[]
  /** Id per gli eventi nuovi (test); default: crypto.randomUUID() senza trattini. */
  newEventId?: () => string
}

/**
 * Non fatto: ↻ nel titolo, nuovi orari `slot`, tag dell'app e promemoria (`extra` = studyFields). Dopo l'invio,
 * registro 'notDone' con movedTo = slot.start. Stesse regole di enqueue (scrivibile, non segnata, niente azione da
 * rivedere); se c'è un'azione 'pending' sullo stesso evento la sostituisce (stesso seq, rev + 1).
 */
export async function enqueueNotDone(ev: CalEvent, slot: Interval, o: MoveOpts): Promise<QueueOp> {
  if (!(slot.end > slot.start)) throw new Error(BAD_TIMES)
  return db.transaction('rw', db.calQueue, () => prepare(ev, 'notDone', o, { toStart: slot.start, toEnd: slot.end, extra: studyOf(ev, o) }))
}

export interface PartialInput {
  percent: PartialPercent
  /** "Dove sono arrivato": obbligatoria (non vuota dopo trim). */
  note: string
  /** Minuti reali: intero 1-600. */
  actualMin: number
  /** Orario del resto (findSlot con restoMinutes). */
  resto: Interval
}

/**
 * Parziale, in una sola transazione: azione 'partial' sull'evento (◐; registro 'partial' con percent, note, actualMin
 * dopo l'invio) + 'insert' del resto (titolo restoTitle, descrizione restoDescription, studyFields, colore della
 * materia, linkedTo = ev.id). Restituisce [partial, insert]. Nessuna delle due se una non è valida.
 */
export async function enqueuePartial(ev: CalEvent, p: PartialInput, o: MoveOpts): Promise<QueueOp[]> {
  if (!PARTIAL_PERCENTS.includes(p.percent)) throw new Error('Percentuale non valida: 25, 50 o 75.')
  const note = p.note.trim()
  if (!note) throw new Error('Scrivi dove sei arrivato.')
  if (!Number.isInteger(p.actualMin) || p.actualMin < ACTUAL_MIN.min || p.actualMin > ACTUAL_MIN.max) {
    throw new Error('Minuti non validi: scrivi un numero intero tra 1 e 600.')
  }
  return db.transaction('rw', db.calQueue, async () => {
    const partial = await prepare(ev, 'partial', o, { percent: p.percent, note, actualMin: p.actualMin })
    const color = subjectOf(ev, o)?.colorId
    const extra: EventBody = { ...studyOf(ev, o), description: restoDescription(ev.description, note), ...(color && { colorId: color }) }
    const resto = await addInsert(restoTitle(stripStatus(ev.title).clean), p.resto, ev.calendarId, extra, o, ev.id)
    return [partial, resto]
  })
}

export interface ImprevistoInput {
  /** "Cosa": titolo dopo "Imprevisto: " (non vuoto dopo trim). */
  what: string
  start: number
  end: number
  /** Sessioni da spostare con il nuovo orario (solo quelle con slot di planImprevisto). */
  moves: { ev: CalEvent; slot: Interval }[]
}

/**
 * Imprevisto, in una sola transazione (o tutte in coda o nessuna): 'insert' dell'evento "Imprevisto: <cosa>"
 * (extendedProperties.private { cruscotto: 'imprevisto' }, che non lo rende una sessione) e poi un 'move' per ogni
 * sessione (↻, nuovi orari, studyFields; registro 'moved' con movedTo e reason "Imprevisto: <cosa>" dopo l'invio).
 * Restituisce le azioni nell'ordine di invio.
 */
export async function enqueueImprevisto(i: ImprevistoInput, o: MoveOpts): Promise<QueueOp[]> {
  const what = i.what.trim()
  if (!what) throw new Error('Scrivi cosa è successo.')
  if (!(i.end > i.start)) throw new Error(BAD_TIMES)
  if (i.end <= (o.now ?? Date.now())) throw new Error("L'imprevisto è già finito.")
  const reason = `Imprevisto: ${what}`
  return db.transaction('rw', db.calQueue, async () => {
    const ops = [await addInsert(reason, i, o.workId, { extendedProperties: { private: { cruscotto: 'imprevisto' } } }, o)]
    for (const { ev, slot } of i.moves) {
      if (!(slot.end > slot.start)) throw new Error(BAD_TIMES)
      ops.push(await prepare(ev, 'move', o, { toStart: slot.start, toEnd: slot.end, extra: studyOf(ev, o), reason }))
    }
    return ops
  })
}

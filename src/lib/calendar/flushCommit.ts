import { MARK_STATUSES } from '../../db/calQueue'
import { db, newId, type LogEntry, type QueueOp, type Subject } from '../../db/schema'
import type { GEvent } from './api'
import { fromGoogle } from './parse'

// Registro dopo un invio riuscito (scelta S10 di .ai/plans/05-comune.md). Esportato solo per flush.ts.

export interface CommitCtx { now: number; tz: string; subjects: Subject[] }

/** Azioni che sostituiscono i segni (Fatto, Salta, Parziale) o li tolgono (Annulla segno). */
const REPLACES_MARKS = new Set(['done', 'skip', 'undo', 'partial'])

/** Riga del registro per l'azione inviata (nessuna per 'undo' e 'insert'). */
function logRow(op: QueueOp, now: number): LogEntry | undefined {
  const base = { id: newId(), eventId: op.eventId, plannedStart: op.plannedStart, plannedMin: op.plannedMin, date: op.createdAt, updatedAt: now }
  switch (op.action) {
    case 'done':
      return { ...base, status: 'done', actualMin: op.actualMin }
    case 'skip':
      return { ...base, status: 'skipped' }
    case 'partial':
      return { ...base, status: 'partial', percent: op.percent, note: op.note, actualMin: op.actualMin }
    case 'notDone':
      return { ...base, status: 'notDone', movedTo: op.toStart }
    case 'move':
      return { ...base, status: 'moved', movedTo: op.toStart, reason: op.reason }
    default:
      return undefined
  }
}

/** Dopo un invio riuscito: cache, registro e coda nella stessa transazione. */
export async function commit(op: QueueOp, resp: GEvent, ctx: CommitCtx) {
  await db.transaction('rw', db.calQueue, db.events, db.log, db.tombstones, async () => {
    await db.events.put(fromGoogle(resp, op.calendarId, ctx.subjects, ctx.tz))
    const cur = await db.calQueue.get(op.seq)
    // Sostituita durante l'invio: resta in coda con l'etag nuovo, il registro lo scriverà il prossimo invio.
    if (cur && cur.rev !== op.rev) {
      await db.calQueue.put({ ...cur, etag: resp.etag ?? '', fromTitle: resp.summary ?? '' })
      return
    }
    if (REPLACES_MARKS.has(op.action)) {
      const marks = await db.log.where('eventId').equals(op.eventId).filter((l) => MARK_STATUSES.includes(l.status)).toArray()
      const old = marks.map((l) => l.id)
      await db.log.bulkDelete(old)
      await db.tombstones.bulkPut(old.map((id) => ({ table: 'log', id, updatedAt: ctx.now })))
    }
    const row = logRow(op, ctx.now)
    if (row) await db.log.add(row)
    await db.calQueue.delete(op.seq)
  })
}

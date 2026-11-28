import { MARK_STATUSES } from '../../db/calQueue'
import { db, newId, type QueueOp, type Subject } from '../../db/schema'
import { HttpError } from '../http'
import { calendarErrorMessage, type CalendarClient, type GEvent } from './api'
import { fromGoogle, nextTitle } from './parse'
import type { FlushResult } from './queue'

// Invio della coda (docs/spec/04-oggi.md §Coda offline, .ai/lotti/04/01-SCELTE.md §Invio). Firma fissata da Opus
// (piano 04-01): si scrive solo il corpo, con le funzioni interne che servono, restando sotto le 200 righe.

export interface FlushOpts {
  client: CalendarClient
  /** Fuso utente: serve a fromGoogle per la riga della cache. */
  tz: string
  now?: number
}

/**
 * Invia in ordine le azioni 'pending' con If-Match. Un solo invio alla volta: una seconda chiamata durante un invio
 * riceve la stessa promessa. Non lancia errori: tutto finisce nel FlushResult.
 */
export async function flushQueue(o: FlushOpts): Promise<FlushResult> {
  running ??= run(o).finally(() => { running = null })
  return running
}

let running: Promise<FlushResult> | null = null

interface Ctx extends FlushOpts { now: number; subjects: Subject[]; result: FlushResult }

const statusOf = (e: unknown) => (e instanceof HttpError ? e.status : undefined)
const isGone = (e: unknown) => statusOf(e) === 404 || statusOf(e) === 410
/** 4xx che non dipendono da rete, accesso o quota: ritentare non serve. */
const isRefused = (e: unknown) => {
  const s = statusOf(e)
  return s !== undefined && s >= 400 && s < 500 && ![401, 403, 408, 429].includes(s)
}

async function run(o: FlushOpts): Promise<FlushResult> {
  const result: FlushResult = { sent: [], conflicts: [], rejected: [], left: 0, needsLogin: false }
  try {
    const ctx: Ctx = { ...o, now: o.now ?? Date.now(), subjects: await db.subjects.toArray(), result }
    const todo = (await db.calQueue.orderBy('seq').toArray()).filter((x) => x.state === 'pending')
    for (const op of todo) if (!(await send(op, ctx))) break
  } catch (e) {
    result.error = calendarErrorMessage(e)
  }
  try {
    result.left = (await db.calQueue.toArray()).filter((x) => x.state === 'pending').length
  } catch (e) {
    result.error ??= calendarErrorMessage(e)
  }
  return result
}

/**
 * Modifica l'azione dopo un invio non riuscito e restituisce la riga salvata. Se intanto è stata sostituita o tolta
 * non la tocca: se ne occupa il prossimo invio.
 */
async function mark(op: QueueOp, changes: Partial<QueueOp>): Promise<QueueOp | undefined> {
  return db.transaction('rw', db.calQueue, async () => {
    const cur = await db.calQueue.get(op.seq)
    if (!cur || cur.rev !== op.rev) return undefined
    const next = { ...cur, ...changes }
    await db.calQueue.put(next)
    return next
  })
}

async function reject(op: QueueOp, lastError: string, ctx: Ctx) {
  const row = await mark(op, { state: 'rejected', lastError })
  if (row) ctx.result.rejected.push(row)
}

async function gone(op: QueueOp, ctx: Ctx) {
  await db.events.delete(op.eventId)
  await reject(op, 'Evento cancellato su Calendar: azione non inviata.', ctx)
}

/** Ferma l'invio con il motivo. */
function stop(e: unknown, ctx: Ctx): false {
  ctx.result.error = calendarErrorMessage(e)
  ctx.result.needsLogin = statusOf(e) === 401
  return false
}

/** Invia un'azione; false = fermare l'invio. */
async function send(snap: QueueOp, ctx: Ctx): Promise<boolean> {
  // Riga riletta prima di ogni invio: scartata o sostituita mentre partivano le precedenti (Domanda 2).
  const op = await db.calQueue.get(snap.seq)
  if (!op || op.state !== 'pending') return true
  if (op.calendarId !== ctx.client.calendarId) {
    await reject(op, 'Calendario di lavoro cambiato: azione non inviata.', ctx)
    return true
  }
  let resp: GEvent
  try {
    resp = await ctx.client.patch(op.eventId, { summary: op.toTitle }, { ifMatch: op.etag || undefined })
  } catch (e) {
    if (statusOf(e) === 412) return reread(op, ctx)
    if (isGone(e)) await gone(op, ctx)
    else if (isRefused(e)) await reject(op, calendarErrorMessage(e), ctx)
    else {
      await mark(op, { lastError: calendarErrorMessage(e) })
      return stop(e, ctx)
    }
    return true
  }
  try {
    await commit(op, resp, ctx)
  } catch {
    ctx.result.error = 'Inviata a Calendar ma non salvata qui: tocca Aggiorna.'
    return false
  }
  ctx.result.sent.push(op)
  return true
}

/** Dopo un PATCH riuscito: cache, registro e coda nella stessa transazione. */
async function commit(op: QueueOp, resp: GEvent, ctx: Ctx) {
  await db.transaction('rw', db.calQueue, db.events, db.log, db.tombstones, async () => {
    await db.events.put(fromGoogle(resp, op.calendarId, ctx.subjects, ctx.tz))
    const cur = await db.calQueue.get(op.seq)
    // Sostituita durante l'invio: resta in coda con l'etag nuovo, il registro lo scriverà il prossimo invio.
    if (cur && cur.rev !== op.rev) {
      await db.calQueue.put({ ...cur, etag: resp.etag ?? '', fromTitle: resp.summary ?? '' })
      return
    }
    const marks = await db.log.where('eventId').equals(op.eventId).filter((l) => MARK_STATUSES.includes(l.status)).toArray()
    const old = marks.map((l) => l.id)
    await db.log.bulkDelete(old)
    await db.tombstones.bulkPut(old.map((id) => ({ table: 'log', id, updatedAt: ctx.now })))
    if (op.action !== 'undo') {
      await db.log.add({
        id: newId(), eventId: op.eventId, status: op.action === 'done' ? 'done' : 'skipped', plannedStart: op.plannedStart,
        plannedMin: op.plannedMin, ...(op.action === 'done' && { actualMin: op.actualMin }), date: op.createdAt, updatedAt: ctx.now,
      })
    }
    await db.calQueue.delete(op.seq)
  })
}

/** 412: rilegge l'evento; se è ancora una sessione di studio l'azione aspetta la riconferma. */
async function reread(op: QueueOp, ctx: Ctx): Promise<boolean> {
  let g: GEvent
  try {
    g = await ctx.client.get(op.eventId)
  } catch (e) {
    if (isGone(e)) {
      await gone(op, ctx)
      return true
    }
    const row = await mark(op, { state: 'conflict', lastError: calendarErrorMessage(e) })
    if (row) ctx.result.conflicts.push(row)
    return stop(e, ctx)
  }
  if (g.status === 'cancelled') {
    await gone(op, ctx)
    return true
  }
  const ev = fromGoogle(g, op.calendarId, ctx.subjects, ctx.tz)
  await db.events.put(ev)
  if (ev.kind === undefined) {
    await reject(op, 'Non è più una sessione di studio: azione non inviata.', ctx)
    return true
  }
  const row = await mark(op, {
    state: 'conflict', etag: g.etag ?? '', fromTitle: g.summary ?? '', toTitle: nextTitle(g.summary ?? '', op.action),
    lastError: 'Evento cambiato su Calendar: controlla il nuovo titolo e conferma.',
  })
  if (row) ctx.result.conflicts.push(row)
  return true
}

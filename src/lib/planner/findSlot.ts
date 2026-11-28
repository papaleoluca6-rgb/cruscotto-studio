import type { CalEvent, QueueOp } from '../../db/schema'
import { addDays, MINUTE, todayIn, zonedToMs } from '../time'

// Primo spazio libero per una sessione (docs/spec/05-sposta.md). Funzione pura: niente database, niente Date.now().
// Firme fissate da Opus (riga 05): si scrivono solo i corpi.

/** Intervallo [start, end) in ms. */
export interface Interval { start: number; end: number }

export interface SlotOpts {
  /** Adesso (ms). La ricerca parte da `from + leadMin`, arrotondato per eccesso al multiplo di `stepMin` (in ms dall'epoca). */
  from: number
  /** Fuso utente: finestra e giorni si contano sull'orologio di questo fuso. */
  tz: string
  /** Finestra di studio "HH:MM": la sessione deve stare tutta dentro (fine = windowEnd ammessa). */
  windowStart: string
  windowEnd: string
  /** Minuti liberi prima e dopo ogni intervallo occupato. */
  marginMin: number
  /** Giorni di calendario cercati, a partire dal giorno di `from + leadMin` compreso. Default 12. */
  days?: number
  /** Passo dei candidati in minuti. Default 15. */
  stepMin?: number
  /** Anticipo minimo da adesso in minuti. Default 20. */
  leadMin?: number
}

export const SLOT_DEFAULTS = { days: 12, stepMin: 15, leadMin: 20 } as const

/**
 * Primo intervallo di `durationMin` minuti che inizia su un multiplo di `stepMin`, dentro la finestra di studio di un
 * giorno, e non tocca nessun intervallo di `busy` allargato di `marginMin` per parte (toccare il bordo allargato va bene).
 * null se non c'è entro `days` giorni o se la durata non entra nella finestra.
 */
export function findSlot(busy: Interval[], durationMin: number, o: SlotOpts): Interval | null {
  const step = (o.stepMin ?? SLOT_DEFAULTS.stepMin) * MINUTE
  const lead = (o.leadMin ?? SLOT_DEFAULTS.leadMin) * MINUTE
  const days = o.days ?? SLOT_DEFAULTS.days
  const dur = durationMin * MINUTE
  const margin = o.marginMin * MINUTE
  const first = Math.ceil((o.from + lead) / step) * step
  const day0 = todayIn(o.tz, new Date(first))
  for (let i = 0; i < days; i++) {
    const d = addDays(day0, i)
    const ws = zonedToMs(d, o.windowStart, o.tz)
    const we = zonedToMs(d, o.windowEnd, o.tz)
    for (let s = Math.max(first, Math.ceil(ws / step) * step); s + dur <= we; s += step) {
      if (!busy.some((b) => s < b.end + margin && s + dur > b.start - margin)) return { start: s, end: s + dur }
    }
  }
  return null
}

/**
 * Intervalli occupati: eventi con orario (non tutto il giorno) e disponibilità "occupato" (non 'transparent'), tranne
 * gli id in `skipIds` (le sessioni che si stanno spostando); più gli 'insert' in coda 'pending' (toStart-toEnd).
 * Gli eventi arrivano già con gli spostamenti in coda applicati (withPending).
 */
export function busyFrom(
  events: Pick<CalEvent, 'id' | 'start' | 'end' | 'allDay' | 'transparency'>[],
  ops: Pick<QueueOp, 'action' | 'state' | 'toStart' | 'toEnd'>[],
  skipIds: string[] = [],
): Interval[] {
  const out: Interval[] = events
    .filter((e) => !e.allDay && e.transparency !== 'transparent' && !skipIds.includes(e.id))
    .map((e) => ({ start: e.start, end: e.end }))
  for (const op of ops) {
    if (op.action === 'insert' && op.state === 'pending' && op.toStart !== undefined && op.toEnd !== undefined) {
      out.push({ start: op.toStart, end: op.toEnd })
    }
  }
  return out
}

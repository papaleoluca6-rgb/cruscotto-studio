import type { CalEvent, LogEntry, QueueAction, Subject } from '../../db/schema'
import { needsMarking } from '../../lib/calendar/parse'
import type { ViewEvent } from '../../lib/calendar/queue'
import { addDays, DAY, todayIn } from '../../lib/time'

// Logica pura della scheda Oggi (docs/spec/04-oggi.md, .ai/lotti/04/01-SCELTE.md §Liste e §Riepilogo).
// Firme fissate da Opus (piano 04-02): si scrivono solo i corpi.

export interface Groups {
  /** Da segnare: needsMarking, finite negli ultimi 7 giorni; dalla più vecchia. */
  toMark: ViewEvent[]
  /** Oggi, tranne quelle in toMark; per inizio. */
  today: ViewEvent[]
  tomorrow: ViewEvent[]
  /** Da dopodomani a 7 giorni da oggi compreso; per inizio. */
  next: ViewEvent[]
  /** Giorni prima di oggi (ultimi 7), solo già segnate (non todo/moved); dalla più recente. */
  past: ViewEvent[]
}

const dayOf = (ms: number, tz: string) => todayIn(tz, new Date(ms))

/** Solo sessioni di studio (kind definito), divise per lista con il giorno di inizio nel fuso utente. */
export function groupSessions(events: ViewEvent[], now: number, tz: string): Groups {
  const t = dayOf(now, tz)
  const [tomorrow, from, to, oldest] = [addDays(t, 1), addDays(t, 2), addDays(t, 7), addDays(t, -7)]
  const g: Groups = { toMark: [], today: [], tomorrow: [], next: [], past: [] }
  for (const e of events.filter((x) => x.kind !== undefined).sort((a, b) => a.start - b.start)) {
    const d = dayOf(e.start, tz)
    if (needsMarking(e, now) && e.end >= now - 7 * DAY) g.toMark.push(e)
    else if (d === t) g.today.push(e)
    else if (d === tomorrow) g.tomorrow.push(e)
    else if (d >= from && d <= to) g.next.push(e)
    // Solo già segnate: una non segnata finita da più di 7 giorni non si mostra più (Domanda 3).
    else if (d >= oldest && d < t && e.status !== 'todo' && e.status !== 'moved') g.past.unshift(e)
  }
  return g
}

/** Azioni mostrate su una sessione: nessuna se ha un'azione da rivedere o non inviata. */
export function actionsFor(e: ViewEvent): QueueAction[] {
  if (e.queued && e.queued.state !== 'pending') return []
  return e.status === 'todo' || e.status === 'moved' ? ['done', 'skip'] : ['undo']
}

/** Minuti pianificati (fine − inizio), arrotondati. */
export const plannedMinutes = (e: Pick<CalEvent, 'start' | 'end'>): number => Math.round((e.end - e.start) / 60_000)

export interface DaySummary { plannedMin: number; doneMin: number; toMark: number }

/** Minuti reali dell'ultima riga del registro (per `date`) con quello stato. */
const lastActual = (log: LogEntry[], eventId: string, status: LogEntry['status']) =>
  log.filter((l) => l.eventId === eventId && l.status === status).sort((a, b) => b.date - a.date)[0]?.actualMin

function doneMinutes(e: ViewEvent, log: LogEntry[]): number {
  if (e.status === 'partial') return lastActual(log, e.id, 'partial') ?? 0
  if (e.status !== 'done') return 0
  const queued = e.queued?.state === 'pending' && e.queued.action === 'done' ? e.queued.actualMin : undefined
  return queued ?? lastActual(log, e.id, 'done') ?? plannedMinutes(e)
}

/** Ore pianificate e fatte oggi; da segnare = groupSessions(...).toMark.length. */
export function daySummary(events: ViewEvent[], log: LogEntry[], now: number, tz: string): DaySummary {
  const t = dayOf(now, tz)
  const todays = events.filter((e) => e.kind !== undefined && dayOf(e.start, tz) === t)
  return {
    plannedMin: todays.reduce((sum, e) => sum + plannedMinutes(e), 0),
    doneMin: todays.reduce((sum, e) => sum + doneMinutes(e, log), 0),
    toMark: groupSessions(events, now, tz).toMark.length,
  }
}

/** Giorni all'esame per le materie con data d'esame oggi o dopo; dal più vicino, poi per nome. */
export function examCountdown(subjects: Pick<Subject, 'name' | 'examDate'>[], now: number, tz: string): { name: string; days: number }[] {
  const t = Date.parse(dayOf(now, tz))
  return subjects
    .flatMap((s) => (s.examDate ? [{ name: s.name, days: Math.round((Date.parse(s.examDate) - t) / DAY) }] : []))
    .filter((x) => x.days >= 0)
    .sort((a, b) => a.days - b.days || a.name.localeCompare(b.name))
}

/** Ore con al massimo un decimale e la virgola: 90 → "1,5", 120 → "2", 0 → "0". */
export function fmtHours(min: number): string {
  return String(Math.round(min / 6) / 10).replace('.', ',')
}

/** 0 → "oggi", 1 → "domani", n → "tra n giorni". */
export function countdownText(days: number): string {
  if (days === 0) return 'oggi'
  return days === 1 ? 'domani' : `tra ${days} giorni`
}

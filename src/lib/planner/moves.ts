import type { QueueOp } from '../../db/schema'
import type { ViewEvent } from '../calendar/queue'
import { DAY, MINUTE } from '../time'
import { busyFrom, findSlot } from './findSlot'
import type { Interval, SlotOpts } from './findSlot'

// Regole pure di Non fatto, Parziale e Imprevisto (docs/spec/05-sposta.md). Firme fissate da Opus (riga 05).

export const PARTIAL_PERCENTS = [25, 50, 75] as const
export type PartialPercent = (typeof PARTIAL_PERCENTS)[number]

/** Minuti reali precompilati per Parziale: pianificati × percentuale, arrotondati. */
export function partialActualMin(plannedMin: number, percent: PartialPercent): number {
  return Math.round((plannedMin * percent) / 100)
}

/** Durata del resto: parte non fatta della durata pianificata, arrotondata al minuto, almeno `minMin` (default 30). */
export function restoMinutes(plannedMin: number, percent: PartialPercent, minMin = 30): number {
  return Math.max(minMin, Math.round((plannedMin * (100 - percent)) / 100))
}

/** Titolo del resto: titolo senza prefisso di stato + " (resto)", senza ripeterlo se c'è già. */
export function restoTitle(cleanTitle: string): string {
  return cleanTitle.endsWith(' (resto)') ? cleanTitle : `${cleanTitle} (resto)`
}

/**
 * Descrizione del resto: "Resume from: <nota>" come prima riga, poi la descrizione originale senza eventuali righe
 * "Resume from:" vecchie (maiuscole indifferenti) e senza righe vuote in testa o in coda.
 */
export function restoDescription(description: string, note: string): string {
  const lines = description.split(/\r?\n/).filter((l) => !/^\s*resume from:/i.test(l))
  while (lines.length && !lines[0].trim()) lines.shift()
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  return [`Resume from: ${note.trim()}`, ...lines].join('\n')
}

/** Oltre questo distacco da adesso, Non fatto suggerisce Parziale o il ricalibro. */
export const FAR_MS = 3 * DAY
export const isFar = (slot: Interval, now: number): boolean => slot.start - now > FAR_MS

export interface ImprevistoItem {
  ev: ViewEvent
  /** Nuovo orario; null = non si sposta (vedi `reason`). */
  slot: Interval | null
  /** Perché non si sposta, in italiano. */
  reason?: string
}

/** Motivi fissi (anche i test li usano). */
export const NO_SLOT = 'Nessuno spazio libero entro 12 giorni: non spostata.'
export const IN_REVIEW = "Ha un'azione da rivedere nella coda: non spostata."

/**
 * Sessioni toccate da un imprevisto `imp`: sessioni di studio (kind definito) da fare (status 'todo' o 'moved'),
 * non tutto il giorno, che si sovrappongono a `imp` e finiscono dopo `o.from`; ordinate per inizio.
 * Quelle con un'azione in coda non 'pending' restano ferme con `IN_REVIEW`. Le altre, in ordine, vanno nel primo
 * spazio libero (findSlot, con la loro durata) dove sono occupati: busyFrom(events, ops, id delle sessioni da spostare),
 * più `imp`, più gli spazi già scelti per le sessioni precedenti. Senza spazio: slot null con `NO_SLOT`.
 */
export function planImprevisto(events: ViewEvent[], ops: QueueOp[], imp: Interval, o: SlotOpts): ImprevistoItem[] {
  const hit = events
    .filter((e) => e.kind !== undefined && (e.status === 'todo' || e.status === 'moved') && !e.allDay
      && e.start < imp.end && e.end > imp.start && e.end > o.from)
    .sort((a, b) => a.start - b.start)
  const movable = hit.filter((e) => !e.queued || e.queued.state === 'pending')
  const busy = [...busyFrom(events, ops, movable.map((e) => e.id)), imp]
  return hit.map((e): ImprevistoItem => {
    if (e.queued && e.queued.state !== 'pending') return { ev: e, slot: null, reason: IN_REVIEW }
    const slot = findSlot(busy, Math.round((e.end - e.start) / MINUTE), o)
    if (!slot) return { ev: e, slot: null, reason: NO_SLOT }
    busy.push(slot)
    return { ev: e, slot }
  })
}

/** Date e orari nel fuso dell'utente (default Asia/Shanghai). Le chiamate a Calendar usano queste funzioni. */

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

/** Vero se `tz` è un fuso orario IANA che questo browser conosce (es. "Asia/Shanghai"). */
export function isValidTimeZone(tz: string): boolean {
  if (!tz.trim()) return false
  try {
    new Intl.DateTimeFormat('it', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Data di oggi "YYYY-MM-DD" nel fuso indicato. */
export function todayIn(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

const formats = new Map<string, Intl.DateTimeFormat>()
const fmt = (tz: string) => {
  let f = formats.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    })
    formats.set(tz, f)
  }
  return f
}

/** Ora "da orologio" nel fuso: anno, mese (1-12), giorno, ore, minuti, secondi. */
function wall(tz: string, ms: number) {
  const p: Record<string, number> = {}
  for (const x of fmt(tz).formatToParts(ms)) if (x.type !== 'literal') p[x.type] = Number(x.value)
  return { y: p.year, m: p.month, d: p.day, h: p.hour, mi: p.minute, s: p.second }
}

/** Scarto del fuso rispetto a UTC in minuti, in quell'istante (+480 per Shanghai). */
export function tzOffsetMin(tz: string, ms: number): number {
  const w = wall(tz, ms)
  return Math.round((Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - Math.floor(ms / 1000) * 1000) / MINUTE)
}

/** Istante (ms) di "YYYY-MM-DD" alle "HH:MM" nel fuso indicato. */
export function zonedToMs(date: string, time: string, tz: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const local = Date.UTC(y, m - 1, d, h, mi)
  // Due passaggi: il primo scarto può cambiare se l'orario cade vicino al cambio dell'ora legale.
  const first = local - tzOffsetMin(tz, local) * MINUTE
  return local - tzOffsetMin(tz, first) * MINUTE
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** RFC 3339 con lo scarto del fuso, es. "2026-11-19T09:00:00+08:00" (formato di Calendar). */
export function toZonedIso(ms: number, tz: string): string {
  const w = wall(tz, ms)
  const off = tzOffsetMin(tz, ms)
  const zone = off === 0 ? 'Z' : `${off < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`
  return `${pad(w.y, 4)}-${pad(w.m)}-${pad(w.d)}T${pad(w.h)}:${pad(w.mi)}:${pad(w.s)}${zone}`
}

/** "YYYY-MM-DD" spostata di `n` giorni di calendario. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

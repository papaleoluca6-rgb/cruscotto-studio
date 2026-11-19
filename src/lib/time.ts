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

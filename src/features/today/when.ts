/** Orario "hh:mm–hh:mm" (o "tutto il giorno"), con il giorno davanti se `showDay`. */
export function whenText(start: number, end: number, allDay: boolean, tz: string, showDay: boolean): string {
  const time = (ms: number) => new Date(ms).toLocaleTimeString('it', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
  const hours = allDay ? 'tutto il giorno' : `${time(start)}–${time(end)}`
  return showDay ? `${new Date(start).toLocaleString('it', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' })}, ${hours}` : hours
}

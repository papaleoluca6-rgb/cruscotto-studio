import { addDays, todayIn, toZonedIso, zonedToMs } from '../time'
import type { GEvent } from './api'

// Eventi di esempio INVENTATI per il finto Calendar (repo pubblico: nessun dato reale).

const tag = (tipo: string, materia: string) => ({ extendedProperties: { private: { cruscotto: '1', tipo, materia } } })
const popup = { reminders: { useDefault: false, overrides: [{ method: 'popup' as const, minutes: 10 }] } }

/** Una dozzina di eventi tra 3 giorni fa e 5 giorni dopo `now`, nel fuso `tz`. */
export function sampleEvents(tz: string, now: number): GEvent[] {
  const today = todayIn(tz, new Date(now))
  let n = 0
  const at = (day: number, time: string, minutes: number, summary: string, extra: Partial<GEvent> = {}): GEvent => {
    const start = zonedToMs(addDays(today, day), time, tz)
    return {
      id: `sample${++n}`, status: 'confirmed', summary,
      start: { dateTime: toZonedIso(start, tz), timeZone: tz },
      end: { dateTime: toZonedIso(start + minutes * 60_000, tz), timeZone: tz },
      ...extra,
    }
  }
  const allDay = (day: number, summary: string): GEvent => ({
    id: `sample${++n}`, status: 'confirmed', summary, transparency: 'transparent',
    start: { date: addDays(today, day) }, end: { date: addDays(today, day + 1) },
  })
  const desc = 'Material: dispense cap. 4, slide 12-30\nTask: rifare gli esempi svolti\nDone when: so rifarli senza guardare\nNotion: https://example.com/notion'
  return [
    at(-3, '09:00', 90, '✅ Analog Study: amplificatori operazionali', { ...tag('study', 'Analog'), ...popup, description: desc }),
    at(-2, '14:00', 60, 'Analisi 2 Exercises: integrali doppi es. 1-10', { description: 'Material: eserciziario p. 40\nTask: es. 1-10\nDone when: tutti corretti' }),
    at(-1, '08:00', 120, 'Lezione: Segnali e sistemi'),
    at(-1, '10:30', 60, '↻ DSP Review +1d: trasformata zeta', { ...tag('review', 'DSP'), ...popup }),
    at(-1, '12:00', 60, 'Pranzo'),
    at(0, '08:00', 120, 'Lezione: Elettronica analogica'),
    at(0, '15:00', 90, 'Communication Study: modulazione AM e FM', { ...tag('study', 'Communication'), ...popup, description: desc }),
    at(0, '20:00', 30, 'Ripasso vocaboli'),
    at(1, '09:00', 60, 'Sessione importata da altrove', { ...tag('exercises', 'ALP'), ...popup }),
    at(1, '16:00', 120, 'CPT Pronto: schema del database'),
    allDay(2, 'Festa del campus'),
    at(3, '09:00', 120, 'Analog Simulazione: esame dell\'anno scorso', { ...tag('simulazione', 'Analog'), ...popup }),
    at(5, '10:00', 60, 'ALP Review +1w: puntatori'),
  ]
}

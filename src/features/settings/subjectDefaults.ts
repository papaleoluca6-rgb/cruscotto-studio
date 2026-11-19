import { newId, type Subject } from '../../db/schema'

/** Colori di Google Calendar per colorId (stessi token di styles/global.css). */
export const GCAL_COLORS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'] as const
export const gcalVar = (colorId: string) => `var(--gcal-${GCAL_COLORS.includes(colorId as never) ? colorId : '8'})`

/** Materie di partenza (docs/spec/formato-calendar.md): pesi e date d'esame si importano con la riga 08. */
const STARTER: [string, string][] = [
  ['Analog', '6'], ['Communication', '10'], ['Analisi 2', '5'], ['ALP', '3'], ['CPT', '9'], ['DSP', '8'], ['Cinese', '4'],
]

export const newSubject = (name = '', colorId = '1', now = Date.now()): Subject => ({
  id: newId(), name, prefix: name, colorId, difficulty: 3, importance: 3, updatedAt: now,
})

export const starterSubjects = (now = Date.now()) => STARTER.map(([name, color]) => newSubject(name, color, now))

import type { IconName } from '../lib/Icon'

export const TABS = [
  { id: 'oggi', label: 'Oggi', icon: 'calendar', empty: 'Le sessioni di oggi da Google Calendar arriveranno qui.' },
  { id: 'materie', label: 'Materie', icon: 'book', empty: 'Pesi, ore e scadenze per materia arriveranno qui.' },
  { id: 'esercizi', label: 'Esercizi', icon: 'pen', empty: 'Gli esercizi per materia arriveranno qui.' },
  { id: 'flashcard', label: 'Flashcard', icon: 'cards', empty: 'Le flashcard con ripasso FSRS arriveranno qui.' },
  { id: 'impostazioni', label: 'Impostazioni', icon: 'settings', empty: '' },
] as const satisfies readonly { id: string; label: string; icon: IconName; empty: string }[]

export type TabId = (typeof TABS)[number]['id']

export const tabFromHash = (hash: string): TabId => TABS.find((t) => `#${t.id}` === hash)?.id ?? 'oggi'

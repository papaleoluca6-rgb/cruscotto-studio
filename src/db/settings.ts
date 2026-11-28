import { useLiveQuery } from 'dexie-react-hooks'
import { AI_PROVIDERS, type AiProviderId } from '../lib/ai/types'
import { db } from './schema'

/** Impostazioni tipizzate: chiave → tipo del valore. Le chiavi `apiKey.*` non escono mai dal dispositivo (backup, sync). */
export type SettingsMap = {
  /** Fuso orario IANA dell'utente. */
  timeZone: string
  /** Client ID OAuth di Google (mai nei commit). */
  'google.clientId': string
  /** Calendario su cui l'app scrive le sessioni. */
  'calendar.workId': string
  /** Calendari mai letti né toccati. */
  'calendar.excluded': string[]
  /** Finestra di studio, "HH:MM". */
  'study.windowStart': string
  'study.windowEnd': string
  /** Minuti liberi tra un evento e l'altro. */
  'study.marginMin': number
  /** Blocco libero più corto utile per spostare una sessione. */
  'study.minBlockMin': number
  /** Sessioni registrate minime per usare il fattore di correzione delle stime. */
  'stime.minSessions': number
  'ai.provider': 'none' | AiProviderId
  /** Minuti del promemoria popup sugli eventi creati dall'app. */
  'reminder.popupMin': number
  /** Ritenzione desiderata FSRS (0,7-0,97). */
  'fsrs.retention': number
  /** Solo in sviluppo (npm run dev): legge e scrive sul finto Calendar invece che su Google. */
  'dev.fakeCalendar': boolean
} & { [P in AiProviderId as `apiKey.${P}`]: string } & { [P in AiProviderId as `ai.model.${P}`]: string }

export type SettingKey = keyof SettingsMap

const str = (v: unknown): v is string => typeof v === 'string'
const time = (v: unknown): v is string => str(v) && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
const int = (min: number, max: number) => (v: unknown): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max
const num = (min: number, max: number) => (v: unknown): v is number => typeof v === 'number' && v >= min && v <= max
const strList = (v: unknown): v is string[] => Array.isArray(v) && v.every(str)
const bool = (v: unknown): v is boolean => typeof v === 'boolean'
const oneOf = <T extends string>(list: readonly T[]) => (v: unknown): v is T => list.includes(v as T)

interface Spec<T> { def: T; ok: (v: unknown) => v is T }
type Specs = { [K in SettingKey]: Spec<SettingsMap[K]> }

const perProvider = <P extends string>(prefix: P) =>
  Object.fromEntries(AI_PROVIDERS.map((p) => [`${prefix}${p.id}`, { def: '', ok: str }])) as Record<`${P}${AiProviderId}`, Spec<string>>

export const SPECS: Specs = {
  timeZone: { def: 'Asia/Shanghai', ok: str },
  'google.clientId': { def: '', ok: str },
  'calendar.workId': { def: 'primary', ok: str },
  'calendar.excluded': { def: [], ok: strList },
  'study.windowStart': { def: '08:00', ok: time },
  'study.windowEnd': { def: '22:45', ok: time },
  'study.marginMin': { def: 5, ok: int(0, 120) },
  'study.minBlockMin': { def: 30, ok: int(5, 240) },
  'stime.minSessions': { def: 5, ok: int(1, 100) },
  'ai.provider': { def: 'none', ok: oneOf(['none', ...AI_PROVIDERS.map((p) => p.id)]) },
  'reminder.popupMin': { def: 10, ok: int(0, 240) },
  'fsrs.retention': { def: 0.9, ok: num(0.7, 0.97) },
  'dev.fakeCalendar': { def: true, ok: bool },
  ...perProvider('apiKey.'),
  ...perProvider('ai.model.'),
}

/** Valore letto dal database: se manca o non è valido (file vecchio o modificato) vale il default. */
export function settingValue<K extends SettingKey>(key: K, raw: unknown): SettingsMap[K] {
  const s = SPECS[key]
  return s.ok(raw) ? raw : s.def
}

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingsMap[K]> {
  return settingValue(key, (await db.settings.get(key))?.value)
}

/** Salva un valore; un valore fuori dai limiti è un errore (mai salvato in silenzio). */
export async function setSetting<K extends SettingKey>(key: K, value: SettingsMap[K]): Promise<void> {
  if (!SPECS[key].ok(value)) throw new Error(`Valore non valido per ${key}`)
  await db.settings.put({ key, value, updatedAt: Date.now() })
}

/** Valore corrente (reattivo); durante il caricamento restituisce il default. */
export function useSetting<K extends SettingKey>(key: K): SettingsMap[K] {
  const v = useLiveQuery(() => getSetting(key), [key])
  return v === undefined ? SPECS[key].def : v
}

export const isSecretKey = (key: unknown) => String(key).startsWith('apiKey.')

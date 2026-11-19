// Formato del backup: un JSON semplice, leggibile, senza Blob e senza chiavi API.
export const APP = 'cruscotto-studio'
export const VERSION = 1

export type Tables = Record<string, unknown[]>
export interface Meta { version: number; createdAt: number; dbVersion: number }

const bad = () => new Error('Il file non è un backup di Cruscotto Studio valido.')

const isPlain = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== 'object' || v === null) return false
  const p = Object.getPrototypeOf(v)
  return p === Object.prototype || p === null
}

export function encode(tables: Tables, dbVersion: number, now = Date.now()): string {
  return JSON.stringify({ app: APP, version: VERSION, createdAt: now, dbVersion, tables })
}

export function decode(text: string): { meta: Meta; tables: Tables } {
  let data: unknown
  try { data = JSON.parse(text) } catch { throw bad() }
  if (!isPlain(data) || data.app !== APP) throw bad()
  if (data.version !== VERSION) throw new Error("Versione del backup non supportata: aggiorna l'app e riprova.")
  const { createdAt, dbVersion, tables } = data
  if (!Number.isInteger(dbVersion) || (dbVersion as number) < 1) throw bad()
  if (!isPlain(tables) || !Object.values(tables).every((rows) => Array.isArray(rows) && rows.every(isPlain))) throw bad()
  return { meta: { version: VERSION, createdAt: Number(createdAt) || 0, dbVersion: dbVersion as number }, tables: tables as Tables }
}

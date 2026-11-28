import { db, type Tombstone } from '../../db/schema'
import { isSecretKey, SPECS, type SettingKey } from '../../db/settings'
import { decode, encode, type Tables } from './format'

/** `events` e `calSync` sono la cache di Calendar: si rileggono da lì, un backup vecchio li renderebbe stantii. */
const SKIPPED = new Set(['events', 'calSync'])
/** Le chiavi API non escono dal dispositivo e non si importano. */
const withoutSecrets = (table: string, rows: unknown[]) =>
  table === 'settings' ? rows.filter((r) => !isSecretKey((r as { key?: unknown }).key)) : rows

/** Nomi delle tabelle per i messaggi. */
export const TABLE_LABELS: Record<string, string> = {
  settings: 'impostazioni', subjects: 'materie', events: 'eventi di Calendar', log: 'registro sessioni', exercises: 'esercizi',
  cards: 'flashcard', revlog: 'ripassi', tombstones: 'cancellazioni', recalibrations: 'ricalibri',
  calSync: 'stato lettura Calendar',
}

const backupTables = () => db.tables.filter((t) => !SKIPPED.has(t.name))

export async function exportBackup(): Promise<string> {
  const tables: Tables = {}
  // Una sola transazione di lettura: le tabelle sono tutte dello stesso istante.
  await db.transaction('r', backupTables(), async () => {
    for (const t of backupTables()) tables[t.name] = withoutSecrets(t.name, await t.toArray())
  })
  return encode(tables, db.verno)
}

const localDate = () => {
  const d = new Date()
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n, i) => String(n).padStart(i ? 2 : 4, '0')).join('-')
}

export function downloadBackup(json: string) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `cruscotto-backup-${localDate()}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export interface ImportResult {
  /** Righe scritte per tabella. */
  counts: Record<string, number>
  /** Righe non importate per tabella (impostazioni non valide, righe cancellate dopo il backup). */
  skipped: Record<string, number>
  /** Tabelle sconosciute o escluse. */
  ignored: string[]
}

type Row = { id?: string; key?: string; value?: unknown; updatedAt?: number }
const stamp = (r: Row) => (typeof r.updatedAt === 'number' ? r.updatedAt : 0)

/**
 * Unisce il backup al database in una sola transazione (o tutto o niente): stesso id = sovrascritto, il resto resta.
 * Le cancellazioni contano: una riga cancellata dopo il backup non torna; una cancellazione nel backup più recente
 * della riga locale la elimina.
 */
export async function importBackup(text: string): Promise<ImportResult> {
  const { meta, tables } = decode(text)
  if (meta.dbVersion > db.verno) throw new Error("Il backup viene da una versione più recente dell'app: aggiornala e riprova.")
  const known = backupTables().filter((t) => t.name in tables)
  const ignored = Object.keys(tables).filter((n) => !known.some((t) => t.name === n))
  if (!known.length) throw new Error('Il backup non contiene dati di questa app.')
  const counts: Record<string, number> = {}
  const skipped: Record<string, number> = {}
  const skip = (t: string) => (skipped[t] = (skipped[t] ?? 0) + 1)
  // Le lapidi per prime: decidono quali righe restano.
  const ordered = [...known].sort((a, b) => Number(b.name === 'tombstones') - Number(a.name === 'tombstones'))
  try {
    // Tutte le tabelle: una lapide può riguardare una tabella che il file non contiene.
    const all = backupTables()
    await db.transaction('rw', all, async () => {
      for (const t of ordered) {
        const rows: Row[] = []
        for (const r of withoutSecrets(t.name, tables[t.name]) as Row[]) {
          if (t.name === 'settings') {
            const spec = SPECS[r.key as SettingKey]
            if (!(typeof r.key === 'string' && r.key in SPECS && spec.ok(r.value))) { skip(t.name); continue }
          } else if (t.name === 'tombstones') {
            const tomb = r as unknown as Tombstone
            const mine = await db.tombstones.get([tomb.table, tomb.id])
            if (mine && mine.updatedAt >= stamp(r)) { skip(t.name); continue }
            const target = all.find((x) => x.name === tomb.table && x.name !== 'settings')
            const local = target && ((await target.get(tomb.id)) as Row | undefined)
            if (target && local && stamp(local) <= stamp(r)) await target.delete(tomb.id)
          } else if (typeof r.id === 'string') {
            const tomb = await db.tombstones.get([t.name, r.id])
            if (tomb && tomb.updatedAt > stamp(r)) { skip(t.name); continue }
            if (tomb) await db.tombstones.delete([t.name, r.id])
          }
          rows.push(r)
        }
        await t.bulkPut(rows)
        counts[t.name] = rows.length
      }
    })
  } catch (e) {
    throw new Error(`Importazione non riuscita, nessun dato modificato: ${e instanceof Error ? e.message : String(e)}`)
  }
  return { counts, skipped, ignored }
}

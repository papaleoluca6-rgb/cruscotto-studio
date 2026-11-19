import { db, type SyncedTable } from './schema'

/** Cancella righe di una tabella sincronizzata lasciando le lapidi, nella stessa transazione: o tutto o niente. */
export async function removeRows(table: Exclude<SyncedTable, 'settings'>, ids: string[]): Promise<void> {
  const t = db.table(table)
  const now = Date.now()
  await db.transaction('rw', t, db.tombstones, async () => {
    await t.bulkDelete(ids)
    await db.tombstones.bulkPut(ids.map((id) => ({ table, id, updatedAt: now })))
  })
}

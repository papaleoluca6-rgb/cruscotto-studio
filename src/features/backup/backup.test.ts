import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, newId } from '../../db/schema'
import { removeRows } from '../../db/remove'
import { getSetting, setSetting } from '../../db/settings'
import { exportBackup, importBackup } from './backup'
import { decode, encode } from './format'

const subject = (name: string) => ({ id: newId(), name, prefix: name, colorId: '5', difficulty: 3, importance: 3, updatedAt: 1 })

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('formato', () => {
  it('rilegge quello che scrive', () => {
    const tables = { subjects: [{ id: 'a', name: 'Analisi 2 你好 è' }] }
    const { meta, tables: out } = decode(encode(tables, 1, 5))
    expect(meta).toEqual({ version: 1, createdAt: 5, dbVersion: 1 })
    expect(out).toEqual(tables)
  })

  it('rifiuta file non validi', () => {
    expect(() => decode('garbage')).toThrow(/non è un backup/)
    expect(() => decode(JSON.stringify({ app: 'altro', version: 1, dbVersion: 1, tables: {} }))).toThrow(/non è un backup/)
    expect(() => decode(JSON.stringify({ app: 'cruscotto-studio', version: 9, dbVersion: 1, tables: {} }))).toThrow(/Versione/)
    expect(() => decode(JSON.stringify({ app: 'cruscotto-studio', version: 1, dbVersion: 1, tables: { x: [1] } }))).toThrow(/non è un backup/)
  })
})

describe('backup', () => {
  it('esporta e reimporta tutto tranne chiavi API e cache eventi', async () => {
    const s = subject('DSP')
    await db.subjects.add(s)
    await setSetting('apiKey.gemini', 'segreta')
    await setSetting('study.marginMin', 7)
    await db.calSync.put({ key: 'work', source: 'fake', calendarId: 'primary', timeZone: 'Asia/Shanghai', mode: 'sync', lastSync: 1 })
    await db.events.add({ id: 'g1', calendarId: 'primary', etag: '"1"', title: 't', cleanTitle: 't', status: 'todo', appTag: false, start: 0, end: 1, transparency: 'opaque', allDay: false, description: '', updated: '' })

    const json = await exportBackup()
    expect(json).not.toContain('segreta')
    expect(decode(json).tables.events).toBeUndefined()
    expect(decode(json).tables.calSync).toBeUndefined()

    await Promise.all(db.tables.map((t) => t.clear()))
    const res = await importBackup(json)
    expect(res.counts.subjects).toBe(1)
    expect(await db.subjects.get(s.id)).toEqual(s)
    expect(await getSetting('study.marginMin')).toBe(7)
    expect(await getSetting('apiKey.gemini')).toBe('')
  })

  it('non importa chiavi API presenti nel file', async () => {
    const json = encode({ settings: [{ key: 'apiKey.qwen', value: 'x', updatedAt: 1 }] }, 1)
    await importBackup(json)
    expect(await db.settings.get('apiKey.qwen')).toBeUndefined()
  })

  it('o tutto o niente: una riga sbagliata annulla l\'intera importazione', async () => {
    const json = encode({ subjects: [subject('ALP'), { name: 'senza id' }] }, 1)
    await expect(importBackup(json)).rejects.toThrow(/nessun dato modificato/)
    expect(await db.subjects.count()).toBe(0)
  })

  it('rifiuta un backup di una versione più recente', async () => {
    await expect(importBackup(encode({ subjects: [] }, 99))).rejects.toThrow(/più recente/)
  })
})

describe('import e cancellazioni', () => {
  it('una riga cancellata dopo il backup non torna', async () => {
    const s = subject('DSP')
    await db.subjects.add(s)
    const json = await exportBackup()
    await removeRows('subjects', [s.id])
    const res = await importBackup(json)
    expect(await db.subjects.count()).toBe(0)
    expect(res.skipped.subjects).toBe(1)
  })

  it('una riga più recente della lapide torna e la lapide sparisce', async () => {
    const s = subject('DSP')
    await db.tombstones.put({ table: 'subjects', id: s.id, updatedAt: 1 })
    await importBackup(encode({ subjects: [{ ...s, updatedAt: 2 }] }, 1))
    expect(await db.subjects.get(s.id)).toBeTruthy()
    expect(await db.tombstones.get(['subjects', s.id])).toBeUndefined()
  })

  it('una lapide nel backup cancella la riga locale più vecchia, anche di una tabella assente dal file', async () => {
    const s = subject('ALP')
    await db.subjects.add(s)
    await importBackup(encode({ tombstones: [{ table: 'subjects', id: s.id, updatedAt: 5 }] }, 1))
    expect(await db.subjects.count()).toBe(0)
  })

  it('scarta impostazioni sconosciute o non valide', async () => {
    const res = await importBackup(encode({ settings: [
      { key: 'study.marginMin', value: 9, updatedAt: 1 },
      { key: 'study.marginMin2', value: 9, updatedAt: 1 },
      { key: 'fsrs.retention', value: 5, updatedAt: 1 },
    ] }, 1))
    expect(res.counts.settings).toBe(1)
    expect(res.skipped.settings).toBe(2)
    expect(await db.settings.count()).toBe(1)
  })
})

describe('cancellazioni', () => {
  it('lasciano una lapide', async () => {
    const s = subject('CPT')
    await db.subjects.add(s)
    await removeRows('subjects', [s.id])
    expect(await db.subjects.count()).toBe(0)
    expect(await db.tombstones.get(['subjects', s.id])).toMatchObject({ table: 'subjects', id: s.id })
  })
})

describe('impostazioni', () => {
  it('valori mancanti o non validi valgono il default', async () => {
    expect(await getSetting('timeZone')).toBe('Asia/Shanghai')
    await db.settings.put({ key: 'study.windowStart', value: '25:00', updatedAt: 1 })
    expect(await getSetting('study.windowStart')).toBe('08:00')
    await expect(setSetting('fsrs.retention', 2)).rejects.toThrow(/non valido/)
  })
})

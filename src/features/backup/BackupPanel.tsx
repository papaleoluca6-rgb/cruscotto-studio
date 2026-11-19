import { useRef, useState } from 'react'
import { Icon } from '../../lib/Icon'
import { downloadBackup, exportBackup, importBackup, TABLE_LABELS } from './backup'

const label = (t: string) => TABLE_LABELS[t] ?? t
const listOf = (c: Record<string, number>) => Object.entries(c).map(([t, n]) => `${label(t)} ${n}`).join(', ')

const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`

export function BackupPanel() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [failed, setFailed] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const run = async (job: () => Promise<string>) => {
    setBusy(true)
    setFailed(false)
    try { setMsg(await job()) } catch (e) { setFailed(true); setMsg(e instanceof Error ? e.message : String(e)) }
    setBusy(false)
  }

  const doExport = () => run(async () => {
    const json = await exportBackup()
    downloadBackup(json)
    return `Backup creato (${kb(json.length)}).`
  })

  const doImport = (file: File) => {
    if (!confirm("Importare il backup? Gli elementi con lo stesso id verranno sovrascritti; tutto il resto resta com'è. Si eliminano solo le righe che il backup segna come cancellate dopo la loro ultima modifica.")) return
    void run(async () => {
      const { counts, skipped, ignored } = await importBackup(await file.text())
      return `Importazione completata. Righe scritte: ${listOf(counts)}.`
        + (Object.keys(skipped).length ? ` Non importate (non valide o cancellate dopo il backup): ${listOf(skipped)}.` : '')
        + (ignored.length ? ` Ignorate: ${ignored.map(label).join(', ')}.` : '')
    })
  }

  return (
    <section className="ui-sec">
      <h2>Backup</h2>
      <p className="ui-muted">I dati restano su questo dispositivo: esporta un file JSON per tenerne una copia o spostarli. Le chiavi AI e la copia degli eventi di Calendar non sono incluse.</p>
      <div className="ui-row">
        <button className="ui-btn" disabled={busy} onClick={() => void doExport()}><Icon name="download" /> Esporta tutto</button>
        <button className="ui-btn" disabled={busy} onClick={() => fileRef.current?.click()}><Icon name="upload" /> Importa backup…</button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) doImport(f)
        }} />
      </div>
      {msg && <p role={failed ? 'alert' : 'status'} className={failed ? 'ui-error' : undefined}>{msg}</p>}
    </section>
  )
}

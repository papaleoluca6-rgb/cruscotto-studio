import { useState } from 'react'
import { db } from '../../db/schema'
import { getSetting, setSetting, useSetting } from '../../db/settings'
import type { AiProviderId } from '../../lib/ai/types'

/** Chiave di un provider AI: resta solo su questo dispositivo (esclusa da backup e sincronizzazione). */
export function ApiKeyField({ provider, title }: { provider: AiProviderId; title: string }) {
  const settingKey = `apiKey.${provider}` as const
  const saved = useSetting(settingKey)
  const [edit, setEdit] = useState<string | null>(null)
  const draft = edit ?? saved
  const [shown, setShown] = useState(false)
  const [error, setError] = useState('')

  const attempt = async (job: () => Promise<void>) => {
    setError('')
    try { await job() } catch (e) { setError(`Impossibile salvare: ${e instanceof Error ? e.message : String(e)}`) }
  }
  // La bozza resta quella appena salvata finché il database non risponde: niente sfarfallio del vecchio valore.
  /** Toglie la chiave: senza chiave il provider non è utilizzabile, si torna a "nessuna AI". */
  const removeKey = () => attempt(async () => {
    await db.transaction('rw', db.settings, async () => {
      await setSetting(settingKey, '')
      if ((await getSetting('ai.provider')) === provider) await setSetting('ai.provider', 'none')
    })
    setEdit('')
  })
  // La bozza resta quella appena salvata finché il database non risponde: niente sfarfallio del vecchio valore.
  const save = () => {
    const v = draft.trim()
    if (!v) return removeKey()
    return attempt(async () => {
      await setSetting(settingKey, v)
      setEdit(v)
    })
  }
  const clear = () => {
    if (confirm(`Cancellare la chiave ${title}?`)) void removeKey()
  }

  return (
    <div className="set-field">
      <label htmlFor={`key-${provider}`}>Chiave {title}</label>
      <div className="ui-row">
        <input id={`key-${provider}`} className="ui-input" type={shown ? 'text' : 'password'} placeholder={`Chiave ${title}`} autoComplete="new-password"
          value={draft} onChange={(e) => setEdit(e.target.value)} />
        <button className="ui-btn" type="button" onClick={() => setShown(!shown)}>{shown ? 'Nascondi' : 'Mostra'}</button>
      </div>
      <div className="ui-actions set-actions">
        <button className="ui-btn primary" onClick={() => void save()} disabled={draft.trim() === saved}>Salva chiave</button>
        <button className="ui-btn danger" onClick={clear} disabled={!saved}>Cancella</button>
      </div>
      {error && <p className="ui-error" role="alert">{error}</p>}
    </div>
  )
}

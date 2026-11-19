import { useState } from 'react'
import { setSetting, useSetting } from '../../db/settings'
import { AI_PROVIDERS } from '../../lib/ai/types'
import { ApiKeyField } from './ApiKeyField'
import { ChoiceGroup } from './ChoiceGroup'
import { TextSetting } from './fields'

/** AI facoltativa: di default nessuna, l'app funziona del tutto senza. */
export function AiSettings() {
  const provider = useSetting('ai.provider')
  const chosen = AI_PROVIDERS.find((p) => p.id === provider)
  const [error, setError] = useState('')

  return (
    <section className="ui-sec">
      <h2>AI (facoltativa)</h2>
      <p className="ui-muted">Ricalibro, spostamenti, pesi e ripassi funzionano sempre senza AI. Con una tua chiave puoi chiedere proposte a un provider; la chiave resta solo su questo dispositivo e non va nel backup.</p>
      <ChoiceGroup name="ai" label="Provider AI" value={provider}
        onChange={(v) => { setError(''); setSetting('ai.provider', v).catch((e: unknown) => setError(`Scelta non salvata: ${e instanceof Error ? e.message : String(e)}`)) }}
        choices={[
          { value: 'none', label: 'Nessuna AI', help: 'Solo regole deterministiche, gratis e offline.' },
          ...AI_PROVIDERS.map((p) => ({ value: p.id, label: p.label, help: `Con la tua chiave; ${p.note}.` })),
        ]} />
      {error && <p className="ui-error" role="alert">{error}</p>}
      {chosen && (
        <div className="ui-card ui-stack">
          <ApiKeyField key={chosen.id} provider={chosen.id} title={chosen.label} />
          <TextSetting key={`m-${chosen.id}`} k={`ai.model.${chosen.id}`} label={`Modello ${chosen.label}`} help="Vuoto = modello predefinito del provider." />
        </div>
      )}
    </section>
  )
}

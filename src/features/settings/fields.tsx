import { useId, useState } from 'react'
import { setSetting, useSetting, type SettingKey, type SettingsMap } from '../../db/settings'

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

interface FieldProps {
  label: string
  help?: string
  /** Valore salvato, come testo. */
  saved: string
  /** Converte e salva il testo; lancia un Error con il messaggio da mostrare. */
  save: (text: string) => Promise<void>
  type?: 'text' | 'time' | 'number'
  step?: string
  multiline?: boolean
  placeholder?: string
}

/** Campo che salva quando si esce (o con Invio). Un errore resta visibile finché il valore non è valido. */
export function Field({ label, help, saved, save, type = 'text', step, multiline, placeholder }: FieldProps) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState('')
  // Valore cambiato nel database (salvataggio riuscito o import): la bozza lascia il posto al valore salvato.
  const [shownSaved, setShownSaved] = useState(saved)
  if (shownSaved !== saved) {
    setShownSaved(saved)
    setDraft(null)
  }

  const commit = async () => {
    if (draft === null || draft === saved) return setError('')
    try {
      await save(draft)
      setError('')
    } catch (e) {
      setError(`Non salvato: ${errText(e)}`)
    }
  }
  const common = {
    id,
    className: 'ui-input',
    value: draft ?? saved,
    placeholder,
    'aria-invalid': error ? true : undefined,
    onBlur: () => void commit(),
  }

  return (
    <div className="set-field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea {...common} rows={3} onChange={(e) => setDraft(e.target.value)} />
      ) : (
        <input {...common} type={type} step={step} inputMode={type === 'number' ? 'decimal' : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
      )}
      {help && <small className="ui-muted">{help}</small>}
      {error && <p className="ui-error" role="alert">{error}</p>}
    </div>
  )
}

/** Chiavi il cui valore è esattamente di tipo T. */
type KeyOf<T> = { [K in SettingKey]: [SettingsMap[K]] extends [T] ? ([T] extends [SettingsMap[K]] ? K : never) : never }[SettingKey]

export function TextSetting({ k, check, ...rest }: { k: KeyOf<string>; label: string; help?: string; placeholder?: string; type?: 'text' | 'time'; check?: (v: string) => string | undefined }) {
  const saved = useSetting(k)
  return <Field {...rest} saved={saved} save={async (t) => {
    const v = t.trim()
    const bad = check?.(v)
    if (bad) throw new Error(bad)
    await setSetting(k, v)
  }} />
}

export function NumberSetting({ k, min, max, step = '1', ...rest }: { k: KeyOf<number>; label: string; help?: string; min: number; max: number; step?: string }) {
  const saved = useSetting(k)
  return <Field {...rest} type="number" step={step} saved={String(saved)} save={async (t) => {
    const v = Number(t.replace(',', '.'))
    const whole = step === '1'
    if (t.trim() === '' || !Number.isFinite(v) || v < min || v > max || (whole && !Number.isInteger(v))) {
      throw new Error(`serve un numero${whole ? ' intero' : ''} fra ${min} e ${max}`.replaceAll('.', ','))
    }
    await setSetting(k, v)
  }} />
}

export function ListSetting({ k, ...rest }: { k: KeyOf<string[]>; label: string; help?: string; placeholder?: string }) {
  const saved = useSetting(k)
  return <Field {...rest} multiline saved={saved.join('\n')} save={async (t) => {
    await setSetting(k, [...new Set(t.split('\n').map((s) => s.trim()).filter(Boolean))])
  }} />
}

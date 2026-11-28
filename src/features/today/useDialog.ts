import { useEffect, useState } from 'react'

/** Comune ai dialoghi di scrittura: Esc chiude se non sta salvando; errore "Non salvato: <motivo>". */
export function useDialog(onClose: () => void, onDone: () => void) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const save = async (job: () => Promise<unknown>, after: () => void = onDone) => {
    setSaving(true)
    setError(null)
    try {
      await job()
      after()
    } catch (e) {
      setError(`Non salvato: ${e instanceof Error ? e.message : String(e)}`)
    }
    setSaving(false)
  }
  return { saving, error, save }
}

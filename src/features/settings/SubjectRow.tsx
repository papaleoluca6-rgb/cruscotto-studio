import { useState } from 'react'
import type { Subject } from '../../db/schema'
import { db } from '../../db/schema'
import { removeRows } from '../../db/remove'
import { Icon } from '../../lib/Icon'
import { GCAL_COLORS, gcalVar } from './subjectDefaults'

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Una materia: nome, prefisso del titolo su Calendar, colore. Salva solo con il pulsante, gli errori restano visibili. */
interface Props {
  subject: Subject
  prefixTaken: (prefix: string, id: string) => boolean
  /** Materia nuova non ancora salvata: "Salva" la aggiunge, il cestino la scarta. */
  onDiscard?: () => void
}

export function SubjectRow({ subject, prefixTaken, onDiscard }: Props) {
  const [name, setName] = useState(subject.name)
  const [prefix, setPrefix] = useState(subject.prefix)
  const [colorId, setColorId] = useState(subject.colorId)
  const [error, setError] = useState('')
  const isNew = !!onDiscard
  const changed = isNew || name !== subject.name || prefix !== subject.prefix || colorId !== subject.colorId

  const save = async () => {
    const n = name.trim()
    const p = prefix.trim()
    if (!n || !p) return setError('Nome e prefisso non possono essere vuoti.')
    if (prefixTaken(p, subject.id)) return setError(`Il prefisso "${p}" è già usato da un'altra materia.`)
    try {
      const fields = { name: n, prefix: p, colorId, updatedAt: Date.now() }
      if (isNew) await db.subjects.add({ ...subject, ...fields })
      else await db.subjects.update(subject.id, fields)
      onDiscard?.()
      setName(n)
      setPrefix(p)
      setError('')
    } catch (e) {
      setError(`Non salvato: ${errText(e)}`)
    }
  }
  const remove = async () => {
    if (onDiscard) return onDiscard()
    if (!confirm(`Eliminare la materia ${subject.name || 'senza nome'}? Gli eventi su Calendar non vengono toccati.`)) return
    try { await removeRows('subjects', [subject.id]) } catch (e) { setError(`Non eliminata: ${errText(e)}`) }
  }

  return (
    <div className="ui-card subj">
      <div className="subj-head">
        <span className="subj-dot" style={{ background: gcalVar(colorId) }} />
        <strong>{subject.name || 'Nuova materia'}</strong>
        <button className="ui-btn ghost icon-only" onClick={() => void remove()} aria-label={isNew ? 'Scarta la nuova materia' : `Elimina ${subject.name}`}><Icon name="trash" /></button>
      </div>
      <div className="set-grid">
        <div className="set-field">
          <label htmlFor={`n-${subject.id}`}>Nome</label>
          <input id={`n-${subject.id}`} className="ui-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="set-field">
          <label htmlFor={`p-${subject.id}`}>Prefisso del titolo</label>
          <input id={`p-${subject.id}`} className="ui-input" value={prefix} placeholder="es. Analisi 2" onChange={(e) => setPrefix(e.target.value)} />
        </div>
      </div>
      <div className="swatches" role="radiogroup" aria-label="Colore su Google Calendar">
        {GCAL_COLORS.map((c) => (
          <button key={c} type="button" role="radio" className="swatch" aria-checked={c === colorId} aria-label={`Colore ${c}`} onClick={() => setColorId(c)}>
            <span style={{ background: gcalVar(c) }} />
          </button>
        ))}
      </div>
      {error && <p className="ui-error" role="alert">{error}</p>}
      <div className="ui-actions set-actions">
        <button className="ui-btn primary" disabled={!changed} onClick={() => void save()}><Icon name="check" /> Salva</button>
      </div>
    </div>
  )
}

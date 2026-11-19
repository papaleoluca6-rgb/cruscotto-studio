import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, type Subject } from '../../db/schema'
import { Icon } from '../../lib/Icon'
import { SubjectRow } from './SubjectRow'
import { newSubject, starterSubjects } from './subjectDefaults'

export function SubjectsEditor() {
  const subjects = useLiveQuery(() => db.subjects.orderBy('name').toArray(), [])
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<Subject | null>(null)
  const add = async (rows: ReturnType<typeof starterSubjects>) => {
    setError('')
    try { await db.subjects.bulkAdd(rows) } catch (e) { setError(`Non aggiunte: ${e instanceof Error ? e.message : String(e)}`) }
  }
  const prefixTaken = (p: string, id: string) =>
    !!subjects?.some((s) => s.id !== id && s.prefix.trim().toLowerCase() === p.toLowerCase())

  return (
    <section className="ui-sec">
      <h2>Materie</h2>
      <p className="ui-muted">Il prefisso è l'inizio del titolo delle sessioni su Calendar (es. "Analisi 2 Study: …"); il colore è quello dell'evento.</p>
      {subjects?.length === 0 && (
        <div className="ui-empty">
          <Icon name="book" size={32} />
          <p>Nessuna materia. Puoi partire da quelle del semestre e poi modificarle.</p>
          <button className="ui-btn primary" onClick={() => void add(starterSubjects())}><Icon name="plus" /> Aggiungi le 7 materie del semestre</button>
        </div>
      )}
      {subjects?.map((s) => <SubjectRow key={`${s.id}-${s.updatedAt}`} subject={s} prefixTaken={prefixTaken} />)}
      {draft && <SubjectRow key={draft.id} subject={draft} prefixTaken={prefixTaken} onDiscard={() => setDraft(null)} />}
      {error && <p className="ui-error" role="alert">{error}</p>}
      <div className="ui-actions set-actions">
        <button className="ui-btn" disabled={!!draft} onClick={() => setDraft(newSubject())}><Icon name="plus" /> Aggiungi materia</button>
      </div>
    </section>
  )
}

import { useEffect, useState } from 'react'
import type { QueueAction, QueueOp } from '../../db/schema'
import { getSetting } from '../../db/settings'
import { nextTitle } from '../../lib/calendar/parse'
import { ACTUAL_MIN, confirmConflict, discard, enqueue, type ViewEvent } from '../../lib/calendar/queue'
import { Icon } from '../../lib/Icon'
import { plannedMinutes } from './today'

export type MarkTarget = { kind: 'new'; ev: ViewEvent; action: QueueAction } | { kind: 'conflict'; op: QueueOp }

const TITLE: Record<QueueAction, string> = { done: 'Segna come fatta', skip: 'Segna come saltata', undo: 'Annulla il segno' }

/** Anteprima del nuovo titolo e conferma: scrive solo nella coda, mai direttamente su Calendar. */
export function MarkDialog({ target, onClose, onDone }: { target: MarkTarget; onClose: () => void; onDone: () => void }) {
  const [min, setMin] = useState(() =>
    target.kind === 'new' ? String(Math.min(ACTUAL_MIN.max, Math.max(ACTUAL_MIN.min, plannedMinutes(target.ev)))) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const askMin = target.kind === 'new' && target.action === 'done'
  const n = Number(min)
  const badMin = askMin && !(Number.isInteger(n) && n >= ACTUAL_MIN.min && n <= ACTUAL_MIN.max)
  const from = target.kind === 'new' ? target.ev.title : target.op.fromTitle
  const to = target.kind === 'new' ? nextTitle(target.ev.title, target.action) : target.op.toTitle

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const save = async (job: () => Promise<unknown>) => {
    setSaving(true)
    setError(null)
    try {
      await job()
      onDone()
    } catch (e) {
      setError(`Non salvato: ${e instanceof Error ? e.message : String(e)}`)
      setSaving(false)
    }
  }

  const confirm = () => save(async () => {
    if (target.kind === 'conflict') return confirmConflict(target.op.seq)
    const [workId, excluded] = await Promise.all([getSetting('calendar.workId'), getSetting('calendar.excluded')])
    await enqueue(target.ev, target.action, { workId, excluded, actualMin: askMin ? n : undefined })
  })

  return (
    <div className="ui-dialog" role="dialog" aria-modal="true" aria-labelledby="mark-title">
      <div className="ui-dialog-box ui-stack">
        <h2 id="mark-title">{target.kind === 'new' ? TITLE[target.action] : 'Evento cambiato su Calendar'}</h2>
        {target.kind === 'conflict' && <p>{target.op.lastError}</p>}
        <dl className="today-desc">
          <dt>Ora</dt>
          <dd>{from}</dd>
          <dt>Dopo</dt>
          <dd>{to}</dd>
        </dl>
        {askMin && (
          <label className="ui-stack">
            Minuti studiati davvero
            <input className="ui-input" type="number" inputMode="numeric" min={ACTUAL_MIN.min} max={ACTUAL_MIN.max} step={1} autoFocus
              value={min} onChange={(e) => setMin(e.target.value)} />
          </label>
        )}
        {badMin && <p className="ui-error">Scrivi un numero intero di minuti tra 1 e 600.</p>}
        {target.kind === 'conflict' && target.op.action === 'done' && <p className="ui-muted">Minuti studiati: {target.op.actualMin}</p>}
        <p className="ui-muted">Si invia subito se sei online, altrimenti resta in coda.</p>
        {error && <p className="ui-error" role="alert">{error}</p>}
        <div className="ui-actions">
          <button className="ui-btn ghost" disabled={saving} onClick={onClose}>Indietro</button>
          {target.kind === 'conflict' && (
            <button className="ui-btn danger" disabled={saving} onClick={() => save(() => discard(target.op.seq))}>Scarta azione</button>
          )}
          <button className="ui-btn primary" disabled={saving || badMin} onClick={confirm}><Icon name="check" />Conferma</button>
        </div>
      </div>
    </div>
  )
}

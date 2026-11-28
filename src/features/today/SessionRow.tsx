import { useState } from 'react'
import { needsMarking, parseDescription } from '../../lib/calendar/parse'
import { QUEUE_LABEL, type ViewEvent } from '../../lib/calendar/queue'
import { Icon, type IconName } from '../../lib/Icon'
import { actionsFor, type RowAction } from './today'
import { whenText } from './when'

const dot = (c: string) => `var(--gcal-${/^(?:[1-9]|1[01])$/.test(c) ? c : '8'})`

const STATUS_BADGE = { done: ['ok', 'Fatto'], skipped: ['rec', 'Saltato'], partial: ['warn', 'Parziale'], moved: ['accent', 'Spostato'], todo: null } as const
const QUEUE_CLASS = { pending: '', conflict: 'warn', rejected: 'rec' } as const
const BUTTON: Record<RowAction, { cls: string; icon: IconName; label: string }> = {
  done: { cls: 'primary', icon: 'check', label: 'Fatto' },
  partial: { cls: '', icon: 'half', label: 'Parziale' },
  notDone: { cls: '', icon: 'clock', label: 'Non fatto' },
  skip: { cls: '', icon: 'x', label: 'Salta' },
  undo: { cls: 'ghost', icon: 'undo', label: 'Annulla segno' },
}
const DESC = [['material', 'Materiale'], ['task', 'Compito'], ['doneWhen', 'Fatto quando'], ['notion', 'Notion'], ['other', 'Altro']] as const

function Description({ text }: { text: string }) {
  const d = parseDescription(text)
  const rows = DESC.flatMap(([key, label]) => (d[key] ? [[label, d[key]]] : []))
  if (!rows.length) return <p className="ui-muted">Nessuna descrizione.</p>
  return (
    <dl className="today-desc">
      {rows.map(([label, value]) => [<dt key={`t-${label}`}>{label}</dt>, <dd key={`d-${label}`}>{value}</dd>])}
    </dl>
  )
}

export function SessionRow({ e, tz, now, showDay, subject, onAction }: {
  e: ViewEvent
  tz: string
  now: number
  showDay: boolean
  subject?: { name: string; colorId: string }
  onAction?: (a: RowAction) => void
}) {
  const [open, setOpen] = useState(false)
  const status = needsMarking(e, now) ? (['warn', 'Da segnare'] as const) : STATUS_BADGE[e.status]
  return (
    <li className="today-row">
      <div className="today-meta">
        <span className="ui-muted">{whenText(e.start, e.end, e.allDay, tz, showDay)}</span>
        {subject && <span><span className="today-dot" style={{ background: dot(subject.colorId) }} /> {subject.name}</span>}
        {status && <span className={`ui-badge ${status[0]}`}>{status[1]}</span>}
        {e.queued && <span className={`ui-badge ${QUEUE_CLASS[e.queued.state]}`}>{QUEUE_LABEL[e.queued.state]}</span>}
      </div>
      <button className="today-title" aria-expanded={open} onClick={() => setOpen(!open)}>{e.cleanTitle || '(senza titolo)'}</button>
      {open && <Description text={e.description} />}
      {onAction && (
        <div className="ui-actions">
          {actionsFor(e).map((a) => (
            <button key={a} className={`ui-btn ${BUTTON[a].cls}`} onClick={() => onAction(a)}>
              <Icon name={BUTTON[a].icon} />{BUTTON[a].label}
            </button>
          ))}
        </div>
      )}
    </li>
  )
}

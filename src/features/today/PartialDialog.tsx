import { useMemo, useState } from 'react'
import type { QueueOp, Subject } from '../../db/schema'
import { nextTitle, stripStatus } from '../../lib/calendar/parse'
import { ACTUAL_MIN, type ViewEvent } from '../../lib/calendar/queue'
import { enqueuePartial } from '../../lib/calendar/queueMove'
import { Icon } from '../../lib/Icon'
import { busyFrom, findSlot } from '../../lib/planner/findSlot'
import { PARTIAL_PERCENTS, partialActualMin, restoMinutes, restoTitle, type PartialPercent } from '../../lib/planner/moves'
import { plannedMinutes } from './today'
import { useDialog } from './useDialog'
import { useMoveSettings } from './useMoveSettings'
import { whenText } from './when'

/** Parziale: percentuale, nota, minuti reali e anteprima del resto; conferma solo in coda. */
export function PartialDialog({ ev, views, ops, subjects, tz, onClose, onDone }: {
  ev: ViewEvent
  views: ViewEvent[]
  ops: QueueOp[]
  subjects: Subject[]
  tz: string
  onClose: () => void
  onDone: () => void
}) {
  const s = useMoveSettings()
  const { saving, error, save } = useDialog(onClose, onDone)
  const planned = plannedMinutes(ev)
  const [now] = useState(() => Date.now())
  const [percent, setPercent] = useState<PartialPercent>(50)
  const [note, setNote] = useState('')
  const [min, setMin] = useState(String(partialActualMin(planned, 50)))
  const n = Number(min)
  const badMin = !(Number.isInteger(n) && n >= ACTUAL_MIN.min && n <= ACTUAL_MIN.max)
  const restoMin = restoMinutes(planned, percent, s.minBlockMin)
  const resto = useMemo(
    () => findSlot(busyFrom(views, ops), restoMin, s.slotOpts(now)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [views, ops, restoMin, now, tz],
  )
  const title = restoTitle(stripStatus(ev.title).clean)
  const pick = (p: PartialPercent) => { setPercent(p); setMin(String(partialActualMin(planned, p))) }

  return (
    <div className="ui-dialog" role="dialog" aria-modal="true" aria-labelledby="partial-title">
      <div className="ui-dialog-box ui-stack">
        <h2 id="partial-title">Segna come parziale</h2>
        <div className="today-percent" role="group" aria-label="Quanto hai fatto">
          {PARTIAL_PERCENTS.map((p) => (
            <button key={p} className={`ui-btn ${p === percent ? 'primary' : ''}`} aria-pressed={p === percent} onClick={() => pick(p)}>{p}%</button>
          ))}
        </div>
        <label className="ui-stack">
          Dove sono arrivato
          <textarea className="ui-input" rows={3} autoFocus value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <label className="ui-stack">
          Minuti studiati davvero
          <input className="ui-input" type="number" inputMode="numeric" min={ACTUAL_MIN.min} max={ACTUAL_MIN.max} step={1}
            value={min} onChange={(e) => setMin(e.target.value)} />
        </label>
        {badMin && <p className="ui-error">Scrivi un numero intero di minuti tra 1 e 600.</p>}
        <dl className="today-desc">
          <dt>Ora</dt>
          <dd>{ev.title}</dd>
          <dt>Dopo</dt>
          <dd>{nextTitle(ev.title, 'partial')}</dd>
          {resto && <><dt>Resto</dt><dd>{title}, {restoMin} min, {whenText(resto.start, resto.end, false, tz, true)}</dd></>}
        </dl>
        {!resto && <p className="ui-error">Nessuno spazio libero nei prossimi 12 giorni per il resto ({restoMin} min).</p>}
        <p className="ui-muted">Si invia subito se sei online, altrimenti resta in coda.</p>
        {error && <p className="ui-error" role="alert">{error}</p>}
        <div className="ui-actions">
          <button className="ui-btn ghost" disabled={saving} onClick={onClose}>Indietro</button>
          <button className="ui-btn primary" disabled={saving || badMin || !note.trim() || !resto}
            onClick={() => resto && save(async () => enqueuePartial(ev, { percent, note, actualMin: n, resto }, await s.moveOpts(subjects)))}>
            <Icon name="check" />Conferma
          </button>
        </div>
      </div>
    </div>
  )
}

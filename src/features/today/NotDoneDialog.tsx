import { useState } from 'react'
import type { QueueOp, Subject } from '../../db/schema'
import { nextTitle } from '../../lib/calendar/parse'
import type { ViewEvent } from '../../lib/calendar/queue'
import { enqueueNotDone } from '../../lib/calendar/queueMove'
import { Icon } from '../../lib/Icon'
import { busyFrom, findSlot } from '../../lib/planner/findSlot'
import { isFar } from '../../lib/planner/moves'
import { DAY } from '../../lib/time'
import { plannedMinutes } from './today'
import { useDialog } from './useDialog'
import { useMoveSettings } from './useMoveSettings'
import { whenText } from './when'

/** Non fatto: anteprima del primo spazio libero e conferma (solo in coda, mai direttamente su Calendar). */
export function NotDoneDialog({ ev, views, ops, subjects, tz, onClose, onDone }: {
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
  const [{ now, slot }] = useState(() => {
    const t = Date.now()
    return { now: t, slot: findSlot(busyFrom(views, ops, [ev.id]), plannedMinutes(ev), s.slotOpts(t)) }
  })
  const o = s.slotOpts(now)

  return (
    <div className="ui-dialog" role="dialog" aria-modal="true" aria-labelledby="notdone-title">
      <div className="ui-dialog-box ui-stack">
        <h2 id="notdone-title">Segna come non fatta</h2>
        <dl className="today-desc">
          <dt>Ora</dt>
          <dd>{ev.title} ({whenText(ev.start, ev.end, ev.allDay, tz, true)})</dd>
          {slot && <><dt>Dopo</dt><dd>{nextTitle(ev.title, 'notDone')} ({whenText(slot.start, slot.end, false, tz, true)})</dd></>}
        </dl>
        {slot && isFar(slot, now) && (
          <p className="ui-muted">Il primo spazio libero è tra {Math.round((slot.start - now) / DAY)} giorni: valuta Parziale o il ricalibro (riga 07).</p>
        )}
        {!slot && (
          <p className="ui-error">Nessuno spazio libero nei prossimi 12 giorni (finestra {o.windowStart}–{o.windowEnd}, margine {o.marginMin} min).</p>
        )}
        <p className="ui-muted">Si invia subito se sei online, altrimenti resta in coda.</p>
        {error && <p className="ui-error" role="alert">{error}</p>}
        <div className="ui-actions">
          <button className="ui-btn ghost" disabled={saving} onClick={onClose}>Indietro</button>
          <button className="ui-btn primary" disabled={saving || !slot} onClick={() => slot && save(async () => enqueueNotDone(ev, slot, await s.moveOpts(subjects)))}>
            <Icon name="check" />Conferma
          </button>
        </div>
      </div>
    </div>
  )
}

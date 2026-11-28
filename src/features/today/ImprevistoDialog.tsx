import { useMemo, useState } from 'react'
import type { QueueOp, Subject } from '../../db/schema'
import type { ViewEvent } from '../../lib/calendar/queue'
import { enqueueImprevisto } from '../../lib/calendar/queueMove'
import { Icon } from '../../lib/Icon'
import { planImprevisto, type ImprevistoItem } from '../../lib/planner/moves'
import { todayIn, zonedToMs } from '../../lib/time'
import { ImprevistoList, ImprevistoSummary } from './ImprevistoSummary'
import { useDialog } from './useDialog'
import { useMoveSettings } from './useMoveSettings'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/
type Plan = { problem: string } | { problem?: undefined; start: number; end: number; items: ImprevistoItem[] }

/** Imprevisto: evento in Calendar e sessioni toccate spostate; anteprima completa, poi riepilogo esatto. */
export function ImprevistoDialog({ views, ops, subjects, tz, onClose, onDone }: {
  views: ViewEvent[]
  ops: QueueOp[]
  subjects: Subject[]
  tz: string
  onClose: () => void
  onDone: () => void
}) {
  const s = useMoveSettings()
  const [done, setDone] = useState<ImprevistoItem[] | null>(null)
  // Dopo la conferma anche Esc deve inviare la coda (come Chiudi).
  const { saving, error, save } = useDialog(done ? onDone : onClose, onDone)
  const [day, setDay] = useState(() => todayIn(tz))
  const [from, setFrom] = useState('09:00')
  const [to, setTo] = useState('10:00')
  const [what, setWhat] = useState('')

  const plan = useMemo((): Plan => {
    if (!DATE.test(day) || !TIME.test(from) || !TIME.test(to)) return { problem: 'Scegli il giorno e gli orari.' }
    const start = zonedToMs(day, from, tz)
    const end = zonedToMs(day, to, tz)
    if (!(start < end)) return { problem: "La fine deve venire dopo l'inizio." }
    const now = Date.now()
    if (end <= now) return { problem: "L'imprevisto è già finito." }
    return { start, end, items: planImprevisto(views, ops, { start, end }, s.slotOpts(now)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views, ops, day, from, to, tz])

  if (done) return <ImprevistoSummary what={what} items={done} tz={tz} onClose={onDone} />

  const emptyWhat = !what.trim()
  const ok = !plan.problem && !emptyWhat
  const confirm = () => {
    if (plan.problem !== undefined) return
    const { start, end, items } = plan
    const moves = items.flatMap((i) => (i.slot ? [{ ev: i.ev, slot: i.slot }] : []))
    return save(async () => enqueueImprevisto({ what, start, end, moves }, await s.moveOpts(subjects)), () => setDone(items))
  }

  return (
    <div className="ui-dialog" role="dialog" aria-modal="true" aria-labelledby="imp-title">
      <div className="ui-dialog-box ui-stack">
        <h2 id="imp-title">Imprevisto</h2>
        <label className="ui-stack">Cosa
          <input className="ui-input" type="text" autoFocus value={what} onChange={(e) => setWhat(e.target.value)} />
        </label>
        <label className="ui-stack">Giorno
          <input className="ui-input" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
        <div className="today-percent">
          <label className="ui-stack">Dalle
            <input className="ui-input" type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="ui-stack">Alle
            <input className="ui-input" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        {emptyWhat && <p className="ui-error">Scrivi cosa è successo.</p>}
        {plan.problem !== undefined ? <p className="ui-error">{plan.problem}</p> : <ImprevistoList items={plan.items} tz={tz} />}
        <p className="ui-muted">Si invia subito se sei online, altrimenti resta in coda.</p>
        {error && <p className="ui-error" role="alert">{error}</p>}
        <div className="ui-actions">
          <button className="ui-btn ghost" disabled={saving} onClick={onClose}>Indietro</button>
          <button className="ui-btn primary" disabled={saving || !ok} onClick={confirm}><Icon name="check" />Conferma</button>
        </div>
      </div>
    </div>
  )
}

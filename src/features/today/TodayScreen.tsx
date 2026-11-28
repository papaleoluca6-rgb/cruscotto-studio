import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type QueueAction } from '../../db/schema'
import { useSetting } from '../../db/settings'
import { withPending, type ViewEvent } from '../../lib/calendar/queue'
import { Icon } from '../../lib/Icon'
import { MarkDialog, type MarkTarget } from './MarkDialog'
import { QueueBar } from './QueueBar'
import { SessionList } from './SessionList'
import { Summary } from './Summary'
import { daySummary, examCountdown, groupSessions } from './today'
import { useOnline, useQueue } from './useQueue'
import './today.css'

export function TodayScreen() {
  const tz = useSetting('timeZone')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  const api = useQueue()
  const online = useOnline()
  const [target, setTarget] = useState<MarkTarget | null>(null)

  const events = useLiveQuery(() => db.events.orderBy('start').toArray())
  const ops = useLiveQuery(() => db.calQueue.orderBy('seq').toArray())
  const log = useLiveQuery(() => db.log.toArray())
  const subjectRows = useLiveQuery(() => db.subjects.toArray())
  // null = mai letto Calendar; undefined = ancora in caricamento.
  const sync = useLiveQuery(async () => (await db.calSync.get('work')) ?? null)
  const cards = useLiveQuery(() => db.cards.where('due').belowOrEqual(now).count(), [now])
  const exercises = useLiveQuery(() => db.exercises.filter((x) => x.status === 'todo').count())

  const views = withPending(events ?? [], ops ?? [])
  const g = groupSessions(views, now, tz)
  const subjects = new Map((subjectRows ?? []).map((s) => [s.id, { name: s.name, colorId: s.colorId }]))
  const list = { tz, now, subjects, onAction: (ev: ViewEvent, action: QueueAction) => setTarget({ kind: 'new', ev, action }) }

  return (
    <main className="ui-page today">
      <div className="ui-top">
        <div>
          <h1>Oggi</h1>
          <p className="ui-muted">{new Date(now).toLocaleDateString('it', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button className="ui-btn" disabled={api.busy} onClick={api.update}><Icon name="refresh" />Aggiorna</button>
      </div>
      <QueueBar ops={ops ?? []} api={api} online={online} onReview={(op) => setTarget({ kind: 'conflict', op })} />
      {sync === null && <div className="ui-empty"><Icon name="calendar" size={32} /><p>Nessun dato da Calendar: tocca Aggiorna.</p></div>}
      <Summary day={daySummary(views, log ?? [], now, tz)} exams={examCountdown(subjectRows ?? [], now, tz)} cards={cards ?? 0} exercises={exercises ?? 0} />
      <SessionList {...list} title="Da segnare" events={g.toMark} showDay empty="Niente da segnare." />
      <SessionList {...list} title="Oggi" events={g.today} showDay={false} empty="Nessuna sessione oggi." />
      <SessionList {...list} title="Domani" events={g.tomorrow} showDay={false} empty="Nessuna sessione domani." />
      <SessionList {...list} title="Prossimi giorni" events={g.next} showDay collapsible empty="Nessuna sessione nei prossimi giorni." />
      <SessionList {...list} title="Giorni scorsi" events={g.past} showDay collapsible empty="Nessuna sessione segnata negli ultimi 7 giorni." />
      {target && <MarkDialog target={target} onClose={() => setTarget(null)} onDone={() => { setTarget(null); api.send(false) }} />}
    </main>
  )
}

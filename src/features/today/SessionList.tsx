import type { ViewEvent } from '../../lib/calendar/queue'
import { SessionRow } from './SessionRow'
import type { RowAction } from './today'

export function SessionList({ title, events, empty, collapsible, showDay, tz, now, subjects, onAction }: {
  title: string
  events: ViewEvent[]
  empty: string
  collapsible?: boolean
  showDay: boolean
  tz: string
  now: number
  subjects: Map<string, { name: string; colorId: string }>
  onAction?: (e: ViewEvent, a: RowAction) => void
}) {
  const body = events.length ? (
    <ul className="ui-stack">
      {events.map((e) => (
        <SessionRow key={e.id} e={e} tz={tz} now={now} showDay={showDay} subject={subjects.get(e.subjectId ?? '')}
          onAction={onAction && ((a) => onAction(e, a))} />
      ))}
    </ul>
  ) : <p className="ui-muted">{empty}</p>

  return collapsible ? (
    <details className="ui-sec today-more">
      <summary>{title} ({events.length})</summary>
      {body}
    </details>
  ) : (
    <section className="ui-sec">
      <h2>{title}</h2>
      {body}
    </section>
  )
}

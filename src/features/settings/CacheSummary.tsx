import { useLiveQuery } from 'dexie-react-hooks'
import { db, type CalEvent, type SessionKind } from '../../db/schema'
import { needsMarking } from '../../lib/calendar/parse'

const KIND: Record<SessionKind, string> = {
  study: 'Studio', review: 'Ripasso', exercises: 'Esercizi', simulazione: 'Simulazione', pronto: 'Pronto', vocab: 'Vocaboli',
}
const SHOWN = 8

/** Quando è stata letta l'ultima volta la cache, cosa contiene e i prossimi eventi (per controllare il riconoscimento). */
export function CacheSummary({ tz, now }: { tz: string; now: number }) {
  const sync = useLiveQuery(() => db.calSync.get('work'), [])
  const events = useLiveQuery(() => db.events.orderBy('start').toArray(), [])
  if (!events) return null

  const when = (ms: number, withTime = true) => new Date(ms).toLocaleString('it', {
    timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', ...(withTime && { hour: '2-digit', minute: '2-digit' }),
  })
  const sessions = events.filter((e) => e.kind)
  const toMark = sessions.filter((e) => needsMarking(e, now))
  const shown = [...toMark, ...events.filter((e) => e.end > now)].slice(0, SHOWN)
  const label = (e: CalEvent) => e.kind ? KIND[e.kind] : 'non di studio'

  return (
    <div className="ui-stack">
      <p>
        {sync ? <>Ultimo aggiornamento: <strong>{when(sync.lastSync)}</strong>{sync.source === 'fake' && ' (finto Calendar)'}</>
          : <span className="ui-muted">Mai aggiornato: tocca Aggiorna ora.</span>}
      </p>
      {sync?.mode === 'window' && (
        <p><span className="ui-badge warn">Lettura a finestra</span> <span className="ui-muted">Troppi eventi per la lettura completa: in cache solo da 7 giorni fa a 15 giorni avanti.</span></p>
      )}
      {sync && (
        <p className="ui-muted">
          {events.length} eventi in cache · {sessions.length} sessioni di studio · {toMark.length} da segnare · {events.length - sessions.length} non di studio
        </p>
      )}
      {shown.length > 0 && (
        <ul className="ui-stack">
          {shown.map((e) => (
            <li key={e.id}>
              <span className="ui-muted">{e.allDay ? `${when(e.start, false)}, tutto il giorno` : when(e.start)}</span> · {e.title || '(senza titolo)'}{' '}
              <span className={`ui-badge${needsMarking(e, now) ? ' warn' : e.kind ? ' accent' : ''}`}>{needsMarking(e, now) ? 'da segnare' : label(e)}</span>
              {e.appTag && <> <span className="ui-badge">tag app</span></>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

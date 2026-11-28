import { useState, useSyncExternalStore } from 'react'
import type { QueueOp } from '../../db/schema'
import { useSetting } from '../../db/settings'
import { subscribeToken, tokenState, validToken } from '../../lib/calendar/auth'
import { discard, QUEUE_LABEL } from '../../lib/calendar/queue'
import { Icon } from '../../lib/Icon'
import type { QueueApi } from './useQueue'

/** Azioni in attesa, esito dell'ultimo invio e azioni da rivedere. */
export function QueueBar({ ops, api, online, onReview }: { ops: QueueOp[]; api: QueueApi; online: boolean; onReview: (op: QueueOp) => void }) {
  const fakeSetting = useSetting('dev.fakeCalendar')
  useSyncExternalStore(subscribeToken, tokenState)
  const [error, setError] = useState<string | null>(null)
  if (!ops.length && !api.msg) return null

  const pending = ops.filter((o) => o.state === 'pending').length
  const review = ops.filter((o) => o.state !== 'pending')
  const needsLogin = online && !(import.meta.env.DEV && fakeSetting) && !validToken()
  const drop = (seq: number) => {
    setError(null)
    discard(seq).catch((e: unknown) => setError(`Non scartata: ${e instanceof Error ? e.message : String(e)}`))
  }

  return (
    <section className="ui-card ui-stack" aria-label="Coda per Calendar">
      {pending > 0 && (
        <>
          <div className="ui-row">
            <span className="ui-badge warn">{pending === 1 ? '1 azione in coda' : `${pending} azioni in coda`}</span>
            <button className="ui-btn primary" disabled={api.busy || !online} onClick={() => api.send(true)}><Icon name="upload" />Invia ora</button>
          </div>
          {!online && <p className="ui-muted">Offline: partiranno alla riconnessione.</p>}
          {needsLogin && <p className="ui-muted">Tocca Invia ora per accedere a Google e inviarle.</p>}
        </>
      )}
      {api.busy && <p className="ui-muted" role="status">Invio a Calendar…</p>}
      {api.msg && <p className={api.msg.ok ? undefined : 'ui-error'} role={api.msg.ok ? 'status' : 'alert'}>{api.msg.text}</p>}
      {api.msg && api.msg.sent.length > 0 && (
        <ul className="ui-stack">
          {api.msg.sent.map((title, i) => <li className="ui-muted" key={`${i}-${title}`}>Inviata: {title}</li>)}
        </ul>
      )}
      {review.length > 0 && (
        <ul className="ui-stack">
          {review.map((op) => (
            <li className="today-row" key={op.seq}>
              <strong>{op.fromTitle}</strong>
              <div><span className={`ui-badge ${op.state === 'conflict' ? 'warn' : 'rec'}`}>{QUEUE_LABEL[op.state]}</span></div>
              <p className="ui-muted">{op.lastError}</p>
              <div className="ui-actions">
                {op.state === 'conflict' && <button className="ui-btn" onClick={() => onReview(op)}>Rivedi</button>}
                <button className="ui-btn ghost danger" onClick={() => drop(op.seq)}>Scarta</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="ui-error" role="alert">{error}</p>}
    </section>
  )
}

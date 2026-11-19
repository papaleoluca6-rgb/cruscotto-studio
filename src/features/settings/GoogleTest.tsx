import { useEffect, useState, useSyncExternalStore } from 'react'
import { useSetting } from '../../db/settings'
import { calendarErrorMessage, listEvents, type GEvent } from '../../lib/calendar/api'
import { expireToken, forgetToken, getToken, isGisLoaded, loadGis, requestToken, subscribeToken, tokenState } from '../../lib/calendar/auth'
import { HttpError } from '../../lib/http'

const DAY = 86_400_000

/** Prova del login Google e di una lettura da Calendar (riga 02); da rifinire nella riga 03. */
export function GoogleTest() {
  const clientId = useSetting('google.clientId')
  const tz = useSetting('timeZone')
  const calId = useSetting('calendar.workId')
  const tok = useSyncExternalStore(subscribeToken, tokenState)
  const [gisReady, setGisReady] = useState(isGisLoaded)
  const [gisError, setGisError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [events, setEvents] = useState<GEvent[] | null>(null)
  // Orologio per mostrare quando il token scade davvero.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Lo script di Google si carica prima del tocco: il popup deve aprirsi subito dentro il tocco, senza attese.
  useEffect(() => {
    if (!clientId || gisReady || gisError) return
    let live = true
    loadGis().then(() => live && setGisReady(true), (e: Error) => live && setGisError(e.message))
    return () => { live = false }
  }, [clientId, gisReady, gisError])

  // job() parte subito nel tocco: requestToken apre il popup prima di qualunque await.
  const run = (job: () => Promise<string>) => {
    setBusy(true)
    setMsg(null)
    job().then((text) => setMsg({ ok: true, text }), (e) => setMsg({ ok: false, text: calendarErrorMessage(e) })).finally(() => setBusy(false))
  }
  const login = () => run(async () => {
    await requestToken(clientId)
    return 'Accesso riuscito.'
  })
  const read = () => run(async () => {
    const t = await getToken(clientId)
    setEvents(null)
    const from = new Date()
    try {
      const items = await listEvents(t, calId, from, new Date(from.getTime() + 7 * DAY), tz, 10)
      setEvents(items)
      return `Lettura riuscita: ${items.length === 10 ? 'almeno 10' : items.length} eventi nei prossimi 7 giorni su "${calId}".`
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) expireToken()
      throw e
    }
  })

  const fmt = (ms: number, withDay = false) =>
    new Date(ms).toLocaleString('it', { timeZone: tz, hour: '2-digit', minute: '2-digit', ...(withDay && { weekday: 'short', day: 'numeric', month: 'short' }) })
  const when = (ev: GEvent) =>
    ev.start?.dateTime ? fmt(Date.parse(ev.start.dateTime), true) : ev.start?.date ? `${ev.start.date}, tutto il giorno` : '?'
  const off = !clientId || !gisReady || busy

  return (
    <div className="ui-card ui-stack">
      <h3>Prova accesso Google</h3>
      <p>
        {!tok ? <span className="ui-badge">Non connesso</span>
          : now < tok.expiresAt ? <span className="ui-badge ok">Connesso, token valido fino alle {fmt(tok.expiresAt)}</span>
            : <span className="ui-badge warn">Token scaduto: si rinnova alla prossima lettura</span>}
      </p>
      {!clientId && <p className="ui-muted">Scrivi il Client ID qui sopra per provare l'accesso.</p>}
      {clientId && !gisReady && !gisError && <p className="ui-muted" role="status">Carico l'accesso Google…</p>}
      {gisError && (
        <div className="ui-row">
          <p className="ui-error" role="alert">{gisError}</p>
          <button className="ui-btn" onClick={() => setGisError(null)}>Riprova</button>
        </div>
      )}
      <div className="ui-actions set-actions">
        {/* Resta attivo durante l'attesa: se il popup non risponde, un nuovo tocco sostituisce la richiesta appesa. */}
        <button className="ui-btn primary" onClick={login} disabled={!clientId || !gisReady}>Accedi con Google</button>
        <button className="ui-btn" onClick={read} disabled={off}>Prova lettura eventi</button>
        <button className="ui-btn" onClick={expireToken} disabled={!tok || busy}>Simula scadenza</button>
        <button className="ui-btn ghost" onClick={() => { forgetToken(); setEvents(null) }} disabled={!tok || busy}>Esci</button>
      </div>
      {busy && <p className="ui-muted" role="status">Attendo Google…</p>}
      {msg && <p className={msg.ok ? undefined : 'ui-error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      {events && events.length > 0 && (
        <ul className="ui-stack">
          {events.map((ev) => <li key={ev.id}><span className="ui-muted">{when(ev)}</span> · {ev.summary ?? '(senza titolo)'}</li>)}
        </ul>
      )}
    </div>
  )
}

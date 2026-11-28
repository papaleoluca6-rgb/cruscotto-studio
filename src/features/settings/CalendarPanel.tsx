import { useEffect, useState, useSyncExternalStore } from 'react'
import { getSetting, setSetting, useSetting } from '../../db/settings'
import { calendarErrorMessage, googleClient, type CalendarClient } from '../../lib/calendar/api'
import { expireToken, forgetToken, getToken, isGisLoaded, loadGis, requestToken, subscribeToken, tokenState, validToken } from '../../lib/calendar/auth'
import { clearEventCache, dropStaleCache, refreshEvents, type RefreshResult } from '../../lib/calendar/cache'
import { devFakeCalendar } from '../../lib/calendar/fake'
import { HttpError } from '../../lib/http'
import { Icon } from '../../lib/Icon'
import { CacheSummary } from './CacheSummary'

const DEV = import.meta.env.DEV

const resultText = (r: RefreshResult) =>
  r.mode === 'incremental'
    ? r.changed || r.removed ? `Aggiornato: ${r.changed} eventi nuovi o cambiati, ${r.removed} tolti.` : 'Aggiornato: nessuna modifica su Calendar.'
    : `Aggiornato: ${r.mode === 'full' ? 'lettura completa' : 'lettura a finestra (-7/+15 giorni)'}, ${r.total} eventi in cache.`

/** Login/logout Google, "Aggiorna ora" e stato della cache del calendario di lavoro. */
export function CalendarPanel() {
  const clientId = useSetting('google.clientId')
  const tz = useSetting('timeZone')
  const calId = useSetting('calendar.workId')
  const excluded = useSetting('calendar.excluded')
  const fakeSetting = useSetting('dev.fakeCalendar')
  const useFake = DEV && fakeSetting
  const tok = useSyncExternalStore(subscribeToken, tokenState)
  const [gisReady, setGisReady] = useState(isGisLoaded)
  const [gisError, setGisError] = useState<string | null>(null)
  // Operazioni in corso: "Accedi" resta attivo durante l'attesa, quindi possono sovrapporsi.
  const [running, setRunning] = useState(0)
  const busy = running > 0
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Lo script di Google si carica prima del tocco: il popup deve aprirsi subito dentro il tocco, senza attese.
  useEffect(() => {
    if (useFake || !clientId || gisReady || gisError) return
    let live = true
    loadGis().then(() => live && setGisReady(true), (e: Error) => live && setGisError(e.message))
    return () => { live = false }
  }, [useFake, clientId, gisReady, gisError])

  // Calendario di lavoro cambiato o escluso: i suoi eventi in cache non si mostrano né si usano più.
  useEffect(() => {
    let live = true
    Promise.all([getSetting('calendar.workId'), getSetting('calendar.excluded')]).then(([w, ex]) => dropStaleCache(w, ex))
      .then((dropped) => live && dropped && setMsg({ ok: true, text: 'Calendario di lavoro cambiato o escluso: cache svuotata, tocca Aggiorna ora.' }))
      .catch((e: unknown) => live && setMsg({ ok: false, text: `Cache non svuotata: ${calendarErrorMessage(e)}` }))
    return () => { live = false }
  }, [calId, excluded])

  const run = (job: () => Promise<string>) => {
    setRunning((n) => n + 1)
    setMsg(null)
    job().then((text) => setMsg({ ok: true, text }), (e: unknown) => {
      if (e instanceof HttpError && e.status === 401) expireToken()
      setMsg({ ok: false, text: calendarErrorMessage(e) })
    }).finally(() => setRunning((n) => n - 1))
  }

  // Il token si chiede prima, dentro il tocco; il client poi usa solo quello in memoria.
  // Impostazioni rilette dal database: durante il caricamento useSetting dà i default (es. primary).
  const refresh = async () => {
    const [cal, zone, ex, fake] = await Promise.all([getSetting('calendar.workId'), getSetting('timeZone'), getSetting('calendar.excluded'), getSetting('dev.fakeCalendar')])
    const client: CalendarClient = DEV && fake ? devFakeCalendar(cal, zone, ex) : googleClient({
      calendarId: cal, timeZone: zone, excluded: ex,
      token: async () => validToken() ?? Promise.reject(new HttpError('http', 'HTTP 401: token scaduto durante la lettura', 401)),
    })
    return resultText(await refreshEvents(client, zone))
  }

  // Nessun await prima di requestToken/getToken: il popup resta dentro il tocco.
  const login = () => run(async () => {
    await requestToken(clientId)
    return `Accesso riuscito. ${await refresh()}`
  })
  const update = () => run(async () => {
    if (!useFake) await getToken(clientId)
    return refresh()
  })
  const toggleFake = (on: boolean) => run(async () => {
    await setSetting('dev.fakeCalendar', on)
    await clearEventCache()
    return on ? 'Uso il finto Calendar: tocca Aggiorna ora.' : 'Uso Google Calendar: accedi e tocca Aggiorna ora.'
  })

  const fmt = (ms: number) => new Date(ms).toLocaleTimeString('it', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
  const needsGis = !useFake && (!clientId || !gisReady)

  return (
    <div className="ui-card ui-stack">
      <h3>Accesso e lettura</h3>
      {DEV && (
        <label className="ui-check">
          <input type="checkbox" checked={fakeSetting} disabled={busy} onChange={(e) => toggleFake(e.target.checked)} />
          <span>Usa il finto Calendar<small>Solo in sviluppo: eventi inventati in memoria, Google non viene toccato.</small></span>
        </label>
      )}
      {!useFake && (
        <p>
          {!tok ? <span className="ui-badge">Non connesso</span>
            : now < tok.expiresAt ? <span className="ui-badge ok">Connesso fino alle {fmt(tok.expiresAt)}</span>
              : <span className="ui-badge warn">Accesso scaduto: si rinnova con Aggiorna ora</span>}
        </p>
      )}
      {!useFake && !clientId && <p className="ui-muted">Scrivi il Client ID qui sopra per accedere a Google.</p>}
      {!useFake && clientId && !gisReady && !gisError && <p className="ui-muted" role="status">Carico l'accesso Google…</p>}
      {!useFake && gisError && (
        <div className="ui-row">
          <p className="ui-error" role="alert">{gisError}</p>
          <button className="ui-btn" onClick={() => setGisError(null)}>Riprova</button>
        </div>
      )}
      <div className="ui-actions set-actions">
        <button className="ui-btn primary" onClick={update} disabled={busy || needsGis}><Icon name="refresh" />Aggiorna ora</button>
        {/* Accedi resta attivo durante l'attesa: se il popup non risponde, un nuovo tocco sostituisce la richiesta appesa. */}
        {!useFake && !tok && <button className="ui-btn" onClick={login} disabled={needsGis}>Accedi con Google</button>}
        {!useFake && tok && <button className="ui-btn ghost" onClick={() => { forgetToken(); setMsg({ ok: true, text: 'Uscito: gli eventi in cache restano visibili.' }) }} disabled={busy}>Esci</button>}
      </div>
      {busy && <p className="ui-muted" role="status">Leggo {useFake ? 'il finto Calendar' : 'Google Calendar'}…</p>}
      {msg && <p className={msg.ok ? undefined : 'ui-error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      <CacheSummary tz={tz} now={now} />
    </div>
  )
}

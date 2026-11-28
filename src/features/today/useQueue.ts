import { useEffect, useState, useSyncExternalStore } from 'react'
import { useSetting } from '../../db/settings'
import { calendarErrorMessage } from '../../lib/calendar/api'
import { expireToken, getToken, isGisLoaded, loadGis, validToken } from '../../lib/calendar/auth'
import { refreshEvents } from '../../lib/calendar/cache'
import { workClient } from '../../lib/calendar/client'
import { describeFlush, flushQueue } from '../../lib/calendar/queue'
import { HttpError } from '../../lib/http'

export interface QueueMsg { ok: boolean; text: string; sent: string[] }
export interface QueueApi { busy: boolean; msg: QueueMsg | null; send: (interactive: boolean) => void; update: () => void }

/** Invio della coda (e, con `refresh`, rilettura di Calendar). null = niente da dire. */
async function work(interactive: boolean, refresh: boolean, tok: Promise<string> | null): Promise<QueueMsg | null> {
  if (tok) await tok
  const w = await workClient()
  // Senza tocco non si apre il popup: senza token valido le azioni aspettano.
  if (!interactive && !w.fake && !validToken()) return null
  const r = await flushQueue({ client: w.client, tz: w.tz })
  if (r.needsLogin) expireToken()
  const sent = r.sent.map((o) => o.toTitle)
  const nothing = !r.sent.length && !r.conflicts.length && !r.rejected.length && !r.left && !r.error
  if (refresh && !r.error) {
    const done = nothing ? '' : `${describeFlush(r)} `
    try {
      await refreshEvents(w.client, w.tz)
    } catch (e) {
      // Il riepilogo dell'invio resta anche se la rilettura fallisce (Domanda 5).
      if (e instanceof HttpError && e.status === 401) expireToken()
      return { ok: false, text: `${done}Calendar non riletto: ${calendarErrorMessage(e)}`, sent }
    }
    return { ok: true, text: `${done}Calendar riletto.`, sent }
  }
  if (!interactive && nothing) return null
  return { ok: !r.error && !r.conflicts.length && !r.rejected.length, text: describeFlush(r), sent }
}

/** Coda per Calendar: invio automatico (apertura e ritorno online), "Invia ora" e "Aggiorna". */
export function useQueue(): QueueApi {
  const fakeSetting = useSetting('dev.fakeCalendar')
  const clientId = useSetting('google.clientId')
  const fake = import.meta.env.DEV && fakeSetting
  const [running, setRunning] = useState(0)
  const [msg, setMsg] = useState<QueueMsg | null>(null)

  const start = (interactive: boolean, refresh: boolean, tok: Promise<string> | null) => {
    if (!interactive && !navigator.onLine) return
    setRunning((n) => n + 1)
    work(interactive, refresh, tok)
      .then((m) => m && setMsg(m), (e: unknown) => {
        if (e instanceof HttpError && e.status === 401) expireToken()
        setMsg({ ok: false, text: calendarErrorMessage(e), sent: [] })
      })
      .finally(() => setRunning((n) => n - 1))
  }

  const go = (interactive: boolean, refresh: boolean) => {
    // Prima di ogni attesa: il popup di Google deve aprirsi dentro il tocco.
    const tok = interactive && !fake ? getToken(clientId) : null
    start(interactive, refresh, tok)
  }

  // Lo script di Google si carica prima del tocco, come in Impostazioni: senza, "Invia ora" e "Aggiorna" fallirebbero (Domanda 4).
  useEffect(() => {
    if (fake || !clientId || isGisLoaded()) return
    let live = true
    loadGis().catch((e: Error) => live && setMsg({ ok: false, text: e.message, sent: [] }))
    return () => { live = false }
  }, [fake, clientId])

  useEffect(() => {
    const auto = () => start(false, false, null)
    auto()
    addEventListener('online', auto)
    return () => removeEventListener('online', auto)
    // Solo al montaggio: `start` usa solo i setter di stato, che non cambiano.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { busy: running > 0, msg, send: (interactive) => go(interactive, false), update: () => go(true, true) }
}

const subscribeOnline = (l: () => void) => {
  addEventListener('online', l)
  addEventListener('offline', l)
  return () => {
    removeEventListener('online', l)
    removeEventListener('offline', l)
  }
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine)
}

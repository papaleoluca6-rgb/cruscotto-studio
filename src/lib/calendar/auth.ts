// Login Google con Google Identity Services (token client). Il token resta solo in memoria: mai su disco.
// requestToken va chiamata direttamente dentro il tocco dell'utente (niente await prima), altrimenti il popup è bloccato.

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const GIS_URL = 'https://accounts.google.com/gsi/client'
/** Tempo massimo per completare il login nel popup (password, verifica in due passaggi…). */
const POPUP_TIMEOUT_MS = 5 * 60_000
/** Il token si considera scaduto un minuto prima della scadenza vera. */
const EXPIRY_MARGIN_MS = 60_000

interface TokenResponse { access_token?: string; expires_in?: number | string; scope?: string; error?: string; error_description?: string }
interface TokenClient { requestAccessToken(o?: { prompt?: string }): void }
interface Oauth2 {
  initTokenClient(c: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type?: string; message?: string }) => void }): TokenClient
  hasGrantedAllScopes(r: TokenResponse, ...scopes: string[]): boolean
}
declare global { interface Window { google?: { accounts?: { oauth2?: Oauth2 } } } }

export interface TokenState { token: string; expiresAt: number }

let current: TokenState | null = null
const listeners = new Set<() => void>()
const setCurrent = (s: TokenState | null) => {
  current = s
  listeners.forEach((l) => l())
}

/** Per useSyncExternalStore. */
export const subscribeToken = (l: () => void) => {
  listeners.add(l)
  return () => void listeners.delete(l)
}
export const tokenState = () => current
export const validToken = (now = Date.now()) => (current && now < current.expiresAt ? current.token : null)
export const forgetToken = () => setCurrent(null)
/** Solo per la prova del rinnovo: il token in memoria risulta scaduto. */
export const expireToken = () => current && setCurrent({ ...current, expiresAt: 0 })

const oauth2 = () => window.google?.accounts?.oauth2
export const isGisLoaded = () => !!oauth2()

let loading: Promise<void> | null = null

/** Carica lo script GIS di Google (servizio di Google, non una libreria). Fallisce con un messaggio chiaro se Google non risponde. */
export function loadGis(timeoutMs = 15_000): Promise<void> {
  if (isGisLoaded()) return Promise.resolve()
  if (loading) return loading
  loading = new Promise<void>((resolve, reject) => {
    // Dopo un timeout lo script resta nella pagina (il download può ancora finire): il nuovo tentativo lo riusa, niente doppioni.
    const old = document.querySelector<HTMLScriptElement>(`script[src="${GIS_URL}"]`)
    const s = old ?? document.createElement('script')
    const fail = (why: string, drop = false) => {
      clearTimeout(timer)
      if (drop) s.remove()
      loading = null
      reject(new Error(`Google non raggiungibile: VPN spenta? (${why})`))
    }
    const timer = setTimeout(() => fail(`nessuna risposta in ${timeoutMs / 1000} s`), timeoutMs)
    s.onerror = () => fail('script di accesso non scaricato', true)
    s.onload = () => {
      clearTimeout(timer)
      if (isGisLoaded()) resolve()
      else fail('script di accesso incompleto', true)
    }
    if (!old) {
      s.src = GIS_URL
      s.async = true
      document.head.appendChild(s)
    }
  })
  return loading
}

let client: TokenClient | null = null
let clientFor = ''
let pending: { resolve: (t: string) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null

const settle = (r: { token: string } | { error: Error }) => {
  const p = pending
  if (!p) return
  pending = null
  clearTimeout(p.timer)
  if ('token' in r) p.resolve(r.token)
  else p.reject(r.error)
}

/** Messaggio in italiano per un errore restituito da Google nel popup. */
export function gisErrorMessage(type: string | undefined, detail?: string): string {
  switch (type) {
    case 'popup_closed':
      return 'Finestra di Google chiusa prima della fine. Se mostrava un errore: VPN spenta o URL dell\'app non tra le origini autorizzate del Client ID.'
    case 'popup_failed_to_open':
      return 'Il popup di Google non si è aperto (bloccato dal browser?). Riprova toccando il pulsante.'
    case 'access_denied':
      return 'Accesso negato: serve il permesso di gestire gli eventi di Calendar.'
    case 'invalid_client':
    case 'unauthorized_client':
      return 'Client ID non valido: controllalo in Impostazioni.'
    default:
      return `Errore di Google${type ? ` (${type})` : ''}${detail ? `: ${detail}` : ''}`
  }
}

function onResponse(r: TokenResponse) {
  if (r.error || !r.access_token) return settle({ error: new Error(gisErrorMessage(r.error ?? 'nessun token', r.error_description)) })
  if (!oauth2()?.hasGrantedAllScopes(r, CALENDAR_SCOPE)) {
    return settle({ error: new Error('Permesso su Calendar non concesso: rifai l\'accesso e lascia spuntato Google Calendar.') })
  }
  const seconds = Number(r.expires_in) || 3600
  setCurrent({ token: r.access_token, expiresAt: Date.now() + seconds * 1000 - EXPIRY_MARGIN_MS })
  settle({ token: r.access_token })
}

/**
 * Apre il popup di Google e restituisce un token nuovo. Da chiamare dentro il tocco dell'utente, senza await prima.
 * `renew`: rinnovo dopo la scadenza (Google non richiede il consenso se già dato).
 */
export function requestToken(clientId: string, renew = false): Promise<string> {
  const o = oauth2()
  if (!o) return Promise.reject(new Error('Accesso Google non ancora caricato: attendi o riprova (VPN accesa?).'))
  if (!clientId) return Promise.reject(new Error('Scrivi prima il Client ID Google qui sopra.'))
  if (!client || clientFor !== clientId) {
    try {
      client = o.initTokenClient({
        client_id: clientId,
        scope: CALENDAR_SCOPE,
        callback: onResponse,
        error_callback: (e) => settle({ error: new Error(gisErrorMessage(e.type, e.message)) }),
      })
      clientFor = clientId
    } catch (e) {
      return Promise.reject(new Error(`Client ID non accettato da Google: ${(e as Error).message}`))
    }
  }
  // GIS ha una sola callback: una risposta in ritardo della richiesta sostituita chiude questa con un token comunque valido.
  settle({ error: new Error('Richiesta sostituita da una nuova.') })
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => settle({ error: new Error('Login non completato in 5 minuti: riprova.') }), POPUP_TIMEOUT_MS)
    pending = { resolve, reject, timer }
    client!.requestAccessToken(renew ? { prompt: '' } : undefined)
  })
}

/** Token valido in memoria, oppure rinnovo con il popup (da chiamare dentro il tocco dell'utente). */
export const getToken = (clientId: string): Promise<string> => {
  const t = validToken()
  return t ? Promise.resolve(t) : requestToken(clientId, current !== null)
}

/** Errore di una richiesta: `timeout`, `network` (rete bloccata, DNS, CORS, VPN) o `http` (risposta con `status`). */
export class HttpError extends Error {
  readonly kind: 'timeout' | 'network' | 'http'
  readonly status?: number
  constructor(kind: 'timeout' | 'network' | 'http', message: string, status?: number) {
    super(message)
    this.name = 'HttpError'
    this.kind = kind
    this.status = status
  }
}

/** Richiesta JSON con timeout ed errori leggibili in italiano. Il timeout copre anche la lettura della risposta. */
async function requestJson<T>(url: string, init: RequestInit, timeoutMs: number, authHint: string): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  let res: Response
  let text: string
  try {
    res = await fetch(url, { ...init, signal: ctrl.signal })
    text = await res.text()
  } catch (e) {
    if (ctrl.signal.aborted) throw new HttpError('timeout', `Timeout: nessuna risposta in ${timeoutMs / 1000} s`)
    throw new HttpError('network', `Server non raggiungibile (rete bloccata, DNS o CORS): ${(e as Error).message}`)
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    let msg = text.slice(0, 200)
    try {
      const j = JSON.parse(text) as { error?: { message?: string } | string; message?: string }
      msg = (typeof j.error === 'string' ? j.error : j.error?.message) ?? j.message ?? msg
    } catch {
      /* risposta non JSON: si usa il testo */
    }
    const hint = res.status === 401 || res.status === 403 ? ` (${authHint})` : ''
    throw new HttpError('http', `HTTP ${res.status}${hint}: ${msg}`, res.status)
  }
  try {
    // Risposta vuota (204, es. DELETE): nessun dato.
    return (text ? JSON.parse(text) : undefined) as T
  } catch {
    throw new HttpError('http', `Risposta non valida (non JSON): ${text.slice(0, 100)}`, res.status)
  }
}

/** POST JSON (provider AI): 401/403 = chiave errata. */
export function postJson<T>(url: string, headers: Record<string, string>, body: unknown, timeoutMs = 20000): Promise<T> {
  return requestJson<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }, timeoutMs,
    'chiave errata o non autorizzata')
}

/** Richiesta a Google (Calendar): 401/403 = token scaduto o permesso mancante. Con `body` lo invia come JSON. */
export function googleJson<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, headers: Record<string, string>, body?: unknown, timeoutMs = 20000): Promise<T> {
  const init: RequestInit = body === undefined ? { method, headers } : { method, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }
  return requestJson<T>(url, init, timeoutMs, 'token scaduto o permesso mancante')
}

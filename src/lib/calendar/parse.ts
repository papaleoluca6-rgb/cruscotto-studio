import type { AppTag, CalEvent, SessionKind, SessionStatus, Subject } from '../../db/schema'
import { zonedToMs } from '../time'
import type { GEvent } from './api'

// Riconoscimento delle sessioni di studio (docs/spec/formato-calendar.md): prima il tag cruscotto=1, poi il titolo.

type SubjectRef = Pick<Subject, 'id' | 'name' | 'prefix'>

export type ReviewStep = '+1d' | '+1w' | '+3w' | 'pre-exam'

export interface SessionInfo {
  status: SessionStatus
  /** Titolo senza prefisso di stato. */
  cleanTitle: string
  /** Vuoto = evento non di studio (lezione, pasto…): mai una sessione, mai toccato dall'app. */
  kind?: SessionKind
  subjectId?: string
  reviewStep?: ReviewStep
  /** Testo dopo i due punti ("argomento", "esercizi", "prova"). */
  topic: string
  appTag: boolean
}

const PREFIX: Record<string, SessionStatus> = { '✅': 'done', '◐': 'partial', '↻': 'moved', '✗': 'skipped' }
const SYMBOL: Partial<Record<SessionStatus, string>> = { done: '✅', partial: '◐', moved: '↻', skipped: '✗' }
const STATUS_RE = /^\s*(✅|◐|↻|✗)️?\s*/u
const KINDS: SessionKind[] = ['study', 'review', 'exercises', 'simulazione', 'pronto', 'vocab']
// Dal solo titolo servono i due punti ("DSP Exercises" senza testo può essere una lezione).
const KIND_RE = /^(study|review(?:\s+(\+1d|\+1w|\+3w|pre-exam))?|exercises|simulazione|pronto)\s*:\s*(.*)$/i
const VOCAB_RE = /^ripasso vocaboli\s*(?::\s*(.*))?$/i
/** Materia dei "Ripasso vocaboli". */
const VOCAB_SUBJECT = 'cinese'

/** Stato dal primo prefisso (il più recente) e titolo senza alcun prefisso. */
export function stripStatus(title: string): { status: SessionStatus; clean: string } {
  let status: SessionStatus | undefined
  let rest = title
  for (let m = STATUS_RE.exec(rest); m; m = STATUS_RE.exec(rest)) {
    status ??= PREFIX[m[1]]
    rest = rest.slice(m[0].length)
  }
  return { status: status ?? 'todo', clean: rest.trim() }
}

/** Titolo con un solo prefisso di stato: il nuovo sostituisce il vecchio ('todo' = nessun prefisso). */
export function withStatus(title: string, status: SessionStatus): string {
  const { clean } = stripStatus(title)
  const s = SYMBOL[status]
  return s ? `${s} ${clean}` : clean
}

const low = (s: string) => s.trim().toLowerCase()

function subjectFor(value: string | undefined, subjects: SubjectRef[]): string | undefined {
  if (!value?.trim()) return undefined
  const v = low(value)
  return (subjects.find((s) => s.id === value) ?? subjects.find((s) => low(s.prefix) === v || low(s.name) === v))?.id
}

/** Riconoscimento dal solo titolo (senza prefisso di stato): richiede una materia configurata, così le lezioni restano fuori. */
function fromTitle(clean: string, subjects: SubjectRef[]): Pick<SessionInfo, 'kind' | 'subjectId' | 'reviewStep' | 'topic'> | null {
  const vocab = VOCAB_RE.exec(clean)
  if (vocab) return { kind: 'vocab', subjectId: subjectFor(VOCAB_SUBJECT, subjects), topic: vocab[1]?.trim() ?? '' }
  const byLength = subjects.filter((s) => s.prefix.trim()).sort((a, b) => b.prefix.trim().length - a.prefix.trim().length)
  for (const s of byLength) {
    const prefix = s.prefix.trim()
    if (!low(clean).startsWith(`${low(prefix)} `)) continue
    const m = KIND_RE.exec(clean.slice(prefix.length).trim())
    if (!m) continue
    const kind = low(m[1]).split(/\s/)[0] as SessionKind
    return { kind, subjectId: s.id, reviewStep: m[2]?.toLowerCase() as ReviewStep | undefined, topic: m[3]?.trim() ?? '' }
  }
  return null
}

export function parseSession(ev: { title: string; tag?: Record<string, string> }, subjects: SubjectRef[]): SessionInfo {
  const { status, clean } = stripStatus(ev.title)
  const t = fromTitle(clean, subjects)
  const appTag = ev.tag?.cruscotto === '1'
  if (!appTag) return t ? { status, cleanTitle: clean, appTag, ...t } : { status, cleanTitle: clean, appTag, topic: '' }
  const tagKind = KINDS.find((k) => k === ev.tag?.tipo)
  return {
    status, cleanTitle: clean, appTag,
    kind: tagKind ?? t?.kind ?? 'study',
    subjectId: subjectFor(ev.tag?.materia, subjects) ?? t?.subjectId,
    reviewStep: t?.reviewStep,
    topic: t?.topic ?? '',
  }
}

/** "Da segnare" = sessione senza prefisso o con ↻, già finita. */
export const needsMarking = (ev: Pick<CalEvent, 'kind' | 'status' | 'end'>, now = Date.now()) =>
  ev.kind !== undefined && (ev.status === 'todo' || ev.status === 'moved') && ev.end <= now

/**
 * Controllo prima di ogni scrittura (righe 04-07): solo sessioni di studio del calendario di lavoro, mai lezioni,
 * altri calendari o esclusi. Lancia un errore con il motivo.
 */
export function assertWritable(ev: Pick<CalEvent, 'kind' | 'calendarId' | 'title'>, workId: string, excluded: string[]): void {
  if (ev.calendarId !== workId || excluded.includes(ev.calendarId)) throw new Error(`"${ev.title}" non è sul calendario di lavoro: non lo modifico.`)
  if (ev.kind === undefined) throw new Error(`"${ev.title}" non è una sessione di studio: non lo modifico.`)
}

export interface Description { material: string; task: string; doneWhen: string; notion?: string; other: string }

const FIELDS: [RegExp, keyof Description][] = [[/^material\s*:/i, 'material'], [/^task\s*:/i, 'task'], [/^done when\s*:/i, 'doneWhen'], [/^notion\s*:/i, 'notion']]

/** Righe Material / Task / Done when / Notion (facoltativa); il resto finisce in `other`. */
export function parseDescription(text: string): Description {
  const d: Description = { material: '', task: '', doneWhen: '', notion: undefined, other: '' }
  const other: string[] = []
  // Google può restituire la descrizione in HTML semplice.
  const lines = text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').split(/\r?\n/)
  for (const line of lines) {
    const f = FIELDS.find(([re]) => re.test(line.trim()))
    if (f) d[f[1]] = line.trim().replace(f[0], '').trim()
    else if (line.trim()) other.push(line.trim())
  }
  d.other = other.join('\n')
  return d
}

const tagOf = (g: GEvent): AppTag | undefined => {
  const p = g.extendedProperties?.private
  return p?.cruscotto === '1' ? { tipo: p.tipo, materia: p.materia } : undefined
}

const timeOf = (t: GEvent['start'], tz: string) => (t?.date ? zonedToMs(t.date, '00:00', tz) : Date.parse(t?.dateTime ?? '') || 0)

/** Evento di Google → riga della cache `events`. */
export function fromGoogle(g: GEvent, calendarId: string, subjects: SubjectRef[], tz: string): CalEvent {
  const tag = tagOf(g)
  const title = g.summary ?? ''
  const base = {
    id: g.id, calendarId, etag: g.etag ?? '', title, tag,
    start: timeOf(g.start, tz), end: timeOf(g.end, tz),
    transparency: g.transparency === 'transparent' ? 'transparent' : 'opaque',
    allDay: !!g.start?.date, description: g.description ?? '', updated: g.updated ?? '',
  } as const
  return reparse(base, subjects)
}

/** Ricalcola i campi riconosciuti (stato, materia, tipo) da titolo e tag: serve quando cambiano le materie. */
export function reparse<T extends Pick<CalEvent, 'title' | 'tag'>>(ev: T, subjects: SubjectRef[]): T & CalEventSession {
  const s = parseSession({ title: ev.title, tag: ev.tag && { cruscotto: '1', ...stripUndefined(ev.tag) } }, subjects)
  return { ...ev, status: s.status, cleanTitle: s.cleanTitle, kind: s.kind, subjectId: s.subjectId, appTag: s.appTag }
}

type CalEventSession = Pick<CalEvent, 'status' | 'cleanTitle' | 'kind' | 'subjectId' | 'appTag'>

const stripUndefined = (t: AppTag) => Object.fromEntries(Object.entries(t).filter(([, v]) => typeof v === 'string')) as Record<string, string>

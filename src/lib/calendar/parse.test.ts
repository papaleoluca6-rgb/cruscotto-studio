import { describe, expect, it } from 'vitest'
import { assertWritable, fromGoogle, needsMarking, nextTitle, parseDescription, parseSession, withStatus } from './parse'

const S = (id: string, prefix: string) => ({ id, name: prefix, prefix })
const subjects = [S('an', 'Analog'), S('com', 'Communication'), S('a2', 'Analisi 2'), S('alp', 'ALP'), S('cpt', 'CPT'), S('dsp', 'DSP'), S('cin', 'Cinese')]
const p = (title: string, tag?: Record<string, string>) => parseSession({ title, tag }, subjects)

describe('formati del titolo', () => {
  it.each([
    ['Analog Study: amplificatori differenziali', 'an', 'study', 'amplificatori differenziali'],
    ['Analisi 2 Study: serie di Fourier', 'a2', 'study', 'serie di Fourier'],
    ['DSP Exercises: es. 3.1-3.8', 'dsp', 'exercises', 'es. 3.1-3.8'],
    ['Communication Simulazione: esame 2024', 'com', 'simulazione', 'esame 2024'],
    ['CPT Pronto: schema del database', 'cpt', 'pronto', 'schema del database'],
    ['ALP Review +1d: puntatori', 'alp', 'review', 'puntatori'],
    ['ALP Review +1w: puntatori', 'alp', 'review', 'puntatori'],
    ['ALP Review +3w: puntatori', 'alp', 'review', 'puntatori'],
    ['ALP Review pre-exam: tutto', 'alp', 'review', 'tutto'],
    ['ALP Review: ripasso libero', 'alp', 'review', 'ripasso libero'],
    ['DSP Exercises:', 'dsp', 'exercises', ''],
  ])('%s', (title, subjectId, kind, topic) => {
    expect(p(title)).toMatchObject({ subjectId, kind, topic, status: 'todo', cleanTitle: title, appTag: false })
  })

  it('passo del ripasso', () => {
    expect(p('ALP Review +3w: puntatori').reviewStep).toBe('+3w')
    expect(p('ALP Review pre-exam: tutto').reviewStep).toBe('pre-exam')
    expect(p('ALP Review: x').reviewStep).toBeUndefined()
  })

  it('Ripasso vocaboli = vocab di Cinese', () => {
    expect(p('Ripasso vocaboli')).toMatchObject({ kind: 'vocab', subjectId: 'cin' })
    expect(p('Ripasso vocaboli: HSK 4')).toMatchObject({ kind: 'vocab', topic: 'HSK 4' })
  })

  it('prefisso più lungo vince (Analisi 2 contro Analisi)', () => {
    const r = parseSession({ title: 'Analisi 2 Study: x' }, [S('a', 'Analisi'), S('a2', 'Analisi 2')])
    expect(r.subjectId).toBe('a2')
  })

  it('maiuscole e spazi tollerati', () => {
    expect(p('analog study:  bjt')).toMatchObject({ subjectId: 'an', kind: 'study', topic: 'bjt' })
  })
})

describe('prefissi di stato', () => {
  it.each([
    ['✅ Analog Study: x', 'done'],
    ['◐ Analog Study: x', 'partial'],
    ['↻ Analog Study: x', 'moved'],
    ['✗ Analog Study: x', 'skipped'],
    ['Analog Study: x', 'todo'],
    ['✅️ Analog Study: x', 'done'],
  ])('%s → %s', (title, status) => {
    expect(p(title)).toMatchObject({ status, cleanTitle: 'Analog Study: x', kind: 'study', subjectId: 'an' })
  })

  it('un solo prefisso: il nuovo sostituisce il vecchio', () => {
    expect(withStatus('Analog Study: x', 'done')).toBe('✅ Analog Study: x')
    expect(withStatus('↻ Analog Study: x', 'done')).toBe('✅ Analog Study: x')
    expect(withStatus('✅ ↻ Analog Study: x', 'partial')).toBe('◐ Analog Study: x')
    expect(withStatus('✗ Analog Study: x', 'todo')).toBe('Analog Study: x')
  })

  it('con più prefissi vale il primo (il più recente)', () => {
    expect(p('✅ ↻ Analog Study: x')).toMatchObject({ status: 'done', cleanTitle: 'Analog Study: x' })
  })
})

describe('eventi non di studio', () => {
  it.each(['Lezione di Analisi 2', 'Pranzo', 'Analog', 'Analog Lab: misure', 'Riunione CPT', 'DSP Exercises', 'Analog Review +1w', ''])('"%s" → tipo vuoto', (title) => {
    const r = p(title)
    expect(r.kind).toBeUndefined()
    expect(r.subjectId).toBeUndefined()
  })

  it('il prefisso di stato non rende di studio una lezione', () => {
    expect(p('✅ Lezione di Analog').kind).toBeUndefined()
  })
})

describe('tag cruscotto=1', () => {
  it('il tag vince sul titolo', () => {
    expect(p('Analog Study: x', { cruscotto: '1', tipo: 'exercises', materia: 'DSP' })).toMatchObject({ appTag: true, kind: 'exercises', subjectId: 'dsp' })
  })

  it('tag con titolo non riconoscibile: resta una sessione', () => {
    expect(p('◐ qualcosa di strano', { cruscotto: '1', tipo: 'review', materia: 'alp' })).toMatchObject({
      appTag: true, kind: 'review', subjectId: 'alp', status: 'partial', cleanTitle: 'qualcosa di strano',
    })
  })

  it('materia nel tag per id o per prefisso; tipo mancante = dal titolo o study', () => {
    expect(p('x', { cruscotto: '1', materia: 'a2' })).toMatchObject({ kind: 'study', subjectId: 'a2' })
    expect(p('DSP Exercises: y', { cruscotto: '1' })).toMatchObject({ kind: 'exercises', subjectId: 'dsp' })
  })

  it('senza cruscotto=1 il tag non conta', () => {
    const r = p('Pranzo', { tipo: 'study', materia: 'DSP' })
    expect(r.appTag).toBe(false)
    expect(r.kind).toBeUndefined()
  })
})

describe('da segnare', () => {
  const now = 1_000_000
  it.each([
    ['todo', now - 1, true],
    ['moved', now - 1, true],
    ['todo', now + 1, false],
    ['done', now - 1, false],
    ['partial', now - 1, false],
    ['skipped', now - 1, false],
  ] as const)('%s, fine %d → %s', (status, end, out) => {
    expect(needsMarking({ kind: 'study', status, end }, now)).toBe(out)
  })

  it('un evento non di studio non è mai da segnare', () => {
    expect(needsMarking({ kind: undefined, status: 'todo', end: now - 1 }, now)).toBe(false)
  })
})

describe('nextTitle (azioni della coda, riga 04)', () => {
  it.each([
    ['DSP Study: FFT', 'done', '✅ DSP Study: FFT'],
    ['↻ DSP Study: FFT', 'done', '✅ DSP Study: FFT'],
    ['DSP Study: FFT', 'skip', '✗ DSP Study: FFT'],
    ['↻ DSP Study: FFT', 'skip', '✗ DSP Study: FFT'],
    ['✅ DSP Study: FFT', 'undo', 'DSP Study: FFT'],
    ['✗ ◐ DSP Study: FFT', 'undo', 'DSP Study: FFT'],
    ['✅ DSP Study: FFT', 'skip', '✗ DSP Study: FFT'],
  ] as const)('%s + %s → %s', (title, action, out) => {
    expect(nextTitle(title, action)).toBe(out)
  })
})

describe('assertWritable', () => {
  const ev = (kind?: 'study', calendarId = 'w') => ({ kind, calendarId, title: 't' })
  it('solo sessioni del calendario di lavoro non escluso', () => {
    expect(() => assertWritable(ev('study'), 'w', [])).not.toThrow()
    expect(() => assertWritable(ev(undefined), 'w', [])).toThrow(/non è una sessione/)
    expect(() => assertWritable(ev('study', 'altro'), 'w', [])).toThrow(/calendario di lavoro/)
    expect(() => assertWritable(ev('study'), 'w', ['w'])).toThrow(/calendario di lavoro/)
  })
})

describe('descrizione', () => {
  it('quattro righe con Notion', () => {
    const d = parseDescription('Material: slide 3, pp. 10-20\nTask: rifare gli esempi\nDone when: so spiegare il teorema\nNotion: https://notion.so/x')
    expect(d).toEqual({ material: 'slide 3, pp. 10-20', task: 'rifare gli esempi', doneWhen: 'so spiegare il teorema', notion: 'https://notion.so/x', other: '' })
  })

  it('senza Notion e con righe in più', () => {
    const d = parseDescription('Material: libro cap. 2\r\nTask: esercizi pari\nDone when: tutti fatti\nnota libera')
    expect(d).toEqual({ material: 'libro cap. 2', task: 'esercizi pari', doneWhen: 'tutti fatti', notion: undefined, other: 'nota libera' })
  })

  it('HTML di Google (<br>) e descrizione vuota', () => {
    expect(parseDescription('Material: a<br>Task: b<br/>Done when: c')).toMatchObject({ material: 'a', task: 'b', doneWhen: 'c' })
    expect(parseDescription('')).toEqual({ material: '', task: '', doneWhen: '', notion: undefined, other: '' })
  })
})

describe('fromGoogle', () => {
  it('evento con orario, etag e tag', () => {
    const ev = fromGoogle({
      id: 'e1', etag: '"1"', summary: '↻ DSP Study: FFT', description: 'Task: x', updated: '2026-11-19T01:00:00Z',
      start: { dateTime: '2026-11-19T09:00:00+08:00' }, end: { dateTime: '2026-11-19T10:30:00+08:00' },
      extendedProperties: { private: { cruscotto: '1', tipo: 'study', materia: 'DSP' } },
    }, 'primary', subjects, 'Asia/Shanghai')
    expect(ev).toMatchObject({
      id: 'e1', etag: '"1"', calendarId: 'primary', title: '↻ DSP Study: FFT', cleanTitle: 'DSP Study: FFT', status: 'moved',
      kind: 'study', subjectId: 'dsp', appTag: true, allDay: false, transparency: 'opaque', description: 'Task: x',
      start: Date.UTC(2026, 10, 19, 1), end: Date.UTC(2026, 10, 19, 2, 30), tag: { tipo: 'study', materia: 'DSP' },
    })
  })

  it('tutto il giorno, trasparente, senza titolo', () => {
    const ev = fromGoogle({ id: 'e2', etag: '"2"', start: { date: '2026-11-20' }, end: { date: '2026-11-21' }, transparency: 'transparent' },
      'primary', subjects, 'Asia/Shanghai')
    expect(ev).toMatchObject({ allDay: true, transparency: 'transparent', title: '', kind: undefined, appTag: false,
      start: Date.UTC(2026, 10, 19, 16), end: Date.UTC(2026, 10, 20, 16) })
  })
})

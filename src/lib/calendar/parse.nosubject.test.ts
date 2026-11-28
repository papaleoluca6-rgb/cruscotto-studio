import { describe, expect, it } from 'vitest'
import { parseSession } from './parse'

// Titoli veri senza materie configurate (Impostazioni → Materie vuota): il titolo basta.
const S = (id: string, prefix: string) => ({ id, name: prefix, prefix })
const p = (title: string) => parseSession({ title }, [S('an', 'Analog')])

describe('materia non configurata: il titolo basta', () => {
  const none = (title: string) => parseSession({ title }, [])
  it.each([
    ['ALP Study: Ch2 recursion (slides 42-47)', 'study', undefined, 'Ch2 recursion (slides 42-47)'],
    ['Analisi 2 Review +1d: Taylor and extrema', 'review', '+1d', 'Taylor and extrema'],
    ['Communication Review +1w: Ch02 (Fourier)', 'review', '+1w', 'Ch02 (Fourier)'],
    ['Analog Exercises: BJT (E5.4-E5.6, P5.20)', 'exercises', undefined, 'BJT (E5.4-E5.6, P5.20)'],
    ['CPT Pronto: week 10 (boundary simulator + loss-injection)', 'pronto', undefined, 'week 10 (boundary simulator + loss-injection)'],
    ['Fisica Simulazione: esame 2024', 'simulazione', undefined, 'esame 2024'],
  ])('%s', (title, kind, reviewStep, topic) => {
    const r = none(title)
    expect(r).toMatchObject({ kind, topic, status: 'todo', cleanTitle: title, appTag: false })
    expect(r.subjectId).toBeUndefined()
    expect(r.reviewStep).toBe(reviewStep)
  })

  it('con il prefisso di stato', () => {
    expect(none('✅ ALP Study: x')).toMatchObject({ status: 'done', kind: 'study', cleanTitle: 'ALP Study: x' })
  })

  it('una materia configurata resta collegata', () => {
    expect(p('Fisica Study: x')).toMatchObject({ kind: 'study', subjectId: undefined })
    expect(p('Analog Study: x')).toMatchObject({ kind: 'study', subjectId: 'an' })
  })

  it.each([
    'Lezione di Neuroelettronica', 'Recovery slot: catch-up for sessions that slipped this week',
    'Scadenza CPT sett.10: boundary simulator + loss-injection (entro 23:59)', 'Principles of Communications (settimane pari)',
    'Study: senza materia', 'Review +1d: senza materia', 'DSP Exercises', 'Lezione: Segnali e sistemi', 'Pranzo', 'Analog Lab: misure',
  ])('"%s" → resta fuori', (title) => {
    expect(none(title).kind).toBeUndefined()
  })
})

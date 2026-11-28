import { countdownText, fmtHours, type DaySummary } from './today'

export function Summary({ day, exams, cards, exercises }: { day: DaySummary; exams: { name: string; days: number }[]; cards: number; exercises: number }) {
  const stats: [string, string | number][] = [
    ['Ore di oggi', `${fmtHours(day.doneMin)} su ${fmtHours(day.plannedMin)} h`],
    ['Da segnare', day.toMark],
    ['Flashcard da ripassare', cards],
    ['Esercizi da fare', exercises],
  ]
  return (
    <section className="ui-card today-summary" aria-label="Riepilogo">
      {stats.map(([label, value]) => (
        <div className="today-stat" key={label}>
          <span className="ui-muted">{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
      <p className="today-exams">
        {exams.length
          ? `Esami: ${exams.map((x) => `${x.name} ${countdownText(x.days)}`).join(' · ')}`
          : <span className="ui-muted">Nessuna data d'esame: aggiungila in Impostazioni → Materie.</span>}
      </p>
    </section>
  )
}

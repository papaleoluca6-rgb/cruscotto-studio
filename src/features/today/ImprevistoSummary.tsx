import type { ImprevistoItem } from '../../lib/planner/moves'
import { whenText } from './when'

/** Elenco di ogni sessione toccata: vecchio → nuovo orario, oppure il motivo per cui resta. */
export function ImprevistoList({ items, tz }: { items: ImprevistoItem[]; tz: string }) {
  if (!items.length) return <p className="ui-muted">Nessuna sessione da spostare.</p>
  return (
    <ul className="ui-stack">
      {items.map(({ ev, slot, reason }) => (
        <li key={ev.id}>
          {ev.cleanTitle || '(senza titolo)'}: {whenText(ev.start, ev.end, false, tz, true)}
          {slot ? ` → ${whenText(slot.start, slot.end, false, tz, true)}` : ` (${reason})`}
        </li>
      ))}
    </ul>
  )
}

/** Riepilogo esatto dopo la conferma. */
export function ImprevistoSummary({ what, items, tz, onClose }: { what: string; items: ImprevistoItem[]; tz: string; onClose: () => void }) {
  const moved = items.filter((i) => i.slot)
  const kept = items.filter((i) => !i.slot)
  return (
    <div className="ui-dialog" role="dialog" aria-modal="true" aria-labelledby="imp-summary-title">
      <div className="ui-dialog-box ui-stack">
        <h2 id="imp-summary-title">Imprevisto in coda</h2>
        <p>Evento «Imprevisto: {what.trim()}» in coda.</p>
        <p>Sessioni spostate: {moved.length}.</p>
        {moved.length > 0 && <ImprevistoList items={moved} tz={tz} />}
        {kept.length > 0 && (
          <>
            <p>Sessioni non spostate: {kept.length}.</p>
            <ImprevistoList items={kept} tz={tz} />
          </>
        )}
        <p className="ui-muted">L'esito dell'invio è nella barra della coda.</p>
        <div className="ui-actions">
          <button className="ui-btn primary" onClick={onClose}>Chiudi</button>
        </div>
      </div>
    </div>
  )
}

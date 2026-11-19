# 07 Ricalibro deterministico (`features/recalibrate/`)

**Obiettivo**: riordinare i prossimi 7-10 giorni di studio senza AI.
**Leggere**: `formato-calendar.md`, `lib/planner/weights.ts` (riga 06), `lib/planner/findSlot.ts` (riga 05), `lib/calendar/api.ts`, `lib/calendar/queue.ts` (riga 04), schema (`recalibrations`).

## Uscita: lista di operazioni
- Si avvia dal pulsante "Ricalibra" nella scheda Materie. Opera su tutte le sessioni create dall'app, compresi vocab (cinese) e pronto (CPT Pronto); la regola 3 (quote) conta solo le materie che entrano nelle quote (riga 06).
- Scritture (insert/patch/delete) tramite la coda `lib/calendar/queue.ts` con If-Match; 412 → di nuovo anteprima.
- Operazioni `move`, `update`, `create`, `delete` sugli eventi di studio dei prossimi 7-10 giorni.
- Anteprima (prima → dopo) e applicazione solo dopo conferma, una operazione alla volta, con un riepilogo.
- Se un'operazione fallisce: riepilogo esatto di cosa è riuscito e cosa no, mai dati a metà senza dirlo.
- Il tipo operazione vive in `lib/planner/`: `tipo` (move|update|create|delete), `eventId`, campi nuovi, `motivo`. Stessa uscita per il ricalibro AI (riga 09), che lo importa da lì.

## Regole (`lib/planner/`, pure)
1. Rimettere in ordine logico Study → Exercises → Review della stessa materia. Exercises e Review si collegano allo Study precedente più vicino della stessa materia (Review: stesso argomento; Exercises: stessa materia).
2. Spostare i ripassi che cadono prima del loro studio.
3. Riportare ogni materia entro ±20% delle ore consigliate (da `weights.ts`), scambiando o accorciando sessioni; durate attese col fattore di `stime.ts` (riga 06).
   - Blocco minimo 30 min (impostazione, predefinito da tarare): mai sessioni più corte.
   - Se il piano non ci sta (verdetto di `capacita.ts`), l'anteprima propone di togliere o accorciare per prime le sessioni delle materie con punteggio più basso, ognuna con il suo `motivo`; mai in silenzio, mai senza conferma.
4. Eventi non di studio: solo occupati, mai toccati; mai calendari esclusi.
- **Test prima del codice** per le regole 1-4, ciascuna con un caso positivo e uno che non deve cambiare nulla; più blocco minimo e piano che non ci sta (taglia prima il punteggio più basso).

## Salvataggio
- Ogni ricalibro va salvato in `recalibrations`: data, metodo (deterministico), proposta (lista di operazioni), applicata sì/no, riepilogo.

## Fatto quando
- Dal finto Calendar esce una proposta, l'anteprima mostra le differenze, l'applicazione scrive una operazione alla volta con riepilogo e salva la riga in `recalibrations`.
- Build, lint, test; revisione con sub-agente; ROADMAP aggiornata.

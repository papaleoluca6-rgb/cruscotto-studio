# 07 Ricalibro deterministico

**Obiettivo**: riordinare i prossimi 7-10 giorni di studio senza AI.
**Leggere**: `formato-calendar.md`, `planner/weights.ts` (riga 06), `planner/findSlot.ts` (riga 05), `lib/calendar/api.ts`, schema (`recalibrations`).

## Uscita: lista di operazioni
- Operazioni `move`, `update`, `create`, `delete` sugli eventi di studio dei prossimi 7-10 giorni.
- Anteprima (prima → dopo) e applicazione solo dopo conferma, una operazione alla volta, con un riepilogo.
- Se un'operazione fallisce: riepilogo esatto di cosa è riuscito e cosa no, mai dati a metà senza dirlo.
- Stessa uscita per il ricalibro AI (riga 09).

## Regole (`planner/`, pure)
1. Rimettere in ordine logico Study → Exercises → Review della stessa materia e argomento.
2. Spostare i ripassi che cadono prima del loro studio.
3. Riportare ogni materia entro ±20% delle ore consigliate (da `weights.ts`), scambiando o accorciando sessioni.
4. Non toccare scadenze, lezioni e calendari esclusi.
- **Test prima del codice** per le regole 1-4, ciascuna con un caso positivo e uno che non deve cambiare nulla.

## Salvataggio
- Ogni ricalibro va salvato in `recalibrations`: data, metodo (deterministico), proposta (lista di operazioni), applicata sì/no, riepilogo.

## Fatto quando
- Dal finto Calendar esce una proposta, l'anteprima mostra le differenze, l'applicazione scrive una operazione alla volta con riepilogo e salva la riga in `recalibrations`.
- Build, lint, test; revisione con sub-agente; ROADMAP aggiornata.

# 04 Scheda Oggi

**Obiettivo**: vedere le sessioni e segnarle Fatto / Salta / Annulla, anche offline.
**Leggere**: `formato-calendar.md`, `lib/calendar/api.ts` e `fake.ts` (riga 03).

## Riepilogo
- Ore fatte su ore pianificate oggi, sessioni da segnare, flashcard scadute, esercizi mancanti, giorni agli esami.
- Flashcard scadute ed esercizi mancanti si leggono da `db/` (le schede arrivano nella riga 08; prima, zero).

## Liste
- Da segnare (ultimi 7 giorni; senza prefisso o con ↻, fine nel passato), Oggi, Domani, Prossimi giorni (comprimibile).
- Tocco sul titolo = mostra la descrizione.

## Azioni su ogni sessione
Ogni scrittura su Calendar con anteprima del nuovo titolo e conferma.
- **Fatto** → chiede i minuti reali (precompilati con i pianificati), prefisso ✅ + log.
- Su una sessione Review, pulsante **Ripasso argomento** (riga 08, via shell `app/`); nascosto finché la riga 08 non c'è.
- **Salta** → prefisso ✗ + log.
- **Annulla segno** → toglie il prefisso e il log; passa anch'esso dalla coda con If-Match, come le altre azioni.
- **Flashcard** → apre il generatore con l'argomento della sessione. Si aggiunge nella riga 08 (non qui).
- Non fatto, Parziale e Imprevisto: riga 05.
- Ogni salvataggio o scrittura fallita si mostra all'utente.

## Coda offline (`lib/calendar/queue.ts`)
- La coda vive in `lib/calendar/queue.ts`; la usano anche le righe 05 e 07.
- Le azioni fatte offline restano in coda (in `db/`) e si inviano alla riconnessione.
- Ogni invio usa `If-Match: <etag>` con l'`etag` dell'evento in cache.
- Se Google risponde 412 (l'evento è cambiato) l'operazione non parte: torna in anteprima, rilegge l'evento e l'utente riconferma.
- Dopo l'invio, aggiornare l'`etag` in cache. Mostrare quante azioni sono in coda e il riepilogo esatto di cosa è partito e cosa no.

## Test prima
- Logica della coda (ordine, invio, 412 → anteprima, errore di rete lascia in coda) con il finto Calendar.

## Fatto quando
- Si segna Fatto / Salta / Annulla con il finto e con il vero Calendar, il log si scrive, offline le azioni si accodano e partono alla riconnessione.
- Build, lint, test; revisione con sub-agente; ROADMAP aggiornata.

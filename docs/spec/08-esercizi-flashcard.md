# 08 Esercizi e flashcard

**Obiettivo**: tenere gli esercizi d'esame e ripassare le flashcard con Leitner, senza AI.
**Leggere**: `src/db/schema.ts` (`exercises`, `cards`, `subjects`).

## Esercizi (`features/exercises/`)
- Elenco per materia con tre stati: Da fare / Con soluzione / Da solo (nel modello: todo / sol / solo).
- "Con soluzione" vale metà nella barra di avanzamento.
- Filtri per materia e "non ancora da solo"; modulo per aggiungerne uno.
- Import da JSON per inizializzare la lista; ogni import o salva o dà un riepilogo esatto.

## Flashcard (`features/flashcards/`)
- Mazzi per materia con il conteggio delle carte scadute.
- Ripasso Leitner con quattro tasti:
  - Di nuovo → torna in coda, scatola 1;
  - Difficile → stessa scatola, scadenza +1 giorno dalla data del ripasso;
  - Bene → scatola +1;
  - Facile → scatola +2.
- Intervalli per scatola: 1/2/4/8/16 giorni.
- Aggiunta manuale sempre disponibile.
- **Test prima del codice** per `lib/planner/leitner.ts` (pura): ogni tasto da ogni scatola, limite scatola 5, scadenza.

## Pulsante Flashcard della scheda Oggi
- Si aggiunge qui: sulla sessione apre il generatore/aggiunta con l'argomento della sessione (campo `argomento` della carta).
- Senza AI apre l'aggiunta manuale precompilata con l'argomento. "Genera" arriva nella riga 09.
- Collegare anche i dati del riepilogo della riga 04 (flashcard scadute, esercizi mancanti).

## Dati iniziali
- Import da JSON di esercizi e carte (esportati dal cruscotto attuale, vedi `01-base.md`, "Dati iniziali"): stesso meccanismo dell'import esercizi.

## Fatto quando
- Si aggiungono e ripassano le carte, gli stati degli esercizi cambiano, l'import JSON funziona; il pulsante Flashcard è nella scheda Oggi.
- Build, lint, test; revisione con sub-agente; ROADMAP aggiornata.

# 08 Esercizi e flashcard

**Obiettivo**: tenere gli esercizi d'esame e ripassare le flashcard con FSRS, senza AI.
**Leggere**: `src/db/schema.ts` (`exercises`, `cards`, `revlog`, `subjects`).

## Esercizi (`features/exercises/`)
- Elenco per materia con tre stati: Da fare / Con soluzione / Da solo (nel modello: todo / sol / solo).
- "Con soluzione" vale metà nella barra di avanzamento.
- Filtri per materia e "non ancora da solo"; modulo per aggiungerne uno.
- Import da JSON per inizializzare la lista; ogni import o salva o dà un riepilogo esatto.

## Flashcard (`features/flashcards/`)
- Mazzi per materia con il conteggio delle carte scadute.
- Ripasso FSRS con `ts-fsrs` fissata a una 5.4.x (MIT, offline; non la 6.0.0). Wrapper puro `lib/planner/fsrs.ts`: nuova carta, `next(carta, ora, voto)`, ritenzione desiderata dalle impostazioni (default 0,9).
- Quattro tasti = voti: Di nuovo 1, Difficile 2, Bene 3, Facile 4. Ogni ripasso aggiorna i campi FSRS della carta e scrive una riga in `revlog` (voto, stato prima/dopo, minuti) nella stessa transazione.
- Aggiunta manuale sempre disponibile. Carte solo locali: mai un evento Calendar per carta.
- **Test prima del codice** per `fsrs.ts`: ogni voto da carta nuova e da carta in revisione, scadenza futura, ritenzione che cambia l'intervallo, riga `revlog`.
- **Ripasso argomento**: da una sessione Review (pulsante nella riga 04, o da qui) apre le carte scadute di quell'`argomento` più gli esercizi della materia con `argomento` uguale non ancora "da solo" (campo `argomento` anche negli esercizi).

## Pulsante Flashcard della scheda Oggi
- Si aggiunge qui: sulla sessione apre la scheda Flashcard tramite la shell `app/` (scheda + parametro argomento), senza importare `features/flashcards` da `features/today`; apre il generatore/aggiunta con l'argomento della sessione (campo `argomento` della carta).
- Senza AI apre l'aggiunta manuale precompilata con l'argomento. "Genera" arriva nella riga 09.
- Collegare anche i dati del riepilogo della riga 04 (flashcard scadute, esercizi mancanti).

## Dati iniziali
- Un solo JSON (dal cruscotto attuale, vedi `01-base.md`, "Dati iniziali") con esercizi, carte e materie. Le vecchie carte (scatola Leitner, scadenza) diventano carte FSRS nuove con `due` = vecchia scadenza; gli altri campi vecchi si ignorano. Campi: campi difficoltà, importanza, data esame, profAt, meAt. Stesso meccanismo dell'import esercizi.
- Il JSON con dati reali resta fuori dal repository: aggiungere `dati/` a `.gitignore`.

## Fatto quando
- Si aggiungono e ripassano le carte, gli stati degli esercizi cambiano, l'import JSON funziona; il pulsante Flashcard è nella scheda Oggi.
- Build, lint, test; revisione con sub-agente; ROADMAP aggiornata.

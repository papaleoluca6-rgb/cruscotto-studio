# 11 Timer e riepilogo settimanale

**Obiettivo**: minuti reali senza fatica e uno sguardo settimanale a ciò che è successo contro ciò che era previsto.
**Leggere**: `src/db/schema.ts` (`log`, `events`, `subjects`), `features/today/` (riga 04), `lib/planner/stime.ts` (riga 06), `features/settings/`.

## Timer (`features/timer/`)
- Facoltativo, per sessione: cronometro (o flowtime: si ferma quando si vuole). Nessun Pomodoro imposto, nessun rituale obbligatorio.
- Lo stato (avvio, pause) sta in `db.settings` (`timer.<eventId>`): sopravvive a chiusura e offline.
- Alla fine i minuti passano alla scheda Oggi come valore precompilato di "minuti reali" (righe 04/05); l'utente può sempre correggerli.
- Si usa solo l'ora del dispositivo; nessuna notifica push.

## Riepilogo settimanale (`features/week/`)
- Per materia: ore fatte contro pianificate; stima contro reale (fattore di `stime.ts`); sessioni saltate o spostate.
- 2-3 domande di riflessione, a risposta libera, salvate in locale (nota della settimana); la riflessione non entra nel punteggio né nel ricalibro, e non si chiede subito dopo una sessione.
- Un solo contatore settimanale ("sessioni fatte questa settimana"), neutro.
- Alimenta "Copia riepilogo per Notion" (riga 10).
- **Test prima del codice** per le somme per materia e per il confronto stima/reale (pure, in `lib/planner/`).

## Da evitare
- Streak giornaliere, contatori rossi, notifiche serali "a rischio": le serie rotte demotivano.
- Classifiche sociali; autovalutazione mescolata in silenzio nella prontezza.

## Fatto quando
- Il timer riempie i minuti reali, il riepilogo mostra i dati del finto Calendar e del log.
- Build, lint, test; revisione con sub-agente; ROADMAP aggiornata.

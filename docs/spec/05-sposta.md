# 05 Sposta: findSlot, Non fatto, Parziale, Imprevisto

**Obiettivo**: spostare le sessioni nel primo spazio libero.
**Leggere**: `formato-calendar.md`, `lib/calendar/api.ts` e `fake.ts` (riga 03), `lib/time.ts`. Le azioni stanno nella scheda Oggi (riga 04).

## `planner/findSlot.ts` (funzione pura)
- Occupato = tutti gli eventi con orario del calendario di lavoro (anche lezioni, pasti, sport) ± margine (default 5 min), tranne quelli con disponibilità "libero".
- Cerca a passi di 15 minuti, dentro la finestra di studio (default 08:00-22:45), per 12 giorni, a partire da adesso + 20 minuti.
- **Test prima del codice**: evento che occupa la finestra, margine, evento "libero" ignorato, fine giornata, nessuno spazio entro 12 giorni, fuso orario.

## Azioni (tutte con anteprima e conferma)
- **Non fatto** → calcola il primo spazio libero e lo mostra; sposta solo dopo conferma, prefisso ↻ + log. Se lo spazio è a più di 3 giorni, suggerisce "Parziale" o il ricalibro.
- **Parziale** → percentuale (25/50/75) + "dove sono arrivato" → prefisso ◐, log. Crea una sessione "(resto)" con durata proporzionale (minimo 30 min) nel primo spazio libero, con "Resume from: …" in testa alla descrizione. Usa `events.insert`.
- **Imprevisto**: giorno, dalle, alle, cosa → crea l'evento "Imprevisto: …" e sposta le sessioni che ci cadono dentro, con un riepilogo finale.

## Operazioni a più passi
- Imprevisto sposta più sessioni: o tutto o un riepilogo esatto di cosa è riuscito. Mai dati a metà senza dirlo.
- Un errore di scrittura si mostra all'utente.

## Fatto quando
- Non fatto, Parziale e Imprevisto funzionano con il finto Calendar e con il vero, con anteprima.
- Test di `findSlot` passano; build, lint, test; revisione con sub-agente; ROADMAP aggiornata.

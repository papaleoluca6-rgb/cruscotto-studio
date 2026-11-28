# Roadmap

Note di lavoro nei messaggi di commit, non qui.

Stato: ⬜ da fare · 🟨 in corso · ✅ fatto
Effort: alto = piano con Opus, revisore Sonnet; medio = tutto Sonnet, revisore Haiku.
Delega: scritta a inizio riga con i criteri di `CLAUDE.md` ("diretto: motivo" · "esecutore: motivo" · "lotto: due sessioni").

| # | Funzionalità | Spec | Stato | Effort | Delega | Nota |
|---|---|---|---|---|---|---|
| 01 | Base: scaffolding, Vitest, impostazioni, materie, backup | [01-base](spec/01-base.md) | ✅ | medio | — | Backup senza cache eventi; import rispetta le lapidi |
| 02 | Prova del login Google su telefono | [02-prova-login](spec/02-prova-login.md) | ✅ | alto | — | PWA Android: popup GIS ok, rinnovo senza perdere stato, events.list ok, VPN spenta segnalata |
| 03 | Client Calendar, cache, parse, finto Calendar | [03-calendar](spec/03-calendar.md) | 🟨 | alto | diretto: codice già scritto, restano verifica e revisione | Finto Calendar ok (completa + incrementale, riconoscimento); manca la prova sul Calendar vero |
| 04 | Scheda Oggi, Fatto/Salta/Annulla, coda offline | [04-oggi](spec/04-oggi.md) | ⬜ | medio | | |
| 05 | Sposta: findSlot, Non fatto, Parziale, Imprevisto | [05-sposta](spec/05-sposta.md) | ⬜ | alto | | |
| 06 | Materie e pesi | [06-pesi](spec/06-pesi.md) | ⬜ | medio | | |
| 07 | Ricalibro deterministico | [07-ricalibro](spec/07-ricalibro.md) | ⬜ | alto | | |
| 08 | Esercizi e flashcard (FSRS) | [08-esercizi-flashcard](spec/08-esercizi-flashcard.md) | ⬜ | medio | | |
| 09 | Provider AI, ricalibro e flashcard con AI | [09-ai](spec/09-ai.md) | ⬜ | medio | | |
| 10 | Rifiniture: riepilogo Notion, test su telefono, tablet, PC | [10-rifiniture](spec/10-rifiniture.md) | ⬜ | medio | | |
| 11 | Timer e riepilogo settimanale | [11-timer-settimana](spec/11-timer-settimana.md) | ⬜ | medio | | |
| 12 | Sincronizzazione tra dispositivi (Drive) | [12-sync-drive](spec/12-sync-drive.md) | ⬜ | alto | | |

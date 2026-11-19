# 10 Rifiniture

**Obiettivo**: riepilogo per Notion e prova su tutti i dispositivi.
**Leggere**: `features/settings/`, `features/recalibrate/`, schema (`recalibrations`).

## Copia riepilogo per Notion
- L'API di Notion non accetta chiamate dirette dal browser senza backend: niente integrazione diretta (regola "niente backend").
- Pulsante **"Copia riepilogo per Notion"**: Markdown con stato per materia, piano dei prossimi 10 giorni, ultimo ricalibro.
- Da incollare a mano o da passare a Claude.
- La riga 11 estende la copia con il riepilogo settimanale.
- Se la copia negli appunti fallisce, mostrarlo e offrire il testo da selezionare.
- Test della funzione che costruisce il Markdown (pura).

## Test su telefono, tablet e PC
- Telefono: USB, `chrome://inspect` → Port forwarding `5173 → localhost:5173` (vedi CLAUDE.md), poi anche l'app installata dalla versione pubblicata.
- Tablet Android e PC (Chrome): schede, tap target ≥ 44px, layout.
- Offline: aprire l'app con rete spenta, azioni in coda, ripresa alla riconnessione.
- Con VPN spenta e accesa: messaggi giusti.
- Aggiornamento PWA solo su conferma.

## Fatto quando
- Riepilogo copiato e leggibile in Notion; elenco dei problemi trovati sui tre dispositivi risolto o annotato.
- Build, lint, test; revisione con sub-agente; ROADMAP aggiornata.

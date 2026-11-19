# 03 Client Calendar, cache, parse, finto Calendar

**Obiettivo**: leggere e scrivere eventi su Google Calendar, con cache locale e riconoscimento delle sessioni di studio.
**Leggere**: `formato-calendar.md`, `lib/calendar/auth.ts` (riga 02), `lib/http.ts`.
**Crea anche**: `lib/time.ts` (date nel fuso dell'utente, usato dalle chiamate Calendar).
**Login**: riga 02, già fatta. Qui i pulsanti di prova della riga 02 nelle Impostazioni si sostituiscono con login/logout e "Aggiorna ora".

## Lettura (`api.ts`)
- `events.list` con `singleEvents=true`, `orderBy=startTime`, finestra da -7 a +15 giorni, paginazione.
- In cache tutti gli eventi del calendario di lavoro, anche non di studio (tipo vuoto), con `transparency` e se è tutto il giorno; "ignorati" = non sono sessioni. Si legge solo il calendario di lavoro; i calendari esclusi non si leggono né scrivono.
- Le risposte vanno in cache in `events`: l'app si apre anche offline e mostra quando è stata aggiornata l'ultima volta.
- Ogni evento in cache conserva l'`etag` e lo espone: serve alla coda offline (riga 04).
- **Aggiornamento incrementale**: la prima lettura completa salva `nextSyncToken`; poi `events.list` con `syncToken` applica solo le modifiche (cancellati = tolti dalla cache). Su 410 si scarta il token e si rilegge tutto. Il `syncToken` non si combina con `timeMin`/`orderBy`/`privateExtendedProperty`: finestra e ordine si applicano alla cache.

## Scrittura (`api.ts`)
- Ogni evento creato o spostato porta `extendedProperties.private` (`cruscotto=1`, `tipo`, `materia`) e i promemoria popup (`reminders.overrides`, minuti dalle impostazioni, default 10); vedi `formato-calendar.md`. Mai `colorId` per lo stato.
- `list` accetta `privateExtendedProperty=cruscotto=1` per i soli eventi dell'app (es. prima di un `delete`).
- `events.patch` (titolo, orari), `events.insert` (resto, imprevisto), `events.delete` (solo dal ricalibro, solo eventi di studio).
- Sempre con `timeZone` e `sendUpdates=none`.
- Interfaccia del client: `list`, `get`, `patch`, `insert`, `delete`; `patch` e `delete` accettano `ifMatch` (etag, header `If-Match`). Le scritture le chiama solo chi ha già mostrato anteprima e conferma.

## Errori (messaggi specifici, mai in silenzio)
- 401 → rifare login (token scaduto).
- 403 → permessi o quota.
- 412 → etag non coincide: errore tipizzato nel client (lo gestisce la coda, riga 04).
- Rete → "VPN spenta?".
- Timeout su ogni richiesta, risposta compresa (`lib/http.ts`).

## `parse.ts`
- Prima il tag `cruscotto=1`; il titolo resta il fallback per eventi fatti a mano o da Claude. Riconosce titolo, prefisso di stato, materia (dal prefisso configurato), tipo (study/review/exercises/simulazione/pronto/vocab), titolo pulito e descrizione, secondo `formato-calendar.md`.
- "Da segnare" = senza prefisso o con ↻, con fine nel passato. Un solo prefisso per titolo: il nuovo sostituisce il vecchio.
- **Test prima del codice** (Vitest): un caso per ogni formato di titolo, per ogni prefisso, `Simulazione`, evento con tag e titolo non riconoscibile, titoli non di studio (lezioni, pasti: tipo vuoto, non sessioni), prefisso ↻ da segnare, un solo prefisso, descrizione con e senza `Notion:`.

## Finto Calendar (`fake.ts`)
- Stessa interfaccia del client (`list`, `get`, `patch`, `insert`, `delete`), con `extendedProperties`, `reminders` e `syncToken` (410 su token scaduto), eventi di esempio inventati (nessun dato reale, repo pubblico) in memoria (con `etag`), attivabile in sviluppo.
- Il finto risponde 412 se `ifMatch` non coincide con l'etag e restituisce il nuovo etag dopo ogni scrittura (serve ai test della riga 04).
- In sviluppo si usa questo, non il Calendar vero.

## Fatto quando
- Con il finto e con il vero Calendar gli eventi arrivano in `events` con `etag` e tag; ultimo aggiornamento visibile.
- `npm test`, build e lint passano; errori 401/403/rete mostrano il messaggio giusto.
- Sub-agente di revisione contro le regole di CLAUDE.md; riga aggiornata in ROADMAP.

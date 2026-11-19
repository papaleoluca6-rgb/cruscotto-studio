# 03 Client Calendar, cache, parse, finto Calendar

**Obiettivo**: leggere e scrivere eventi su Google Calendar, con cache locale e riconoscimento delle sessioni di studio.
**Leggere**: `formato-calendar.md`, `lib/calendar/auth.ts` (riga 02), `lib/http.ts`.
**Crea anche**: `lib/time.ts` (date nel fuso dell'utente, usato dalle chiamate Calendar).
**Login**: vedi riga 02, già fatta (Client ID, token client GIS, rinnovo). Qui il resto: i pulsanti di prova della riga 02 nelle Impostazioni si sostituiscono con login/logout e "Aggiorna ora".

## Lettura (`api.ts`)
- `events.list` con `singleEvents=true`, `orderBy=startTime`, finestra da -7 a +15 giorni, paginazione.
- In cache tutti gli eventi del calendario di lavoro, anche non di studio (tipo vuoto), con `transparency` e se è tutto il giorno; "ignorati" = non sono sessioni. Si legge solo il calendario di lavoro; i calendari esclusi non si leggono né scrivono.
- Le risposte vanno in cache in `events`: l'app si apre anche offline e mostra quando è stata aggiornata l'ultima volta.
- Ogni evento in cache conserva l'`etag` e lo espone: serve alla coda offline (riga 04).

## Scrittura (`api.ts`)
- `events.patch` (titolo, orari), `events.insert` (resto, imprevisto), `events.delete` (solo dal ricalibro, solo eventi di studio).
- Sempre con `timeZone` e `sendUpdates=none`.
- Interfaccia del client: `list`, `get`, `patch`, `insert`, `delete`; `patch` e `delete` accettano `ifMatch` (etag, header `If-Match`). Le scritture le chiama solo chi ha già mostrato anteprima e conferma.

## Errori (messaggi specifici, mai in silenzio)
- 401 → rifare login (token scaduto).
- 403 → permessi o quota.
- 412 → etag non coincide: errore tipizzato nel client (lo gestisce la coda, riga 04).
- Rete → "VPN spenta?".
- Timeout su ogni richiesta, lettura della risposta compresa (`lib/http.ts`).

## `parse.ts`
- Riconosce titolo, prefisso di stato, materia (dal prefisso configurato), tipo (study/review/exercises/pronto/vocab), titolo pulito e descrizione, secondo `formato-calendar.md`.
- "Da segnare" = senza prefisso o con ↻, con fine nel passato. Un solo prefisso per titolo: il nuovo sostituisce il vecchio.
- **Test prima del codice** (Vitest): un caso per ogni formato di titolo, per ogni prefisso, titoli non di studio (lezioni, pasti: tipo vuoto, non sessioni), prefisso ↻ da segnare, un solo prefisso, descrizione con e senza `Notion:`.

## Finto Calendar (`fake.ts`)
- Stessa interfaccia del client (`list`, `get`, `patch`, `insert`, `delete`), eventi di esempio inventati (nessun dato reale, repo pubblico) in memoria (con `etag`), attivabile in sviluppo.
- Il finto risponde 412 se `ifMatch` non coincide con l'etag e restituisce il nuovo etag dopo ogni scrittura (serve ai test della riga 04).
- In sviluppo si usa questo, non il Calendar vero.

## Fatto quando
- Con il finto Calendar e con quello vero gli eventi arrivano in `events` con `etag`, e l'ultimo aggiornamento è visibile.
- `npm test`, build e lint passano; errori 401/403/rete mostrano il messaggio giusto.
- Sub-agente di revisione contro le regole di CLAUDE.md; riga aggiornata in ROADMAP.

# 03 Client Calendar, cache, parse, finto Calendar

**Obiettivo**: leggere e scrivere eventi su Google Calendar, con cache locale e riconoscimento delle sessioni di studio.
**Leggere**: `formato-calendar.md`, `lib/calendar/auth.ts` (riga 02), `lib/http.ts`.
**Login**: vedi riga 02, già fatta (Client ID, token client GIS, rinnovo). Qui il resto.

## Lettura (`api.ts`)
- `events.list` con `singleEvents=true`, `orderBy=startTime`, finestra da -7 a +15 giorni, paginazione.
- Le risposte vanno in cache in `events`: l'app si apre anche offline e mostra quando è stata aggiornata l'ultima volta.
- Ogni evento in cache conserva l'`etag` e lo espone: serve alla coda offline (riga 04).

## Scrittura (`api.ts`)
- `events.patch` (titolo, orari), `events.insert` (resto, imprevisto), `events.delete` (solo dal ricalibro, solo eventi di studio).
- Sempre con `timeZone` e `sendUpdates=none`.
- Interfaccia del client: `list`, `patch`, `insert`, `delete`; `patch` e `delete` accettano `ifMatch` (etag, header `If-Match`). Le scritture le chiama solo chi ha già mostrato anteprima e conferma.

## Errori (messaggi specifici, mai in silenzio)
- 401 → rifare login (token scaduto).
- 403 → permessi o quota.
- 412 → etag non coincide: errore tipizzato nel client (lo gestisce la coda, riga 04).
- Rete → "VPN spenta?".
- Timeout su ogni richiesta, lettura della risposta compresa (`lib/http.ts`).

## `parse.ts`
- Riconosce titolo, prefisso di stato, materia (dal prefisso configurato), tipo (study/review/exercises/pronto/vocab), titolo pulito e descrizione, secondo `formato-calendar.md`.
- "Da segnare" = senza prefisso e con fine nel passato.
- **Test prima del codice** (Vitest): un caso per ogni formato di titolo, per ogni prefisso, titoli non di studio (lezioni, pasti: ignorati), descrizione con e senza `Notion:`.

## Finto Calendar (`fake.ts`)
- Stessa interfaccia del client (`list`, `patch`, `insert`, `delete`), eventi di esempio in memoria (con `etag`), attivabile in sviluppo.
- Il finto risponde 412 se `ifMatch` non coincide con l'etag e restituisce il nuovo etag dopo ogni scrittura (serve ai test della riga 04).
- In sviluppo si usa questo, non il Calendar vero.

## Fatto quando
- Con il finto Calendar e con quello vero gli eventi arrivano in `events` con `etag`, e l'ultimo aggiornamento è visibile.
- `npm test`, build e lint passano; errori 401/403/rete mostrano il messaggio giusto.
- Sub-agente di revisione contro le regole di CLAUDE.md; riga aggiornata in ROADMAP.

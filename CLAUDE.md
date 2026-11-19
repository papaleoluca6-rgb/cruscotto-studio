# Cruscotto Studio
Tutto ciò che viene utilizzato per creare quest'app e per il funzionamento della stessa deve essere gratuito

PWA personale per l'università (telefono e tablet Android, PC). Legge le sessioni di studio da Google Calendar, le segna, le sposta nel primo spazio libero, tiene pesi, esercizi, flashcard e ricalibra i prossimi 7-10 giorni.

L'utente studia in Cina: Google (Calendar, Gemini) richiede la VPN; ogni servizio esterno passa da un provider intercambiabile; l'app resta usabile offline con i dati locali.

## Stack
Vite + React 19 + TypeScript, Vitest, Dexie + `dexie-react-hooks`, `vite-plugin-pwa`. Google Identity Services (scope `calendar.events`) + `fetch` alla Calendar API v3, niente `gapi`. Niente backend; backup = export/import JSON.

## Comandi
- `npm run dev` (localhost:5173), `npm run build`, `npm run lint`, `npm test`. Prima di dire "fatto": build, lint e test.
- Pubblicazione: GitHub Pages (`BASE_PATH=/cruscotto-studio/`), push su `main`. Repository pubblico = mai chiavi, token, Client ID, dati nei commit.
- Telefono: USB, `chrome://inspect` → Port forwarding `5173 → localhost:5173`. Login Google solo su `localhost` o HTTPS.

## Struttura
```
src/
  app/            shell e schede
  db/schema.ts    UNICO modello dati (cambi = nuova db.version(n))
  lib/            time.ts (fuso), http.ts, Icon.tsx
  lib/calendar/   auth.ts, api.ts, parse.ts, fake.ts (finto Calendar)
  lib/ai/         types.ts, gemini.ts, openaiCompatible.ts, index.ts
  styles/         global.css (token di design)
  features/       today, planner, recalibrate, subjects, exercises, flashcards, settings, backup
docs/ROADMAP.md, docs/spec/
```

## Regole
- **Tutto gratuito**: niente servizi a pagamento o a consumo imposti dall'app.
- **Senza chiavi AI l'app funziona del tutto**: versione deterministica in `features/planner/` (pura, testata); l'AI è facoltativa, mai default.
- Chiavi e token solo in `db.settings`; il token Google resta in memoria (rinnovo GIS).
- **Scritture su Calendar sempre con anteprima e conferma**, solo su eventi di studio (dal titolo). Mai lezioni, altri calendari o esclusi.
- Orari nel fuso utente (default `Asia/Shanghai`); le chiamate a Calendar passano `timeZone`.
- Ogni funzionalità in `features/<nome>/`; tra feature si importa solo da `db/` o `lib/`.
- File < 200 righe: `*.tsx` componenti, `*.ts` logica.
- UI in italiano, touch (tap target ≥ 44px), telefono e PC.
- Colori e misure da `styles/global.css`. Bottoni `.ui-btn`, icone `lib/Icon.tsx`, mai emoji (tranne ✅ ◐ ↻ ✗ nei titoli su Calendar).
- Errori di rete/provider con messaggio specifico: VPN spenta, token scaduto, chiave non valida, quota, CORS.

## Errori da evitare
- Ogni salvataggio o scrittura fallita si mostra all'utente, mai in silenzio.
- Operazioni a più passi (import, applicazione del ricalibro): o tutto o un riepilogo esatto di cosa è riuscito; mai dati a metà senza dirlo.
- Timeout su ogni richiesta, lettura della risposta compresa (`lib/http.ts` copiato da lecturenote).
- `navigator.storage.persist()` all'avvio.
- Aggiornamento della PWA solo su conferma (`registerType: 'prompt'`).
- Niente dati, chiavi o Client ID nei commit (repository pubblico).

## Come lavoriamo
- A inizio sessione leggere solo `CLAUDE.md` + `docs/spec/<riga>.md` + `src/db/schema.ts` (+ `formato-calendar.md` se richiamato).
- Test prima del codice per `planner/` e `lib/calendar/parse.ts`. In sviluppo usare il finto Calendar.
- A fine funzionalità un sub-agente rivede le modifiche contro regole ed errori da evitare; poi aggiornare lo stato in `docs/ROADMAP.md` (una riga), note nel messaggio di commit.
- Sub-agenti per ricerche e verifiche; stessi file = un solo agente. `/compact` se la conversazione si allunga.
- Effort alto solo per le righe 02, 03, 05, 07.

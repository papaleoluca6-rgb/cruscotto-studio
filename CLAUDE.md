# Cruscotto Studio
Tutto ciò che viene utilizzato per creare quest'app e per il funzionamento della stessa deve essere gratuito

PWA personale per l'università (Android, PC). Legge le sessioni da Google Calendar, le segna, le sposta nel primo spazio libero, tiene pesi, esercizi, flashcard, ricalibra i prossimi 7-10 giorni.

L'utente studia in Cina: Google (Calendar, Gemini) richiede la VPN; i servizi esterni passano da provider intercambiabili; l'app resta usabile offline.

## Stack
Vite + React 19 + TypeScript, Vitest, Dexie + `dexie-react-hooks`, `vite-plugin-pwa`. Google Identity Services (scope `calendar.events`; `drive.appdata` solo riga 12) + `fetch` alla Calendar API v3, niente `gapi`. Niente backend; backup = export/import JSON.

## Comandi
- `npm run dev` (localhost:5173), `npm run build`, `npm run lint`, `npm test`. Prima di "fatto": build, lint, test.
- Pubblicazione: GitHub Pages (`BASE_PATH=/cruscotto-studio/`), push su `main`.
- Telefono: USB, `chrome://inspect` → Port forwarding `5173 → localhost:5173`. Login Google solo su `localhost` o HTTPS.

## Struttura
```
src/
  app/            shell e schede
  db/schema.ts    UNICO modello dati (cambi = db.version(n))
  lib/            time.ts (fuso), http.ts, Icon.tsx
  lib/calendar/   auth.ts, api.ts, queue.ts, parse.ts, fake.ts (finto Calendar)
  lib/ai/         types.ts, gemini.ts, openaiCompatible.ts, index.ts
  lib/planner/    findSlot.ts, weights.ts, regole di ricalibro, tipo operazione, fsrs.ts, merge.ts (pure)
  styles/         global.css (token di design)
  features/       today, timer, week, recalibrate, subjects, exercises, flashcards, settings, backup
docs/ROADMAP.md, docs/spec/
```

## Regole
- **Tutto gratuito**: niente servizi a pagamento o a consumo imposti dall'app.
- **Senza chiavi AI l'app funziona del tutto**: ricalibro, spostamenti, pesi e ripassi sempre deterministici in `lib/planner/` (pura, testata); l'AI è facoltativa, mai default. AI facoltativa con chiave dell'utente: Gemini, Qwen, Kimi, DeepSeek, SiliconFlow, ModelScope o OpenAI-compatibile; mai default.
- Chiavi e token solo in `db.settings`; il token Google resta in memoria (rinnovo GIS).
- **Scritture su Calendar sempre con anteprima e conferma**, solo su eventi di studio creati dall'app o dal piano (riconosciuti dal tag (extendedProperties) o dal titolo). Mai lezioni, altri calendari o esclusi.
- Orari nel fuso utente (default `Asia/Shanghai`); le chiamate a Calendar passano `timeZone`.
- Ogni funzionalità in `features/<nome>/`; tra feature si importa solo da `db/` o `lib/`.
- File < 200 righe: `*.tsx` componenti, `*.ts` logica.
- UI in italiano, touch (tap target ≥ 44px), telefono e PC.
- Colori e misure da `styles/global.css`. Bottoni `.ui-btn`, icone `lib/Icon.tsx`, mai emoji (tranne ✅ ◐ ↻ ✗ nei titoli su Calendar).
- Errori di rete/provider con messaggio specifico: VPN spenta, token scaduto, chiave non valida, quota, CORS.

## Errori da evitare
- Ogni salvataggio o scrittura fallita si mostra, mai in silenzio.
- Operazioni a più passi (import, ricalibro): o tutto o riepilogo esatto di cosa è riuscito; mai dati a metà.
- Timeout su ogni richiesta, lettura della risposta compresa (`lib/http.ts`).
- `navigator.storage.persist()` all'avvio.
- PWA: aggiornamento solo su conferma (`registerType: 'prompt'`).
- Repo pubblico: niente dati, chiavi o Client ID nei commit. Niente librerie da CDN.

## Come lavoriamo
- A inizio sessione leggere solo `CLAUDE.md` + il file Spec della riga in ROADMAP + `src/db/schema.ts` (o il modello in 01-base.md) (+ file citati). Una sessione per riga della roadmap.
- Test prima del codice per `lib/planner/` e `lib/calendar/parse.ts`. In sviluppo usare il finto Calendar.
- A fine funzionalità un sub-agente rivede le modifiche contro regole ed errori da evitare; poi stato in `docs/ROADMAP.md` (una riga), note nel commit.
- Sub-agenti per ricerche e verifiche; stessi file = un solo agente.
- Effort alto solo per le righe 02, 03, 05, 07, 12.

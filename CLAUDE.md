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
docs/ROADMAP.md, docs/spec/   roadmap e spec (estratti già pronti: non rileggere le fonti)
.ai/plans/, .ai/lotti/         piani, resoconti, lotti (fuori da git)
.claude/agents/                esecutore, revisore, verificatore (fuori da git)
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
- Inizio sessione: leggere solo `CLAUDE.md`, la riga di `docs/ROADMAP.md`, la sua spec, `src/db/schema.ts` (o il modello in 01-base.md) e i file che la spec cita. Una sessione per riga; riga finita → stato in ROADMAP (una riga), note nel commit, `/clear`.
- Commit, push, tag, merge solo dopo il sì di Luca; gli agenti mai (nemmeno `git add`). Commit in italiano: "Riga NN: …", elenco per file, riga "Revisione con sub-agente: …".
- Test prima del codice per `lib/planner/` e `lib/calendar/parse.ts`. In sviluppo il finto Calendar; verifica nel browser con `preview_start` (`.claude/launch.json`); le prove sul telefono le fa Luca.
- Tetto contesto 150K: oltre, chiudi la riga o `/handoff` e `/clear`. Piani e resoconti lunghi in `.ai/plans/`, in chat solo il riassunto. `strategic-compact` ai cambi di fase, mai a metà.
- **Modello: Sonnet di default.** Opus (`/model opus`) solo per il piano delle righe con Effort alto (colonna in ROADMAP) e per la verifica finale; poi `/model sonnet`.
- **Delega** (scelta scritta nella colonna Delega a inizio riga):
  - Più di 2 file o 200 righe da leggere → `Explore` (ricerca) o `esecutore` (piano da `.ai/plans/_TEMPLATE.md`); diretto solo se ≤2 file e ≤200 righe, o contesto già in sessione.
  - Ogni modifica al codice: `revisore` (Haiku) contro la checklist del piano e §Regole/§Errori da evitare; righe con Effort alto: `revisore` con `model: sonnet`.
  - Stessi file = un solo agente. Resoconto con MANCAVA → correggi spec o template, non solo il file.
- **Righe grandi** (molti file nuovi, es. 03, 08, 09): due sessioni separate (`/metodo-lavoro lotto <NN>`), file in `.ai/lotti/<NN>/` (modelli in `.ai/lotti/_MODELLO/`).
  - Opus decide tutto in `01-SCELTE.md`; scrive i file delicati (`db/schema.ts`, tipi e test di `lib/planner/` e `parse.ts`, `lib/http.ts`) e i piani `.ai/plans/<NN>-comune.md` + `<NN>-MM.md`; poi `PIANO APPROVATO (Opus, <data>)` in testa al comune e si ferma.
  - Sonnet parte solo con quella riga, scrive solo i file dei piani (fino al verde dei test di Opus), non decide: ogni dubbio in `_DOMANDE.md`, quel punto resta fermo.
  - Chiusura: `verificatore` (Opus) fino a CHIUSA; `Stato: CHIUSA (verifica Opus, <data>)` in `00-GUIDA.md`, "Da decidere" vuoto.
- Controllo: in `/usage` devono comparire righe Sonnet e Haiku; solo Opus = metodo non rispettato.

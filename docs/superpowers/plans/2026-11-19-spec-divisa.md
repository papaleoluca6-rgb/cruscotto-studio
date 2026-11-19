# Spec divisa di Cruscotto Studio: piano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** riscrivere `Claude outputs/SPEC-cruscotto-studio.md` come `CLAUDE.md` corto + roadmap a tabella + un file di spec per funzionalità, con le modifiche approvate.

**Architecture:** solo documenti Markdown nella radice `C:\Users\Utente\Documents\cruscotto\`. Nessun codice. La spec originale resta invariata come fonte.

**Tech Stack:** Markdown, in italiano.

**Spec:** `docs/superpowers/specs/2026-11-19-spec-divisa-design.md`. Fonte dei contenuti: `Claude outputs/SPEC-cruscotto-studio.md` (sezioni §1–§11, ROADMAP, Dati iniziali). Riferimento per il riuso: `C:\Users\Utente\Desktop\registratore lecture note\`.

## Global Constraints

- Lingua: italiano, stesso tono della spec originale (frasi brevi, elenchi).
- `CLAUDE.md` ≤ 3.500 byte. Ogni file in `docs/spec/` ≤ 4.000 byte. `docs/ROADMAP.md` ≤ 2.000 byte.
- Ogni dettaglio della spec originale finisce in **un solo** file (unica eccezione: i rimandi a `docs/spec/formato-calendar.md`). Nessun dettaglio perso.
- Modifiche di contenuto obbligatorie (dal design): Anthropic tolto; provider = Gemini + "OpenAI-compatibile" generico, esempi solo con piano gratuito e nota "raggiungibilità dalla Cina da verificare", DeepSeek/Qwen non suggeriti; Vitest (`npm test`) con test prima del codice per `planner/` e `lib/calendar/parse.ts`; finto Calendar `lib/calendar/fake.ts`; coda offline con `etag` + `If-Match`; prova del login come riga 02; controllo da sub-agente a fine funzionalità; note di sessione nei commit, non nella roadmap.
- Verifica prima di dire "fatto" (da scrivere in CLAUDE.md): `npm run build`, `npm run lint`, `npm test`.
- La cartella non è un repository git: niente commit in questo piano (il `git init` è nella riga 01 della roadmap).

## Review Focus

- Un dettaglio della spec originale che non compare in nessun file nuovo (es. "minimo 30 min" del resto, "più di 3 giorni" del Non fatto, colorId per materia, intervalli Leitner 1/2/4/8/16): il controllo del Task 4 li cerca uno per uno.
- Un file di spec che per essere capito obbliga a leggerne un altro oltre a `formato-calendar.md` e `db/schema.ts`: va reso autosufficiente.
- Il pulsante "Flashcard" della scheda Oggi dipende dalla riga 08: in `04-oggi.md` va segnato come "si aggiunge nella riga 08", e ripreso in `08-esercizi-flashcard.md`.
- Valori numerici cambiati per errore nella copia (finestra 08:00–22:45, margine 5 min, passi 15 min, 12 giorni, +20 min, ±20%, urgenza 21/giorni limitata 0,5–3, 0,8 senza data).
- `CLAUDE.md` che rimanda a file inesistenti.

---

### Task 1: CLAUDE.md e ROADMAP

**Files:**
- Create: `CLAUDE.md`, `docs/ROADMAP.md`

- [ ] **Step 1: Scrivere `CLAUDE.md`** con queste sezioni, prese dalla sezione "CLAUDE.md" della spec originale e aggiornate:
  - Titolo, regola "tutto gratuito", scopo in 2 righe, contesto Cina (VPN, provider intercambiabili, offline).
  - Stack (+ Vitest).
  - Comandi: `dev`, `build`, `lint`, `test`, pubblicazione GitHub Pages (`BASE_PATH=/cruscotto-studio/`, repository pubblico = mai chiavi/token/Client ID/dati), prova sul telefono via `chrome://inspect`.
  - Struttura delle cartelle (come l'originale, + `lib/calendar/fake.ts`, `lib/ai/` senza `anthropic.ts`).
  - Regole (come l'originale, provider aggiornati).
  - Sezione **"Errori da evitare"**: le 6 righe del design, nella stessa forma.
  - **"Come lavoriamo"**: a inizio sessione leggere solo `CLAUDE.md` + `docs/spec/<riga>.md` + `src/db/schema.ts` (+ `formato-calendar.md` se il file lo richiama); test prima del codice per `planner/` e `parse.ts`; in sviluppo usare il finto Calendar; a fine funzionalità un sub-agente rivede le modifiche contro le regole e gli errori da evitare; poi aggiornare lo stato in `docs/ROADMAP.md` (una riga) e mettere le note nel messaggio di commit; effort alto solo per righe 02, 03, 05, 07.
- [ ] **Step 2: Scrivere `docs/ROADMAP.md`**: legenda stato (⬜ 🟨 ✅) e tabella `| # | Funzionalità | Spec | Stato | Nota |` con le 10 righe 01–10 del design, tutte ⬜, colonna Nota vuota. Una riga di testo sopra: "Note di lavoro nei messaggi di commit, non qui."
- [ ] **Step 3: Verificare** con `wc -c CLAUDE.md docs/ROADMAP.md`: entro i limiti delle Global Constraints.

### Task 2: formato-calendar, 01-base, 02-prova-login

**Files:**
- Create: `docs/spec/formato-calendar.md`, `docs/spec/01-base.md`, `docs/spec/02-prova-login.md`

- [ ] **Step 1: `formato-calendar.md`** = §1 completo (titoli, prefissi di stato, regola "da segnare", descrizione a 4 righe, colorId per materia).
- [ ] **Step 2: `01-base.md`**:
  - Obiettivo e "fatto quando" (app installabile, schede vuote, impostazioni e backup funzionanti, `npm test` con un test di esempio, pubblicazione su Pages).
  - **Riuso da lecturenote**: elenco dei file da copiare con cosa cambiare. Prima di scriverlo, aprire ciascun file in lecturenote per confermare cosa togliere. Elenco di partenza: `vite.config.ts` (togliere globPatterns di pdf.js e `globIgnores` offline; nome/descrizione nel manifest), `.github/workflows/pages.yml` (invariato), `.oxlintrc.json` (togliere `public/offline/**`), `.claude/launch.json` (nome), `tsconfig*.json`, `scripts/make-icons.mjs`, `.gitignore` (togliere `public/pdfjs`), `src/lib/http.ts`, `src/lib/Icon.tsx` (solo le icone usate), `src/styles/global.css` (togliere i token `--ink-*`), `src/app/UpdateBanner.tsx` (togliere `allSaved`), `src/db/settings.ts`, `src/features/settings/{ApiKeyField,ChoiceGroup}.tsx`, `src/features/backup/{backup,format,selfCheck}.ts` + `BackupPanel.tsx` (senza `legacy.ts`; backup = JSON semplice, nessun Blob). `package.json`: togliere `pdfjs-dist`, `perfect-freehand`, `postinstall`; aggiungere `vitest` e lo script `test`.
  - `git init`, repository pubblico `cruscotto-studio`.
  - `navigator.storage.persist()` all'avvio.
  - Modello dati = §2 completo (sarà la base di `db/schema.ts`).
  - Impostazioni: fuso orario, finestra di studio, margine, calendario di lavoro, calendari esclusi, materie (nome, prefisso, colore); backup export/import.
  - "Dati iniziali" della spec originale.
- [ ] **Step 3: `02-prova-login.md`**:
  - Creazione gratuita del Client ID (§10, primo punto) e token client GIS con scope solo `calendar.events`.
  - Cosa verificare sul telefono vero, con l'app **installata** come PWA: login con un tocco; rinnovo del token dopo la scadenza (1 h) senza perdere lo stato; comportamento con VPN accesa e spenta (messaggio "VPN spenta?"); una lettura `events.list` di prova.
  - "Fatto quando": risultati scritti nella colonna Nota della roadmap; se il popup non funziona nella PWA installata, fermarsi e decidere con l'utente prima della riga 03.
- [ ] **Step 4: Verificare** con `wc -c docs/spec/*.md`.

### Task 3: righe 03–10

**Files:**
- Create: `docs/spec/03-calendar.md`, `04-oggi.md`, `05-sposta.md`, `06-pesi.md`, `07-ricalibro.md`, `08-esercizi-flashcard.md`, `09-ai.md`, `10-rifiniture.md`

Ogni file inizia con: obiettivo in una riga, file da leggere (oltre a CLAUDE.md e schema), "fatto quando", test da scrivere per primi (dove c'è logica pura).

- [ ] **Step 1: `03-calendar.md`**: §10 lettura, scrittura, errori, cache; `parse.ts` (riconoscimento secondo `formato-calendar.md`) con test prima del codice; `fake.ts` con la stessa interfaccia del client (`list`, `patch`, `insert`, `delete`) ed eventi di esempio in memoria, attivabile in sviluppo; ogni evento in cache conserva l'`etag`.
- [ ] **Step 2: `04-oggi.md`**: §3 riepilogo, liste, Fatto / Salta / Annulla segno con log; pulsante Flashcard "si aggiunge nella riga 08"; coda offline: le azioni fatte offline si inviano alla riconnessione con `If-Match: <etag>`; se Google risponde 412 l'operazione non parte e torna in anteprima.
- [ ] **Step 3: `05-sposta.md`**: §4 `findSlot` (funzione pura, test prima) + Non fatto e Parziale di §3 + Imprevisto, tutti con anteprima e conferma.
- [ ] **Step 4: `06-pesi.md`**: §5 completo; test prima per `weights.ts`.
- [ ] **Step 5: `07-ricalibro.md`**: §6 parte deterministica + formato della lista di operazioni + salvataggio in `recalibrations`; test prima per le regole 1–4.
- [ ] **Step 6: `08-esercizi-flashcard.md`**: §7 + §8 senza le parti AI; pulsante Flashcard della scheda Oggi; import dei dati iniziali (esercizi, carte) da JSON.
- [ ] **Step 7: `09-ai.md`**: §9 con i provider aggiornati (Gemini; OpenAI-compatibile con URL/chiave/modello, esempi solo con piano gratuito, "raggiungibilità dalla Cina da verificare"; niente Anthropic) + "Prova connessione" + ricalibro AI (§6, parte AI, con validazione) + Genera / Spiegamela meglio (§8, parte AI).
- [ ] **Step 8: `10-rifiniture.md`**: §11 "Copia riepilogo per Notion"; test su telefono, tablet e PC.
- [ ] **Step 9: Verificare** con `wc -c docs/spec/*.md`.

### Task 4: controllo di copertura

- [ ] **Step 1:** Per ogni sezione della spec originale (§1–§11, ROADMAP, Dati iniziali) e per ogni valore elencato nella Review Focus, cercare con `grep -rn` in `CLAUDE.md docs/` il file che lo contiene. Ogni assenza → aggiungerla nel file giusto.
- [ ] **Step 2:** Cercare `Anthropic`, `DeepSeek`, `Qwen` in `CLAUDE.md docs/spec docs/ROADMAP.md`: nessuna occorrenza come provider suggerito.
- [ ] **Step 3:** Per ogni percorso citato in `CLAUDE.md` e `docs/ROADMAP.md` sotto `docs/`, verificare che il file esista.
- [ ] **Step 4:** `wc -c CLAUDE.md docs/ROADMAP.md docs/spec/*.md`: tutto entro i limiti.

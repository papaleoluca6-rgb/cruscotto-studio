# Cruscotto Studio: specifica per Claude Code

Questo file contiene tutto il necessario per creare il progetto da zero.
Istruzioni per Claude Code:
1. Crea una cartella nuova, per esempio `cruscotto-studio`.
2. Copia la sezione "CLAUDE.md" qui sotto in `CLAUDE.md` alla radice.
3. Copia la sezione "ROADMAP" in `docs/ROADMAP.md`.
4. Sviluppa una funzionalità alla volta, nell'ordine della roadmap, e aggiorna lo stato in `docs/ROADMAP.md` alla fine di ognuna.

---

## CLAUDE.md

# Cruscotto Studio
Tutto ciò che viene utilizzato per creare quest'app e per il funzionamento della stessa deve essere gratuito

App personale per l'università, da installare su **telefono e tablet Android** e da usare anche sul **PC** (PWA da Chrome). Collegata a **Google Calendar**: legge le sessioni di studio, permette di segnarle come fatte, parziali, non fatte o saltate e sposta le sessioni nel primo spazio libero. Tiene traccia di pesi delle materie, esercizi d'esame e flashcard, e ricalibra il piano dei prossimi 7-10 giorni.

L'utente studia in Cina, quindi:
- i servizi Google (Calendar API, Gemini) richiedono la VPN;
- ogni servizio esterno passa da un **provider intercambiabile**;
- l'app deve restare utilizzabile offline, con i dati locali.

### Stack
- Vite + React 19 + TypeScript.
- Dexie (IndexedDB) + `dexie-react-hooks`.
- `vite-plugin-pwa` (offline, installabile).
- Google Calendar: Google Identity Services (token client OAuth, scope `https://www.googleapis.com/auth/calendar.events`) + chiamate `fetch` dirette alla Calendar API v3. Nessuna libreria `gapi`.
- Niente backend e niente Supabase: i dati restano sul dispositivo. Backup = export/import di un file JSON.

### Comandi
- `npm run dev`: server locale (http://localhost:5173).
- `npm run build`: type-check + build di produzione. Da eseguire prima di dire "fatto".
- `npm run lint`: oxlint.
- **Pubblicazione**: GitHub Pages da repository pubblico (`.github/workflows/pages.yml`, `BASE_PATH=/cruscotto-studio/`). Ogni push su `main` ricompila e pubblica. Repository pubblico = mai chiavi, token, Client ID personali, dati di calendario o materiale nei commit.
- Prova sul telefono: collegarlo via USB, poi in Chrome sul PC `chrome://inspect` → Port forwarding `5173 → localhost:5173`. Il login Google funziona solo su `localhost` o HTTPS.

### Struttura
```
src/
  app/            shell, navigazione a schede (Oggi, Materie, Esercizi, Flashcard, Impostazioni)
  db/schema.ts    UNICO modello dati (tabelle Dexie + tipi). Cambi schema = nuova db.version(n)
  lib/            utility condivise (time.ts con fuso orario, http.ts, Icon.tsx, …)
  lib/calendar/   client Google Calendar: auth.ts (token GIS), api.ts (list/patch/insert/delete), parse.ts (riconoscimento sessioni)
  lib/ai/         provider AI intercambiabili: types.ts (interfaccia), gemini.ts, openaiCompatible.ts, anthropic.ts, index.ts (scelta dalle impostazioni)
  styles/         global.css con i token di design (variabili CSS)
  features/
    today/        sessioni da segnare, oggi, domani, prossimi giorni; azioni Fatto/Parziale/Non fatto/Salta/Annulla; modulo Imprevisto
    planner/      algoritmi deterministici: pesi, ricerca spazi liberi, riordino, ripassi spaziati (senza AI)
    recalibrate/  ricalibro dei prossimi 7-10 giorni: proposta (deterministica o AI) → anteprima delle differenze → applicazione su Calendar
    subjects/     materie: difficoltà, importanza, data esame, "il prof è a", "io sono a", quote e ore
    exercises/    esercizi e prove d'esame con tre stati
    flashcards/   mazzi, ripasso Leitner, generazione e spiegazione con AI (facoltative)
    settings/     account Google, Client ID, provider AI e chiavi API (salvate in db.settings, MAI nel codice), fuso orario, finestre di studio
    backup/       export/import di tutto il database
docs/ROADMAP.md   funzionalità in ordine e stato
```

### Regole
- **Regola principale: tutto deve essere gratuito.** Niente servizi a pagamento né a consumo imposti dall'app. Prima ciò che gira sul dispositivo, poi servizi gratuiti.
- **L'app deve funzionare del tutto senza chiavi AI.** Ricalibro, spostamenti, pesi e ripassi hanno sempre una versione deterministica in `features/planner/`. L'AI è un'aggiunta facoltativa: proposte di ricalibro più intelligenti, generazione e spiegazione di flashcard. Mai essenziale, mai default.
- **Chiavi API e token** solo nelle impostazioni dell'app (`db.settings`), mai nel codice né nei commit. Il token Google resta in memoria e si rinnova con GIS; non salvarlo in chiaro.
- **Scritture su Calendar sempre con anteprima e conferma**, e solo sugli eventi di studio creati dall'app o dal piano (riconosciuti dal formato del titolo). Mai toccare lezioni, eventi di altri calendari o calendari esclusi nelle impostazioni.
- **Tutti gli orari nel fuso orario dell'utente** (impostazione, default `Asia/Shanghai`). Le chiamate a Calendar passano sempre `timeZone`.
- Ogni funzionalità vive nella sua cartella `features/<nome>/`. Si importa da altre feature solo tramite `db/` o `lib/`.
- File piccoli (meglio < 200 righe): componenti in `*.tsx`, logica in `*.ts`. La logica di `planner/` è pura e testabile.
- UI in italiano, pensata per il touch: tap target ≥ 44px, layout per telefono e per PC.
- Colori e misure solo tramite le variabili di `styles/global.css`. Bottoni con `.ui-btn`, icone con `lib/Icon.tsx` (mai emoji, tranne i simboli di stato nei titoli su Calendar: ✅ ◐ ↻ ✗).
- Ogni errore di rete o di provider ha un messaggio specifico: VPN probabilmente spenta, token scaduto, chiave non valida, quota esaurita, CORS bloccato dal provider.

### Come lavoriamo (risparmio token)
- Sub-agenti ogni volta che conviene: ricerche nel codice, bug indipendenti, revisione, verifiche (build, test nel browser), anche in parallelo. Il lavoro che tocca gli stessi file resta in un solo agente.
- Una sessione per funzionalità della roadmap; alla fine aggiornare lo stato in `docs/ROADMAP.md`.
- `/compact` quando la conversazione si allunga.
- Effort basso per testi, stile e piccoli fix. Effort alto solo per auth Google, ricalibro e ricerca spazi liberi.
- Leggere solo i file della feature su cui si lavora + `db/schema.ts`.

---

## Dettagli funzionali (riferimento per tutte le sessioni)

### 1. Formato delle sessioni su Calendar
- Titolo: `<Materia> Study: <argomento>`, `<Materia> Review +1d|+1w|+3w|pre-exam: <argomento>`, `<Materia> Exercises: <esercizi>`. Inoltre `CPT Pronto: …` (progetto) e `Ripasso vocaboli` (cinese).
- Prefissi di stato nel titolo: `✅ ` fatto, `◐ ` parziale, `↻ ` spostato (ancora da fare), `✗ ` saltato. Una sessione senza prefisso con fine nel passato è "da segnare".
- Descrizione su 4 righe: `Material:` (file e pagine/slide esatte), `Task:`, `Done when:`, `Notion:` (facoltativa).
- Colore per materia (colorId di Google: Analog 6, Communication 10, Analisi 2 5, ALP 3, CPT 9, DSP 8, Cinese 4). Le materie si configurano nelle impostazioni (nome, prefisso del titolo, colore).

### 2. Modello dati (`db/schema.ts`)
- `settings` (una riga): fuso orario, Client ID Google, calendario di lavoro (default `primary`), calendari esclusi, finestra di studio (default 08:00-22:45), margine tra eventi (default 5 min), provider AI scelto, chiavi per provider, modello per provider.
- `subjects`: id, nome, prefisso titolo, colorId, difficoltà 0-5, importanza 0-5, data esame, profAt, meAt.
- `events` (cache di Calendar): id Google, titolo, titolo pulito, stato, subjectId, tipo (study/review/exercises/pronto/vocab), start, end, descrizione, calendarId, aggiornato.
- `log`: eventId, stato, percentuale, nota ("dove sono arrivato"), inizio pianificato, minuti pianificati, spostato a, motivo, data.
- `exercises`: id, subjectId, nome, fonte, stato (todo / sol / solo), ordine, nota.
- `cards`: id, subjectId, domanda, risposta, scatola 1-5, scadenza, argomento, creata, ultimo ripasso.
- `recalibrations`: data, metodo (deterministico/AI + provider), proposta (lista di operazioni), applicata sì/no, riepilogo.

### 3. Scheda Oggi
- Riepilogo: ore fatte su ore pianificate oggi, sessioni da segnare, flashcard scadute, esercizi mancanti, giorni agli esami.
- Liste: Da segnare (ultimi 7 giorni), Oggi, Domani, Prossimi giorni (comprimibile). Tocco sul titolo = mostra la descrizione.
- Azioni su ogni sessione:
  - **Fatto** → prefisso ✅ + log.
  - **Parziale** → percentuale (25/50/75) + "dove sono arrivato" → prefisso ◐, crea una sessione "(resto)" con durata proporzionale (minimo 30 min) nel primo spazio libero, con "Resume from: …" in testa alla descrizione.
  - **Non fatto** → calcola il primo spazio libero e lo mostra; sposta solo dopo conferma, prefisso ↻. Se lo spazio è a più di 3 giorni, suggerisce "Parziale" o il ricalibro.
  - **Salta** → prefisso ✗.
  - **Annulla segno** → toglie il prefisso e il log.
  - **Flashcard** → apre il generatore con l'argomento della sessione.
- **Imprevisto**: giorno, dalle, alle, cosa → crea l'evento "Imprevisto: …" e sposta le sessioni che ci cadono dentro, con un riepilogo finale.

### 4. Ricerca spazio libero (`planner/findSlot.ts`)
- Occupato = tutti gli eventi con orario del calendario di lavoro (anche lezioni, pasti, sport) ± margine, tranne quelli con disponibilità "libero".
- Cerca a passi di 15 minuti, dentro la finestra di studio, per 12 giorni, a partire da adesso + 20 minuti.
- Funzione pura, con test.

### 5. Pesi e quote (`planner/weights.ts`)
- punteggio = difficoltà × importanza × urgenza × (1 + 0,1 × arretrato).
- urgenza = 21 / giorni all'esame, limitata fra 0,5 e 3; 0,8 senza data.
- arretrato = sessioni da segnare negli ultimi 7 giorni + non fatte negli ultimi 14.
- quota = punteggio / somma. Ore consigliate (7 giorni) = ore di studio pianificate × quota.
- Il cinese (vocaboli) è fisso e non entra nelle quote. Importanza 0 esclude la materia.
- Mostrare per materia: quota, ore pianificate contro consigliate (barra con indicatore), fatte negli ultimi 7 giorni, arretrato, e uno stato: "in linea" (±20%), "mancano X h", "X h in più".

### 6. Ricalibro (`features/recalibrate/`)
Due modi, stessa uscita: una **lista di operazioni** (`move`, `update`, `create`, `delete`) sugli eventi di studio dei prossimi 7-10 giorni, mostrata come anteprima (prima → dopo) e applicata solo dopo conferma, una operazione alla volta, con un riepilogo.
- **Deterministico (sempre disponibile)**:
  1. rimettere in ordine logico Study → Exercises → Review della stessa materia e argomento;
  2. spostare i ripassi che cadono prima del loro studio;
  3. riportare ogni materia entro ±20% delle ore consigliate, scambiando o accorciando sessioni;
  4. non toccare scadenze, lezioni e calendari esclusi.
- **AI (facoltativo)**: invia al provider scelto materie, pesi, puntatori prof/io, log degli ultimi 14 giorni, eventi dei prossimi 10 giorni e regole del piano. Chiede in risposta **solo JSON** valido secondo uno schema (lista di operazioni con motivazione). Prima di mostrare l'anteprima, valida la risposta: niente sovrapposizioni, niente fuori dalla finestra di studio, solo eventi di studio, ordine logico rispettato. Se la validazione fallisce, scarta le operazioni non valide e lo dice.
- Ogni ricalibro va salvato in `recalibrations`.

### 7. Esercizi
- Elenco per materia con tre stati (Da fare / Con soluzione / Da solo). "Con soluzione" vale metà nella barra di avanzamento.
- Filtri per materia e "non ancora da solo"; modulo per aggiungerne uno; import da JSON per inizializzare la lista.

### 8. Flashcard
- Mazzi per materia con il conteggio delle carte scadute. Ripasso Leitner con quattro tasti:
  - Di nuovo → torna in coda, scatola 1;
  - Difficile → stessa scatola, +1 giorno;
  - Bene → scatola +1;
  - Facile → scatola +2.
  - Intervalli 1/2/4/8/16 giorni.
- Aggiunta manuale sempre disponibile.
- Con un provider AI configurato:
  - "Genera" da argomento o appunti incollati, con anteprima e selezione prima del salvataggio;
  - "Spiegamela meglio" su una carta.
- Prompt: domanda e risposta in italiano, termini tecnici in inglese, risposta in JSON.

### 9. Provider AI (`lib/ai/`)
Interfaccia unica: `generateJSON(prompt, schema)` e `generateText(prompt)`, con errori tipizzati (chiave non valida, quota, rete/VPN, CORS, risposta non valida).

| Provider | Note |
|---|---|
| **Gemini** (Google AI Studio) | Ha un piano gratuito; richiede la VPN dalla Cina. |
| **OpenAI-compatibile** | URL base + chiave + modello configurabili. Copre DeepSeek e Qwen/DashScope, raggiungibili dalla Cina, oltre a Groq, OpenRouter e OpenAI. |
| **Anthropic** | Chiamata diretta dal browser con l'header `anthropic-dangerous-direct-browser-access: true`. |

- Non tutti i provider permettono chiamate dirette dal browser (CORS): l'app lo rileva e lo spiega nelle impostazioni con un pulsante "Prova connessione".
- Le impostazioni mostrano chiaramente quali provider hanno un piano gratuito, senza promettere nulla: dipende dal provider.

### 10. Google Calendar (`lib/calendar/`)
- L'utente crea gratis un progetto su Google Cloud Console, abilita Google Calendar API e crea un **Client ID OAuth di tipo "Applicazione web"**. Origini autorizzate: l'URL di GitHub Pages e `http://localhost:5173`. Il Client ID si incolla nelle impostazioni dell'app, mai nel codice.
- Token client di Google Identity Services: login con un tocco, rinnovo silenzioso quando scade, scope solo `calendar.events`.
- Lettura: `events.list` con `singleEvents=true`, `orderBy=startTime`, finestra da -7 a +15 giorni, paginazione. Le risposte vanno in cache in `events`, così l'app si apre anche offline e mostra quando è stata aggiornata l'ultima volta.
- Scrittura: `events.patch` (titolo, orari), `events.insert` (resto, imprevisto), `events.delete` (solo dal ricalibro, solo eventi di studio). Sempre con `timeZone` e `sendUpdates=none`.
- Errori: 401 → rifare login; 403 → permessi o quota; rete → "VPN spenta?". Le azioni fatte offline restano in coda e si inviano alla riconnessione.

### 11. Notion
L'API di Notion non accetta chiamate dirette dal browser senza backend. Per rispettare la regola "niente backend":
- niente integrazione diretta;
- pulsante "Copia riepilogo per Notion" (Markdown: stato per materia, piano dei prossimi 10 giorni, ultimo ricalibro) da incollare a mano o da passare a Claude.

---

## ROADMAP (`docs/ROADMAP.md`)

| # | Funzionalità | Stato |
|---|---|---|
| 1 | Scaffolding: Vite + React + TS, PWA, `global.css` con i token, shell a schede, `db/schema.ts`, workflow GitHub Pages | da fare |
| 2 | Impostazioni: fuso orario, finestra di studio, materie (nome, prefisso, colore), backup export/import | da fare |
| 3 | Google Calendar: login GIS, lettura eventi, cache, riconoscimento delle sessioni (`parse.ts`) con test | da fare |
| 4 | Scheda Oggi in sola lettura: riepilogo e liste | da fare |
| 5 | Azioni: Fatto / Salta / Annulla con log; coda offline | da fare |
| 6 | `planner/findSlot.ts` con test; Non fatto (sposta) e Parziale (resto) con anteprima | da fare |
| 7 | Imprevisto | da fare |
| 8 | Materie e pesi: quote, ore pianificate contro consigliate, stato | da fare |
| 9 | Ricalibro deterministico con anteprima e applicazione | da fare |
| 10 | Esercizi: lista, stati, import JSON | da fare |
| 11 | Flashcard: mazzi, ripasso Leitner, aggiunta manuale | da fare |
| 12 | Provider AI: interfaccia, Gemini, OpenAI-compatibile, Anthropic, "Prova connessione" | da fare |
| 13 | Ricalibro con AI (JSON validato) e flashcard generate o spiegate con AI | da fare |
| 14 | "Copia riepilogo per Notion", rifiniture, test su telefono, tablet e PC | da fare |

---

## Dati iniziali (da importare dopo la funzionalità 10)

Materie: Analog, Communication, Analisi 2, ALP, CPT, DSP, Cinese. Pesi, date d'esame ed esercizi si esportano dal cruscotto attuale. Per farlo, chiedere a Claude nella chat del progetto "Calendario": "esporta in JSON settings, exercises e cards dal Cruscotto studio".

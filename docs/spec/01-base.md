# 01 Base

**Obiettivo**: scheletro installabile, riusando lecturenote. **Fatto quando**: PWA installabile, schede vuote (Oggi, Materie, Esercizi, Flashcard, Impostazioni), impostazioni e backup funzionanti, un test di esempio, pubblicata su Pages.

## Riuso da lecturenote
Cartella `C:/Users/Utente/Desktop/registratore lecture note/` (sola lettura). Rinominare lecturenote in cruscotto-studio.
- `vite.config.ts`: togliere `globPatterns` di pdf.js e `globIgnores: ['offline/**']`; nome, descrizione e `lang` nel manifest. Tenere `registerType: 'prompt'` e `server.host '127.0.0.1'`.
- `.github/workflows/pages.yml`: invariato. `BASE_PATH` dal nome del repository: deve chiamarsi `cruscotto-studio`.
- `.oxlintrc.json`: togliere `public/offline/**`. `.gitignore`: togliere `public/pdfjs`. `.claude/launch.json`: nome. `tsconfig*.json`, `scripts/make-icons.mjs`: invariati.
- `src/lib/http.ts`, `src/db/settings.ts` (chiavi tipizzate nostre).
- `src/lib/Icon.tsx`: solo le icone usate. `src/styles/global.css`: togliere `--ink-*`. `src/app/UpdateBanner.tsx`: togliere `allSaved`.
- `src/features/settings/{ApiKeyField,ChoiceGroup}.tsx`.
- `src/features/backup/{backup,format,selfCheck}.ts` + `BackupPanel.tsx`, senza `legacy.ts`. Backup = JSON semplice, senza Blob, senza chiavi API.
- `package.json`: togliere `pdfjs-dist`, `perfect-freehand`, `postinstall`; tenere `dexie`, `dexie-react-hooks`, `vite-plugin-pwa`; aggiungere `vitest` e lo script `test`.

## Resto
- Creare il remoto pubblico `cruscotto-studio` e fare il primo push.
- `navigator.storage.persist()` all'avvio. Niente librerie da CDN: tutto nel bundle (offline, Cina).
- Schermata impostazioni: i valori di `settings` sotto, più materie (nome, prefisso, colore) e backup export/import.

## Modello dati (base di `db/schema.ts`; poi lo schema è la fonte)
Ogni riga ha `id` UUID e `updatedAt` (sincronizzazione, riga 12); eccezioni: `events` (cache, id Google) e `settings` (chiave, ma con `updatedAt`). Import e backup conservano gli id. Ogni cancellazione scrive una riga in `tombstones`.
- `settings`: righe chiave→valore come `db/settings.ts` di lecturenote; chiavi AI come `apiKey.<provider>` (così il backup le esclude). Valori: fuso orario, Client ID Google, calendario di lavoro (default `primary`), calendari esclusi, finestra di studio (default 08:00-22:45), margine tra eventi (default 5 min), blocco minimo (30 min), soglia sessioni per il fattore (5), provider AI scelto, modello per provider, minuti promemoria popup (default 10), ritenzione desiderata FSRS (default 0,9).
- `subjects`: id, nome, prefisso titolo, colorId, difficoltà 0-5, importanza 0-5, data esame, profAt, meAt.
- `events` (cache di Calendar): id Google, titolo, titolo pulito, stato, subjectId, tipo (study/review/exercises/simulazione/pronto/vocab, vuoto se non di studio), tag app (`cruscotto=1`), start, end, `transparency` (opaque/transparent), tutto il giorno, descrizione, calendarId, aggiornato.
- `log`: eventId, stato, percentuale, nota ("dove sono arrivato"), inizio pianificato, minuti pianificati, **minuti reali**, spostato a, motivo, data.
- `exercises`: id, subjectId, nome, fonte, argomento, stato (todo / sol / solo), ordine, nota.
- `cards`: id, subjectId, domanda, risposta, argomento, creata, campi FSRS (stability, difficulty, due, reps, lapses, state, last_review).
- `revlog`: id, cardId, data, voto 1-4, stato FSRS prima/dopo, minuti.
- `tombstones`: tabella, id, updatedAt.
- `recalibrations`: data, metodo (deterministico/AI + provider), proposta (lista di operazioni), applicata sì/no, riepilogo.

## Dati iniziali (da importare dopo la riga 08)
Materie: Analog, Communication, Analisi 2, ALP, CPT, DSP, Cinese. Pesi, date d'esame, esercizi e carte si importano nella riga 08 da un solo JSON dal cruscotto attuale. Il JSON esportato contiene dati reali e non va nel repository (`dati/` in `.gitignore`). Chiedere a Claude nel progetto "Calendario": "esporta in JSON settings, exercises e cards dal Cruscotto studio".

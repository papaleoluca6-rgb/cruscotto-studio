# 01 Base

**Obiettivo**: scheletro installabile, riusando lecturenote. **Fatto quando**: app installabile come PWA, schede vuote (Oggi, Materie, Esercizi, Flashcard, Impostazioni), impostazioni e backup funzionanti, `npm test` con un test di esempio, pubblicata su Pages.

## Riuso da lecturenote
Cartella `C:/Users/Utente/Desktop/registratore lecture note/` (sola lettura). Percorsi relativi. Rinominare "lecturenote/LectureNote" in "cruscotto-studio".
- `vite.config.ts`: togliere `globPatterns` di pdf.js e `globIgnores: ['offline/**']`; nome, descrizione e `lang` nel manifest. Tenere `registerType: 'prompt'` e `server.host '127.0.0.1'`.
- `.github/workflows/pages.yml`: invariato.
- `.oxlintrc.json`: togliere `public/offline/**`.
- `.claude/launch.json`: nome.
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`: invariati.
- `scripts/make-icons.mjs`: invariato (icone PNG generate).
- `.gitignore`: togliere `public/pdfjs`.
- `src/lib/http.ts`, `src/db/settings.ts` (chiavi tipizzate: sostituire quelle di lecturenote con le nostre).
- `src/lib/Icon.tsx`: solo le icone usate.
- `src/styles/global.css`: togliere i token `--ink-*`.
- `src/app/UpdateBanner.tsx`: togliere `allSaved`.
- `src/features/settings/{ApiKeyField,ChoiceGroup}.tsx`.
- `src/features/backup/{backup,format,selfCheck}.ts` + `BackupPanel.tsx`, senza `legacy.ts`. Backup = JSON semplice, nessun Blob; le chiavi API restano fuori.
- `package.json`: togliere `pdfjs-dist`, `perfect-freehand`, `postinstall`; aggiungere `vitest` e lo script `test`.

## Resto
- Repository locale già esistente; creare il remoto pubblico `cruscotto-studio` e fare il primo push.
- `navigator.storage.persist()` all'avvio.
- Impostazioni: fuso orario, Client ID Google, finestra di studio, margine, calendario di lavoro, calendari esclusi, materie (nome, prefisso, colore); backup export/import.

## Modello dati (base di `db/schema.ts`; poi lo schema è la fonte)
- `settings` (una riga): fuso orario, Client ID Google, calendario di lavoro (default `primary`), calendari esclusi, finestra di studio (default 08:00-22:45), margine tra eventi (default 5 min), provider AI scelto, chiavi per provider, modello per provider.
- `subjects`: id, nome, prefisso titolo, colorId, difficoltà 0-5, importanza 0-5, data esame, profAt, meAt.
- `events` (cache di Calendar): id Google, titolo, titolo pulito, stato, subjectId, tipo (study/review/exercises/pronto/vocab), start, end, descrizione, calendarId, aggiornato.
- `log`: eventId, stato, percentuale, nota ("dove sono arrivato"), inizio pianificato, minuti pianificati, spostato a, motivo, data.
- `exercises`: id, subjectId, nome, fonte, stato (todo / sol / solo), ordine, nota.
- `cards`: id, subjectId, domanda, risposta, scatola 1-5, scadenza, argomento, creata, ultimo ripasso.
- `recalibrations`: data, metodo (deterministico/AI + provider), proposta (lista di operazioni), applicata sì/no, riepilogo.

## Dati iniziali (da importare dopo la riga 08)
Materie: Analog, Communication, Analisi 2, ALP, CPT, DSP, Cinese. Pesi, date d'esame ed esercizi si esportano dal cruscotto attuale: chiedere a Claude nella chat del progetto "Calendario": "esporta in JSON settings, exercises e cards dal Cruscotto studio".

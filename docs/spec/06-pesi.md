# 06 Materie e pesi

**Obiettivo**: dire quanto studiare ogni materia nei prossimi 7 giorni e se si è in linea.
**Leggere**: `src/db/schema.ts` (`subjects`, `log`, `events`).

## `lib/planner/weights.ts` (funzione pura)
- punteggio = difficoltà × importanza × urgenza × (1 + 0,1 × arretrato).
- urgenza = 21 / giorni all'esame, limitata fra 0,5 e 3; 0,8 senza data.
- arretrato = sessioni da segnare negli ultimi 7 giorni + non fatte negli ultimi 14.
- quota = punteggio / somma.
- Ore consigliate (7 giorni) = ore di studio pianificate × quota.
- Ore di studio pianificate = ore degli eventi di studio (study, review, exercises, simulazione) dei prossimi 7 giorni.
- Il cinese (vocaboli) è fisso: non si conta nelle quote (le sue sessioni si possono comunque spostare e ricalibrare). Importanza 0 esclude la materia.
- **Test prima del codice**: urgenza ai limiti (0,5 e 3), senza data (0,8), arretrato, importanza 0, cinese escluso, somma delle quote = 1.

## `lib/planner/stime.ts` (pura): correzione delle stime
- fattore = minuti reali / minuti pianificati dal `log`, per materia e per tipo di sessione; limitato a 0,8-2; catena: materia×tipo → materia → 1, ciascun livello solo con almeno 5 sessioni registrate (impostazione "soglia sessioni"). Valori predefiniti da tarare.
- Durata attesa = pianificata × fattore (la usano capacità e riga 07).

## `lib/planner/capacita.ts` (pura): verdetto per esame
- servono X h = minuti pianificati delle sessioni da fare (study, review, exercises, simulazione) fino all'esame × fattore; hai Y h = spazi liberi (come `findSlot`, blocchi ≥ blocco minimo) nella finestra di studio da adesso all'esame. La cache tiene tutti gli eventi futuri (riga 03); nel ripiego a finestra il verdetto si ferma all'orizzonte in cache e lo dice ("nei prossimi N giorni").
- Verdetto "servono X h, hai Y h di spazi liberi prima dell'esame: mancano Z h" (o "ci stai").
- **Test prima del codice** anche per `stime.ts` e `capacita.ts`: sotto 5 sessioni fattore 1, limiti 0,8 e 2, spazi che bastano e non bastano, esame oltre l'orizzonte della cache.

## Scheda Materie (`features/subjects/`)
- Modifica di difficoltà, importanza (0-5), data esame, "il prof è a", "io sono a".
- Per materia: quota, ore pianificate contro consigliate (barra con indicatore), fatte negli ultimi 7 giorni, arretrato.
- Verdetto di capacità per ogni esame. Stato: "in linea" (±20%), "mancano X h", "X h in più".

## Fatto quando
- Test di `weights.ts` passano e la scheda mostra i valori sui dati reali (o del finto Calendar).
- Build, lint, test; revisione con sub-agente; ROADMAP aggiornata.

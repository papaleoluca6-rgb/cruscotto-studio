# Design: spec di Cruscotto Studio divisa per funzionalità

## Perché
Con lecturenote i due costi maggiori sono stati **token** e **giri di correzioni**:
- `docs/ROADMAP.md` è arrivata a 27 KB perché accumula le note di ogni sessione, e viene riletta ogni volta;
- nessun test automatico (il piano diceva "non aggiungerne"): i bug sono emersi solo nel controllo finale o sul tablet, e gli stessi tipi di errore si sono ripetuti in feature diverse.

La spec attuale (`Claude outputs/SPEC-cruscotto-studio.md`, 16 KB in un file) ripeterebbe il primo problema e non affronta il secondo.

## Obiettivi
- Ogni sessione legge solo: `CLAUDE.md` (~3 KB) + il file della sua funzionalità + `db/schema.ts`.
- I bug della logica (spazi liberi, pesi, ricalibro, riconoscimento titoli) si trovano con i test prima di arrivare sul telefono.
- Si prova tutto senza VPN e senza Google, tranne il login stesso.
- Gli errori già visti in lecturenote sono vietati fin dall'inizio.

## Non obiettivi
- Nessun codice dell'app in questo passo: solo i documenti.
- Nessuna modifica a lecturenote.
- Nessun repository "starter" condiviso (approccio C scartato).

## Approcci considerati
- **A. Spec divisa + test** (scelto dall'utente): file corti per funzionalità, Vitest, finto Calendar, elenco errori, controllo per funzionalità.
- B. Solo correzioni alla spec esistente: più veloce ora, ma ogni sessione continua a leggere tutto.
- C. A + starter riutilizzabile: utile solo con una terza app in vista.

## Cosa viene prodotto (in `C:\Users\Utente\Documents\cruscotto\`)
La cartella diventa la radice del progetto; la spec originale resta in `Claude outputs/` come riferimento.

```
CLAUDE.md                 ~3 KB: scopo, stack, comandi, struttura, regole, "come lavoriamo", errori da evitare (≤10 righe)
docs/ROADMAP.md           solo tabella: #, funzionalità, file spec, stato, una riga di nota. Niente diario.
docs/spec/
  formato-calendar.md     titoli, prefissi di stato, descrizione, colori: condiviso da 03, 04, 05, 07
  01-base.md              scaffolding copiando da lecturenote (elenco file e cosa cambiare), Vitest, impostazioni, materie base, backup
  02-prova-login.md       prova tecnica: login GIS nella PWA installata su Android, con VPN, rinnovo token
  03-calendar.md          client Calendar, cache, parse.ts con test, finto Calendar
  04-oggi.md              scheda Oggi + Fatto/Salta/Annulla + coda offline (ex 4+5)
  05-sposta.md            findSlot con test, Non fatto, Parziale, Imprevisto (ex 6+7)
  06-pesi.md              materie e pesi con test
  07-ricalibro.md         ricalibro deterministico con test
  08-esercizi-flashcard.md (ex 10+11)
  09-ai.md                provider AI + ricalibro/flashcard con AI (ex 12+13)
  10-rifiniture.md        riepilogo per Notion, test su telefono, tablet e PC
```
Il modello dati sta in `01-base.md` finché non esiste `db/schema.ts`; da lì in poi lo schema è la fonte unica.

## Modifiche di contenuto rispetto alla spec originale
- **Provider AI**: Gemini + un provider "OpenAI-compatibile" generico (URL, chiave, modello). Anthropic tolto. Come esempi solo servizi con piano gratuito, con la nota "raggiungibilità dalla Cina da verificare". DeepSeek/Qwen non suggeriti (a pagamento).
- **Test**: Vitest (`npm test`). Per `planner/` e `calendar/parse.ts` i test si scrivono prima del codice. `npm test` si aggiunge a build e lint come verifica prima di dire "fatto".
- **Finto Calendar** (`lib/calendar/fake.ts`): stessa interfaccia del client vero, eventi di esempio in memoria; attivabile in sviluppo per provare Oggi, sposta e ricalibro senza VPN.
- **Coda offline**: ogni scrittura salva l'`etag` letto; all'invio usa `If-Match`. Se l'evento è cambiato nel frattempo, l'operazione non parte e torna in anteprima.
- **Prova del login subito** (riga 02), prima di costruire le schermate, sul telefono vero.
- **Controllo a fine funzionalità**: un sub-agente rivede le modifiche della sessione (correttezza + elenco errori) prima di aggiornare la roadmap.
- **Note di sessione** nei messaggi di commit, non nella roadmap.

## Errori da evitare (da lecturenote, vanno in CLAUDE.md)
- Ogni salvataggio o scrittura fallita si mostra all'utente, mai in silenzio.
- Operazioni a più passi (import, applicazione del ricalibro): o tutto o un riepilogo esatto di cosa è riuscito; mai dati a metà senza dirlo.
- Timeout su ogni richiesta, lettura della risposta compresa (`lib/http.ts` copiato da lecturenote).
- `navigator.storage.persist()` all'avvio.
- Aggiornamento della PWA solo su conferma (`registerType: 'prompt'`).
- Niente dati, chiavi o Client ID nei commit (repository pubblico).

## Lasciato a chi scrive i file
Formulazione dei testi, ordine delle sezioni dentro ogni file, quali dettagli della spec originale vanno in quale file (tutti devono finire da qualche parte, nessuno duplicato tranne il rimando a `formato-calendar.md`).

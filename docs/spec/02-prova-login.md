# 02 Prova del login Google

Prova tecnica prima di costruire le schermate. Nessuna funzionalità da consegnare: serve a sapere se il login funziona nella PWA installata. Richiede la riga 01 pubblicata su GitHub Pages.

## Creare il Client ID (gratis)
1. Su Google Cloud Console creare un progetto gratuito.
2. Abilitare Google Calendar API.
3. Creare un **Client ID OAuth di tipo "Applicazione web"**.
4. Origini autorizzate: l'URL di GitHub Pages e `http://localhost:5173`.
5. Incollare il Client ID nelle impostazioni dell'app, mai nel codice né nei commit (repository pubblico).

## Token client GIS
- Google Identity Services, token client, scope solo `https://www.googleapis.com/auth/calendar.events`.
- Il token resta in memoria. `lib/calendar/auth.ts` contiene solo la logica GIS.
- I pulsanti di prova (login ed `events.list`) stanno nella scheda Impostazioni, da rifinire nella riga 03.
- `events.list` di prova: `fetch` minimo tramite `lib/http.ts` (timeout), passando `timeZone`.

## Da verificare sul telefono vero, con l'app installata come PWA
- Login con un tocco: il popup di Google si apre e torna all'app.
- Rinnovo del token dopo la scadenza (1 h) senza perdere lo stato dell'app.
- VPN accesa: funziona. VPN spenta: messaggio "VPN spenta?".
- Una lettura `events.list` di prova va a buon fine.

## Fatto quando
- Il risultato è scritto in una riga nella colonna Nota di `docs/ROADMAP.md`.
- Se il popup non funziona nella PWA installata: fermarsi e decidere con l'utente prima della riga 03.

# 12 Sincronizzazione tra dispositivi

**Obiettivo**: stessi dati su telefono, tablet e PC, senza backend e gratis.
**Leggere**: `src/db/schema.ts` (ogni riga ha `id` UUID e `updatedAt`), `lib/calendar/auth.ts` (riga 02), `features/backup/` (riga 01), `lib/http.ts`.

## Scelta
- Google Drive `appDataFolder` (cartella privata dell'app, nascosta all'utente), con Google Identity Services e scope `drive.appdata`. Come Calendar, dalla Cina richiede la VPN; offline l'app resta usabile e sincronizza dopo.
- Il token resta in memoria (come per Calendar); Client ID solo nelle impostazioni.
- L'export/import JSON (riga 01) resta il ripiego e non va rimosso.

## Regole di fusione (`lib/planner/merge.ts`, pura)
- Per riga: stesso `id` → vince `updatedAt` più recente (last-write-wins per riga). Righe cancellate: lapide con `id` e `updatedAt`.
- `settings`: mai le chiavi `apiKey.*`; nemmeno token, Client ID, coda offline, `timer.*`; cache `events` esclusa (si rilegge da Calendar).
- Le carte e il `revlog` si fondono per riga; un `revlog` è solo in aggiunta, mai modificato.
- Orologi dei dispositivi sfasati: se la differenza supera un minuto, avvisare invece di scegliere in silenzio.
- **Test prima del codice** per `merge.ts`: riga solo da un lato, conflitto, lapide, `apiKey.*` escluso, `revlog` in aggiunta.

## Flusso
- Pulsante "Sincronizza ora" (e all'apertura se online): scarica il file, fonde, scrive il file, mostra un riepilogo esatto (righe aggiunte, aggiornate, in conflitto). Se la scrittura fallisce, lo si dice: mai dati a metà.
- Errori specifici: VPN spenta, token scaduto, quota Drive.

## Fatto quando
- Due browser con lo stesso Google fondono i dati; le chiavi non passano; il ripiego JSON funziona ancora.
- Build, lint, test; revisione con sub-agente; ROADMAP aggiornata.

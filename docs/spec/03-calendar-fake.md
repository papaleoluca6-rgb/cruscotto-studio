# 03 Finto Calendar (`lib/calendar/fake.ts`)

Citato da `03-calendar.md`; letto anche dalle righe 04-05 per i test.

- Stessa interfaccia del client (`list`, `get`, `patch`, `insert`, `delete`), eventi di esempio inventati (nessun dato reale, repo pubblico) in memoria, con `etag`, `extendedProperties` e `reminders`. Attivabile in sviluppo: si usa questo, non il Calendar vero.
- 412 se `ifMatch` non coincide con l'etag; nuovo etag dopo ogni scrittura (test della riga 04).
- `syncToken`: la prima lettura (senza `timeMin`/`timeMax`/`orderBy`/`privateExtendedProperty`) restituisce `nextSyncToken`; le letture successive restituiscono solo gli eventi cambiati o cancellati. Il finto rifiuta (400) un `syncToken` mandato insieme a quei parametri e risponde 410 a un token scaduto o sconosciuto.
- Il filtro `privateExtendedProperty` funziona come il vero (solo senza `syncToken`).

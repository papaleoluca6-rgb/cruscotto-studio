# 06 Materie e pesi

**Obiettivo**: dire quanto studiare ogni materia nei prossimi 7 giorni e se si è in linea.
**Leggere**: `src/db/schema.ts` (`subjects`, `log`, `events`).

## `planner/weights.ts` (funzione pura)
- punteggio = difficoltà × importanza × urgenza × (1 + 0,1 × arretrato).
- urgenza = 21 / giorni all'esame, limitata fra 0,5 e 3; 0,8 senza data.
- arretrato = sessioni da segnare negli ultimi 7 giorni + non fatte negli ultimi 14.
- quota = punteggio / somma.
- Ore consigliate (7 giorni) = ore di studio pianificate × quota.
- Il cinese (vocaboli) è fisso e non entra nelle quote. Importanza 0 esclude la materia.
- **Test prima del codice**: urgenza ai limiti (0,5 e 3), senza data (0,8), arretrato, importanza 0, cinese escluso, somma delle quote = 1.

## Scheda Materie (`features/subjects/`)
- Modifica di difficoltà, importanza (0-5), data esame, "il prof è a", "io sono a".
- Per materia: quota, ore pianificate contro consigliate (barra con indicatore), fatte negli ultimi 7 giorni, arretrato.
- Stato: "in linea" (±20%), "mancano X h", "X h in più".

## Fatto quando
- Test di `weights.ts` passano e la scheda mostra i valori sui dati reali (o del finto Calendar).
- Build, lint, test; revisione con sub-agente; ROADMAP aggiornata.

# Formato delle sessioni su Calendar

Letto da 03, 04, 05, 07. Fonte unica di titoli, stati, descrizione e colori.

## Titolo
- `<Materia> Study: <argomento>`
- `<Materia> Review +1d|+1w|+3w|pre-exam: <argomento>`
- `<Materia> Exercises: <esercizi>`
- `<Materia> Simulazione: <prova>` (prova d'esame a tempo su temi passati).
- Inoltre `CPT Pronto: …` (progetto) e `Ripasso vocaboli` (cinese).
- Il titolo basta anche se la materia non è configurata: serve il tipo seguito dai due punti (le lezioni restano fuori). La materia si collega solo se il prefisso coincide con una di Impostazioni → Materie.

## Prefissi di stato nel titolo
- `✅ ` fatto
- `◐ ` parziale
- `↻ ` spostato (ancora da fare)
- `✗ ` saltato
- Da segnare = senza prefisso o con ↻, con fine nel passato.
- Un solo prefisso per titolo: il nuovo sostituisce il vecchio.

## Descrizione su 4 righe
- `Material:` file e pagine/slide esatte
- `Task:`
- `Done when:`
- `Notion:` (facoltativa)

## Tag sugli eventi dell'app
- Ogni evento creato o gestito dall'app porta `extendedProperties.private`: `cruscotto=1`, `tipo`, `materia`. Il titolo resta la riserva (fallback) per eventi fatti a mano o da Claude.
- Promemoria popup: `reminders={useDefault:false, overrides:[{method:'popup', minutes:N}]}` (N dalle impostazioni, default 10).

## Colore per materia (colorId di Google)
Il colore è la materia: `colorId` mai per lo stato (lo stato sta nei prefissi).
Analog 6, Communication 10, Analisi 2 5, ALP 3, CPT 9, DSP 8, Cinese 4.
Le materie si configurano nelle impostazioni (nome, prefisso del titolo, colore).

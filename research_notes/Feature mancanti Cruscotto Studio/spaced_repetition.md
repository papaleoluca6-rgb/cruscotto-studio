# Spaced repetition and flashcards for Cruscotto Studio (Leitner vs SM-2 vs FSRS, card types, Anki import, features to add)

Research date: 2026-11-19. Facts below come from pages fetched or searched this session. Items not verified this session are marked "(not verified)" and are listed in Inferences or Gaps.

## 1. Leitner vs SM-2 vs FSRS: measured differences, and is there a free offline TypeScript FSRS library?

### Takeaway
FSRS predicts recall much better than SM-2. On the open-spaced-repetition benchmark, built from about 10k Anki collections, FSRS-6 has lower log loss than Anki SM-2 for 99.6% of collections. **Leitner is not in any benchmark I found.** Its closest benchmarked relative, Duolingo's HLR, scores far worse than FSRS. **ts-fsrs is MIT-licensed, actively maintained (v6.0.0 is out, with FSRS-7 as the default), pure TypeScript, and has one small dependency, so it can run fully offline in the browser.** The claim that FSRS saves 20–30% of reviews comes from simulations and vendor sources, not from controlled trials.

### Cited Findings
**Benchmark data (open-spaced-repetition/srs-benchmark)**
- **Dataset:** Anki review logs from about 10k users, roughly 727M reviews. After filtering, the evaluation uses 9,999 collections and 349,923,850 reviews without same-day reviews, or 10,000 collections and 519,296,315 reviews with them. — [srs-benchmark README](https://github.com/open-spaced-repetition/srs-benchmark/blob/main/README.md)
- **Results without same-day reviews** (mean ± 99% CI; lower log loss and RMSE are better, higher AUC is better). Note that the AVG baseline (0 parameters) beats HLR on log loss. — [srs-benchmark](https://github.com/open-spaced-repetition/srs-benchmark)

  | Model | Params | Log loss | RMSE(bins) | AUC |
  |---|---|---|---|---|
  | FSRS-7 | — | 0.3401 | 0.0634 | 0.7167 |
  | FSRS-7, default params (not optimized) | — | 0.3620 | 0.0910 | 0.7029 |
  | FSRS-6 | 21 | 0.3460 | 0.0653 | 0.7034 |
  | FSRS-5 | 19 | 0.3561 | 0.0742 | 0.7010 |
  | FSRS-4.5 | 17 | 0.3625 | 0.0764 | 0.6891 |
  | HLR (Duolingo half-life regression) | 3 | 0.4694 | 0.1275 | 0.6369 |
  | Ebisu v2 | — | 0.4989 | 0.1627 | 0.6051 |
  | AVG baseline | 0 | 0.3945 | 0.1034 | 0.4997 |

- **Better than FSRS:** the neural RWKV-Instant model (log loss 0.2773, AUC 0.8329). FSRS-7 "recency" reaches 0.3370. — [srs-benchmark README](https://github.com/open-spaced-repetition/srs-benchmark/blob/main/README.md)
- **SM-2 and Leitner** do not appear in the current README tables. SM-2 shows up only in a run command. — [srs-benchmark README](https://github.com/open-spaced-repetition/srs-benchmark/blob/main/README.md)
- **FSRS vs SM-2 head to head:**
  - Collections where the first model has lower log loss: FSRS-6 (recency) beats Anki SM-2 in 99.6%, beats FSRS-5 in 88.2%, and optimized FSRS-6 beats default-parameter FSRS-6 in 84.3%. — [Expertium, Benchmark of Spaced Repetition Algorithms](https://expertium.github.io/Benchmark.html)
  - The author cautions that "There is no way to have a truly fair, no caveats, comparison between FSRS and SM-2", because SM-2 was not built to predict probabilities. — [Expertium](https://expertium.github.io/Benchmark.html)
  - A secondary source quotes the last table that included SM-2 (August 2025): FSRS-6 log loss 0.3456 vs Anki SM-2 0.616. Other write-ups give different SM-2 numbers depending on benchmark version. — via search summary of [DEV Community](https://dev.to/palachdigital_20fd679f5fe/why-fsrs-is-better-than-sm-2-2m17) and [mojimori blog](https://mojimori.app/blog/spaced-repetition-algorithms-ebbinghaus-to-fsrs) (secondary, not checked against the original table)
- **Leitner:** the only figure found is a log loss of 0.397 attributed to the FSRS benchmark, in a DEV Community post. It is unverified. — [DEV Community (qcrao)](https://dev.to/qcrao/how-i-picked-an-srs-algorithm-for-tubevocab-without-becoming-an-anki-nerd-1m2l)

**Review workload**
- Anki's FAQ says only qualitatively that FSRS users do fewer reviews than with the default algorithm for the same retention. — [Anki FAQ](https://docs.ankiweb.net/faqs/what-spaced-repetition-algorithm.md)
- Claimed savings vary by source:
  - "~25% fewer daily reviews at 90% retention", attributed to Expertium. — [Diane](https://www.diane.app/en/guides/fsrs-vs-sm2)
  - 30–50% on another page from the same vendor. — [Diane outils](https://www.diane.app/en/outils/fsrs)
  - "20%–30%" from RemNote's own blog, not independently verified. — [RemNote](https://www.remnote.com/feature/spaced-repetition)
- Expertium's benchmark page gives no workload figure. — [Expertium](https://expertium.github.io/Benchmark.html)
- Counter-evidence: Anki forum users report that FSRS at 90% retention can feel more frequent than SM-2, and that a tuned SM-2 interval modifier narrows the gap. — [Anki forums](https://forums.ankiweb.net/t/has-anyone-done-a-live-comparison-of-fsrs-and-sm2-as-implemented-in-anki-it-looks-like-no-so-can-anyone-help-me-set-it-up/34996/16)
- In Anki, desired retention defaults to 90%. It is "the most important setting in FSRS". Anki recommends staying below 97% because workload rises steeply near 100%. — [Anki manual, Deck options](https://docs.ankiweb.net/deck-options.html)

**ts-fsrs (the TypeScript library)**
- **License and repo:** MIT, at github.com/open-spaced-repetition/ts-fsrs. About 882 stars and 494 commits when fetched, with CI, a release workflow and changesets. — [GitHub](https://github.com/open-spaced-repetition/ts-fsrs)
- **Versions and models:** the latest npm version is 6.0.0. The 5.x line (e.g. 5.4.1) implements FSRS-6. — [jsDelivr](https://www.jsdelivr.com/package/npm/ts-fsrs); [ts-fsrs 5.4.1 README](https://cdn.jsdelivr.net/npm/ts-fsrs@5.4.1/README.md)
  - v6 supports FSRS-3, 4, 4.5, 5, 6 and 7. `DefaultScheduler()` uses FSRS-7 if no version is given. — [ts-fsrs 6.0.0 README](https://cdn.jsdelivr.net/npm/ts-fsrs@6.0.0/README.md)
  - FSRS-7 has 34 parameters, against 21 for FSRS-6. — [haskell-fsrs](https://hackage-content.haskell.org/package/haskell-fsrs)
- **Package details (v6.0.0 package.json):**
  - license MIT
  - one dependency, `@open-spaced-repetition/srs-kit` 1.0.0
  - `sideEffects: false`
  - ESM and CJS builds
  - subpath exports for `./reschedule`, `./middlewares` and each model (`./models/fsrs-6`, `./models/fsrs-7`, …), so unused models can be tree-shaken
  - `engines: node >=24.0.0`

  — [package.json](https://cdn.jsdelivr.net/npm/ts-fsrs@6.0.0/package.json)
- **v6 API:**
  - `const scheduler = await DefaultScheduler()`, then `scheduler.newCard({ now })`, `scheduler.preview({ card, now })` and `scheduler.review({ card, grade: Rating.Good, now })`.
  - `review()` returns a new card plus a revlog entry without mutating the input. Store both.
  - Options: `desiredRetention` (example 0.9), `maximumInterval` (example 36_500), `enableFuzz`, `enableShortTerm`, `learningSteps` (e.g. `['1m','10m']`), `relearningSteps` (e.g. `['10m']`) and `weights` (preset per model if omitted).
  - Retrievability: `scheduler.model.forgettingCurve(memoryState, elapsedDays)`.
  - The quickstart needs ESM with top-level await.

  — [ts-fsrs 6.0.0 README](https://cdn.jsdelivr.net/npm/ts-fsrs@6.0.0/README.md); [GitHub](https://github.com/open-spaced-repetition/ts-fsrs)
- **Parameter optimizer:** `@open-spaced-repetition/binding` is a separate package. It trains parameters from review logs, and its README covers browser/WASI setup. — [GitHub ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)
- **Maintenance:** Snyk rates ts-fsrs healthy, with at least one release in the past 3 months. — [Snyk](https://security.snyk.io/package/npm/ts-fsrs)
- **Other users:** RemNote maintains a fork (github.com/remnoteio/ts-fsrs). RemNote offers FSRS-6 alongside SM-2. — [remnoteio/ts-fsrs](https://github.com/remnoteio/ts-fsrs); [RemNote](https://www.remnote.com/feature/spaced-repetition)

### Inferences
- **Is Leitner enough?** For a single student with a few hundred to a few thousand cards, the current Leitner setup (boxes 1/2/4/8/16 days) works. Its weak points:
  - It caps at 16 days, so mature cards keep coming back about twice a month forever. That adds review load as the deck grows.
  - It treats every card in a box the same, whatever its history.
  - It cannot estimate retention, so there is no forecast, no "probability you know this on exam day", and no retention target.

  FSRS fixes all three. Since ts-fsrs is MIT, offline and free, switching costs little.
- **Ratings map directly:** the app already uses four buttons (Again/Hard/Good/Easy), which match FSRS `Rating` 1–4 exactly.
- **Migration path:**
  1. Store `card` (stability, difficulty, due, state, reps, lapses, …) and `revlog` rows in Dexie, as a new `db.version(n)` per CLAUDE.md.
  2. Convert existing Leitner cards to FSRS with a rough first stability from their current box interval. ts-fsrs ships a `./reschedule` export that may help (not verified in detail).
  3. Keep default weights. The benchmark shows that unoptimized FSRS-7 (log loss 0.3620) is still far better than HLR and close to FSRS-5 with optimized parameters.
  4. Add the optimizer only much later, after about 1,000+ reviews. Its usefulness threshold is not verified.
- **Version choice:**
  - ts-fsrs 6.0.0 is brand new and requires Node ≥24, at least for its tooling. The `engines` field does not block bundling with Vite, but the repo's dev environment must meet it.
  - The safer choice for now is ts-fsrs 5.4.x (FSRS-6, stable API: `createEmptyCard`, `fsrs()`, `repeat/next` — from memory, not re-fetched).
  - Alternatively use 6.x with `./models/fsrs-6` or `-7`. Pin the exact version.
- **Deterministic and testable:** FSRS is a pure function of card state, rating and time, so it fits the `features/planner` / `lib/` "pure, tested" rule. Disable fuzz in tests, or seed it.
- **Use a desired-retention setting**, defaulting to 0.90 as Anki does, instead of fixed boxes. It is a single knob the user understands.

### Gaps
- No current, verifiable benchmark row for SM-2 or Leitner. The SM-2 log loss of 0.616 and Leitner 0.397 come from secondary sources.
- No controlled study on real students measuring FSRS review savings. All percentages come from simulations or vendors.
- ts-fsrs 6.0.0 publish date, minified/gzipped size, and whether `srs-kit` has further transitive dependencies were not verified. npmjs.com returned 403.
- The minimum review count for the optimizer to beat default weights was not found.

## 2. Card types worth having for engineering/maths and Chinese vocab, and which are cheap in a PWA

### Takeaway
**Cheapest and most useful, in order:**
1. Reverse / both-direction cards. Needed for Chinese: 汉字→meaning, meaning→汉字, audio→meaning.
2. Cloze (`{{c1::…::hint}}`). Good for formulas and definitions.
3. Math rendering with KaTeX.
4. Image occlusion. More effort, but Anki has had it natively since 23.10, which shows demand.

Pinyin and audio can lean on browser TTS, which works offline only if the device has a Chinese voice. That was not verified.

### Cited Findings
- **Cloze in Anki:**
  - Anki has a dedicated cloze note type. The syntax is `{{c1::1913}}`; the number selects the deletion, and a hint goes after `::`, as in `{{c1::Canberra::city}}`.
  - Image Occlusion: "Anki 23.10+ supports Image Occlusion cards natively."
  - The editor's Fx button inserts MathJax/LaTeX.

  — [Anki manual, Editing](https://docs.ankiweb.net/editing.html)
- **Bury siblings:** Anki can bury new, review or interday-learning siblings. Each pushes cards from the same note to the next day, which matters once a note makes several cards (reverse, cloze c1/c2). — [Anki manual, Deck options](https://docs.ankiweb.net/deck-options.html)
- **Hack Chinese study modes:** recognition (character→meaning), recall (meaning→character), listening (audio→meaning) and typing (meaning→pinyin). It is sentence-based, priced at $14.99/month or $99/year with no free trial (March 2026). Source is a competitor's review. — [HSKLord, Hack Chinese review](https://hsklord.com/blog/hack-chinese-review); [GoEast Mandarin](https://goeastmandarin.com/hack-chinese-review/)
- **Pleco flashcards** include tone drills and fill-in-the-blank handwriting. Reviewers disagree on how strong its SRS is: one says "no real spaced repetition algorithm", while the App Store listing mentions SRS. — [Pleco App Store](https://apps.apple.com/us/app/-/id341922306); [hsklord Pleco review](https://hsklord.com/blog/pleco-review); [Pleco manual](https://iphone.pleco.com/manual/30200/flashtut.html)
- Guidance for Chinese apps says to show pinyin with tone marks, not tone numbers. — via search summary of [hsklord flashcard apps](https://hsklord.com/blog/best-chinese-flashcard-apps)

### Inferences
- **Cheap to build (hours each):**
  - **Reverse cards:** a note produces 2–3 cards; schedule each separately and bury siblings the same day.
  - **Cloze:** parse `{{cN::text::hint}}` into N cards.
  - **Typed answer for pinyin:** compare after normalizing tone marks against tone numbers.
  - **KaTeX** for `$…$` / `$$…$$`: MIT license; bundle it locally rather than from a CDN, for offline use and China access. License from memory, not re-verified.
- **Audio, medium effort:**
  - The Web Speech API `speechSynthesis` with a `zh-CN` voice is free and needs no server. Offline availability depends on the OS voice, which is not verified.
  - Recorded audio can be stored as Blobs in IndexedDB.
- **Image occlusion, highest cost:** the image as a Blob, rectangles stored as normalized coordinates, an SVG overlay, one card per mask. It suits circuit schematics and block diagrams (Analog electronics, DSP). Worth doing later.
- **For engineering, AI generation matters more than rich card types.** The app's AI provider can turn lecture-topic notes into cloze and Q/A cards. It must stay optional, as CLAUDE.md requires.

### Gaps
- No measured evidence found on which card types work best for engineering or maths.
- KaTeX license, bundle size, and offline availability of zh-CN TTS voices on Android Chrome were not verified this session.

## 3. Import/export with Anki (.apkg, CSV, text) in the browser without a server

### Takeaway
It is feasible fully client-side:
- **CSV/TSV text import/export:** trivial.
- **Reading .apkg:** unzip, then open SQLite through sql.js (WASM). Newer exports store `collection.anki21b` compressed with zstd, so a zstd decoder is also needed.
- **Writing .apkg:** several JS/TS libraries exist (genanki-js, anki-apkg-export, apkg-browser-builder, ankipack), all young or WIP.

The simplest robust path is CSV/TSV both ways, plus an optional .apkg reader.

### Cited Findings
- **Format:** an `.apkg` is a ZIP. `collection.anki21b` is the latest database format and is zstd-compressed. Older packages contain `collection.anki2` / `collection.anki21`. Decompressing zstd is the hard part. — via search summary of [Anki forums: collection.anki21b in Python](https://forums.ankiweb.net/t/is-there-any-way-to-open-the-collection-anki21b-file-through-python/31788) and [Collection.anki2 in exported .apkg](https://forums.ankiweb.net/t/collection-anki2-in-exported-apkg-file/44380)
- **Libraries:**

  | Library | What it does | Status / source |
  |---|---|---|
  | **anki-reader** (npm, ewei068) | Reads `.apkg` / `.anki2` in Node, Bun and browsers, using sql.js. Needs configuration so sql.js can find its WASM file. Exposes the raw DB. | Marked work in progress. [unpkg README](https://app.unpkg.com/anki-reader@0.3.0/files/README.md) |
  | **anki-apkg-parser** | Node only, uses sqlite. | [GitHub](https://github.com/74Genesis/anki-apkg-parser) |
  | **ankipack** (ImGajeed76) | TypeScript; generates, reads and edits `.apkg` with FSRS deck options. Writes the current schema-18 layout, not legacy schema 11. Works in browsers, Node and Bun. | Posted 21 Aug 2026; license not stated in the post. [Anki forums](https://forums.ankiweb.net/t/ankipack-typescript-library-for-creating-reading-and-editing-apkg-files/70771) |
  | **apkg-browser-builder** | Creates Anki decks in the browser. | Posted 19 Jul 2026; no details found. [Anki forums](https://forums.ankiweb.net/t/apkg-browser-builder-typescript-library-for-creating-anki-decks-in-a-browser/70471) |
  | **genanki-js**, **anki-apkg-export** | Older JS `.apkg` generators. | [genanki-js forum](https://forums.ankiweb.net/t/genanki-js-generate-anki-decks-using-javascript/11810.md); [anki-apkg-export npm](https://npmjs.com/package/anki-apkg-export) |
  | **anki-apkg-extractor** (Python) | Handles anki21b, anki21 and anki2. Useful reference for the zstd step. | [ecosyste.ms](https://awesome.ecosyste.ms/projects/github.com%2F5mdld%2Fanki-apkg-extractor) |

### Inferences
- **Recommended order:**
  1. **CSV/TSV export/import**, with columns front, back, subject, topic, tags and optionally type (cloze/basic/reverse). Anki imports this natively and so do most apps. Quizlet and Pleco can also exchange tab-separated text (not verified).
  2. **Include FSRS card state and revlog in the existing JSON backup.** It already exists per CLAUDE.md.
  3. **.apkg import, optional:** JSZip or fflate, then sql.js. This means a WASM file of roughly 1 MB (size from memory) shipped with the PWA. Add a zstd decoder for anki21b, then map `notes.flds` (split on `\x1f`) to cards. Media files are optional.

  Licenses (from memory, verify before adoption): sql.js MIT, JSZip MIT/GPLv3 dual, fflate MIT.
- **Load .apkg support lazily** (dynamic `import()`) so the main bundle stays small.
- **Imports must be all-or-nothing:** run them inside a Dexie transaction and give an exact summary, as the CLAUDE.md rules on multi-step operations require.

### Gaps
- No verified pure-JS or WASM zstd decoder package or license was found this session.
- Licenses of anki-reader, ankipack and apkg-browser-builder were not confirmed.
- Not verified whether ankipack reads anki21b, or reads scheduling data and revlog.

## 4. Features students value (Anki, RemNote, Mochi, Quizlet, Pleco, Hack Chinese): daily limits, forecast, leeches, stats, cram, linking cards to notes

### Takeaway
**Features that matter, in rough priority:**
1. Daily new-card and review limits.
2. Leech detection (Anki default: 8 lapses → tag and suspend).
3. Workload forecast / simulator.
4. Exam-date planning (RemNote's Exam Scheduler front-loads at-risk cards).
5. Retention stats.
6. Cards linked to their source note or topic (RemNote's core design).

Several of these are paid in commercial apps: RemNote's Exam Scheduler is reported as Pro at $8/month, and Hack Chinese is fully paid. Building them in a free app adds real value.

### Cited Findings
- **Anki daily limits:**
  - New Cards/Day caps introductions; Maximum Reviews/Day caps reviews.
  - Rule of thumb: about 20 new cards a day leads to roughly 200 reviews a day.
  - Anki's starting ease is 2.50 for SM-2. Maximum interval defaults to 100 years.

  — [Anki manual, Deck options](https://docs.ankiweb.net/deck-options.html)
- **Anki FSRS tooling:**
  - A simulator estimates reviews or minutes per day from real memory states.
  - "Compute minimum recommended retention" was removed in Anki 25.07.
  - "Easy Days" lightens chosen weekdays without changing total workload.

  — [Anki manual, Deck options](https://docs.ankiweb.net/deck-options.html)
- **Anki leeches:** the default threshold is 8 lapses. The default action adds a `leech` tag and suspends the card. Warnings repeat every half-threshold after that (12, 16, …). Recommended fix: rewrite the card ("change how the information is presented"), split it, or add a mnemonic. Delete it if not worth keeping; for confusable pairs, suspend one until the other is learned. — [Anki manual, Leeches](https://docs.ankiweb.net/leeches.html)
- **RemNote:**
  - Exam Scheduler: you enter an exam date and it builds a day-by-day review plan so every card is seen enough before the test, front-loading cards most at risk of being forgotten.
  - Offers FSRS-6 and SM-2. Sources conflict on which is the default.
  - The Exam Scheduler is reported as part of Pro ($8/month).

  — [RemNote spaced repetition](https://www.remnote.com/feature/spaced-repetition); [RemNote blog: best Anki alternatives](https://www.remnote.com/blog/best-anki-alternatives); [RemNote vs Anki](https://alpha.remnote.com/blog/remnote-vs-anki)
- **Hack Chinese:** new words come back for review within 24 hours, and words you may have forgotten resurface. Four study modes (see section 2). — [GoEast Mandarin](https://goeastmandarin.com/hack-chinese-review/); [hsklord](https://hsklord.com/blog/hack-chinese-review)

### Inferences
- **Minimum feature set for the app:**
  1. A per-subject daily new-card limit, plus a global review cap with a warning rather than silently hiding cards.
  2. **Leech:** at 8 lapses (configurable), tag the card and suggest "rewrite / split / ask AI to rephrase". Rephrasing fits the existing optional AI explain feature. Do not delete.
  3. **7–10 day load forecast:** count due dates per day from the FSRS `due` field. This feeds directly into the app's existing recalibration of the next 7–10 days.
  4. **Retention stats:** true retention (share of non-Again answers on review cards) per subject over 7 and 30 days, compared with the desired retention.
  5. **Cram before exam:** a filtered session with no effect on scheduling (Anki "filtered decks", not re-verified this session). Or RemNote-style: for subjects with an exam date, review cards whose predicted retrievability at the exam date (`forgettingCurve`) is below target, lowest first. Only FSRS gives the retrievability needed; Leitner cannot.
- **Mochi and Quizlet:** no sources fetched this session (see Gaps).

### Gaps
- No primary sources fetched for Mochi or Quizlet features (Quizlet Learn/Test modes, Mochi markdown cards and its scheduling).
- Hack Chinese's leech handling and its exact algorithm were not found.
- No surveys or Reddit threads were fetched (r/Anki, r/ChineseLanguage), so "what students value" rests on vendor docs and review sites, some written by competitors (HSKLord).
- Anki filtered-deck and cram details were not re-fetched this session.

## 5. Connecting topic-level spaced reviews (calendar sessions) with card-level spacing

### Takeaway
No source found describes a tested design for combining calendar topic reviews with card SRS. The closest product is RemNote, which links cards to notes and plans reviews toward an exam date. **A practical design:** tag every card with its subject and lecture topic. When a calendar topic review (+1d/+1w/+3w/pre-exam) starts or is marked done, show the due and at-risk cards of that topic, and feed per-topic card retention back into the planner.

### Cited Findings
- RemNote's core design creates flashcards inside notes, so cards stay linked to their source. Its Exam Scheduler plans reviews toward a date. — [RemNote spaced repetition](https://www.remnote.com/feature/spaced-repetition); [mindomax: which app integrates flashcards and notes](https://www.mindomax.com/which-app-integrates-flashcards-and-notes-best)
- FSRS provides retrievability as a function of elapsed time (`forgettingCurve(memoryState, elapsedDays)`), so it can predict recall at any future date, such as an exam or a planned topic session. — [ts-fsrs 6.0.0 README](https://cdn.jsdelivr.net/npm/ts-fsrs@6.0.0/README.md)

### Inferences
- **Data model:** add `topicId` (optional) to cards, next to `subjectId`. Topics are the lecture topics already scheduled as calendar reviews.
- **Topic session → cards:** when a calendar topic review is opened or marked done, open "Ripasso argomento" with:
  - due cards of that topic, and
  - not-yet-due cards whose retrievability is under about 0.85.

  Reviewing early is fine with FSRS: it uses actual elapsed time, so off-schedule reviews do not corrupt the model. This follows from how the forgetting curve is used, but was not verified in a source.
- **Cards → planner:**
  - Per-topic mean retrievability, or lapse rate, can tell the deterministic recalibrator to add or move a topic review. Example: topic retention below 80% leads to an extra session proposed in the 7–10 day window, always with preview and confirmation before any Calendar write.
  - Conversely, if all cards of a topic are mature with high retrievability, the +3w session can be shortened.
- **Pre-exam:** use the exam date per subject and run the cram list from section 4 before the "pre-exam" calendar session. Calendar sessions stay topic-level; card scheduling stays per card. Do not create calendar events per card.
- **Keep the two systems independent:** card spacing works without Calendar, offline and without VPN, so card review must never depend on calendar sync. Only the suggestions flow between them.
- **Dexie fields to persist, as a single schema change:**
  - card: `stability`, `difficulty`, `due`, `state`, `lapses`, `reps`, `last_review`
  - revlog: `cardId`, `rating`, `reviewedAt`, `elapsedDays`, `scheduledDays`

### Gaps
- No academic or product source found that evaluates combining topic-level calendar reviews with item-level SRS.
- Research on the "expanding intervals" for topic reviews (+1d/+1w/+3w) vs item-level SRS was not fetched this session.

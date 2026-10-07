# Play saved Registro decks in ZAFF

Status: stages 1–3 implemented on `codex/playable-saved-decks-plan`; live migration/backfill applied on 2026-10-07. Stages 4–5 remain the later JSON-removal work.
Prepared against `2fc440b`; revised after the main merge at `0346d40` and implemented with the updated Registro UI.

## Implementation checkpoint — 2026-10-07

- Applied `supabase/migrations/20261007192702_playable_saved_deck_cards.sql` to **MTG match tracker**, project `iyhjfmjgkbhsloqslsbk`, organization **AleOgre**. The file version matches the recorded remote migration. Older numbered migrations remain unchanged.
- Backfilled **13 decks / 545 groups / 1,018 copies**, including all **473 distinct names**. Every row has a Scryfall ID, Oracle ID, front image and type line. Normalized JSON/row mismatches and orphan rows: **0**. Original JSON was retained, including absent section fields.
- The user-provided [Card Kingdom listing](https://www.cardkingdom.com/mtg/secret-lair/wrath-of-god-441-shrinking-storm-foil) and Scryfall `/cards/sld/441` confirm **Shrinking Storm → Wrath of God**. A verified name alias preserves “Shrinking Storm” in the deck while choosing the first valid ordinary Wrath of God result. No specific Secret Lair printing is forced.
- `savedDecks.ts` supplies one embedded database snapshot per read. Registro still reads names/quantities from JSON, enriched with assigned row IDs; ZAFF reads `cardRows`. `GameStats` also uses this service so its detail/statistics views retain the same printing as the editor/list.
- All Registro writes use the atomic save RPC with revisions. New groups resolve automatically, existing identities stay fixed, deleted groups disappear, and deletion cascades. Log-only unresolved saves require an explicit button; network errors remain retryable. The old JSON update path is still synchronized for already-open older clients.
- Scryfall v6 stores identity plus existing face/mana/token data, uses exact/localized lookup, shares a 550 ms queue, and deduplicates pending work. Saved groups hydrate rich metadata by printing ID. The old fuzzy v5 cache is ignored for identity assignment.
- ZAFF's saved selector includes every creator and source, independent of MTGJSON catalogue errors. Preview keeps unresolved groups visible and blocks incomplete decks; confirmation rereads the selected deck and asks for another review if its revision changed.
- Verified SQL behavior in disposable PostgreSQL 17: guest read/no write, own/other/legacy permissions, immutable IDs/owner, quantity/group removal, cascades, invalid input, stale save/backfill rejection, deferred parity, rollback and privileged-only backfill. The complete real-data backfill also passed locally.
- Verified the live anonymous Data API embedding: all 13 decks and 545 rows readable without login; guest writes/save RPC and authenticated backfill RPC denied. Realtime includes both tables. Supabase advisors report no new child-table/RPC issues; remaining findings concern existing [Auth password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) and [older table policies/indexes](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
- App verification: 47 tests covering resolver/cache, imports, editor saves/conflicts, card picker/views/statistics and catalogue selection; production build passes. Two browser players loaded a 63-card saved deck and a 22-card MTGJSON deck into the same local room. Server state confirmed both totals; drag/reveal/tap on a saved card appeared on the other client. No Go/protocol changes were needed.
- Live backups and enriched data/SQL are ignored under `.local/`; they are not checked into Git. This branch has local frontend changes for trying before publishing. See `supabase/migrations/README.md` for the local run and backfill instructions.

The following analysis records the pre-implementation audit and the intended later transition.

## Outcome

Every deck in `mazzi` can be selected in ZAFF, previewed with card artwork, and loaded into a multiplayer game. Add a **Saved decks / Mazzi salvati** dropdown beside the existing MTGJSON deck controls. Include decks from every creator, legacy decks without an owner, imported decks, manual decks, and saved precons; do not filter by `created_by` or `source`.

Introduce the requested `public."mazzi-cards"` table first and retain `mazzi.cards` during the transition. Later, switch Registro readers to the new rows, reconstruct the existing card-list shape in the service layer, and remove the stored JSON column in a separate migration.

## Pre-implementation audit

- Project instructions are in root `AGENTS.md`; no `CLAUDE.md` was found. Use the shared UI kit and its existing tokens for all controls and status messages.
- Registro accesses Supabase directly from React. `DeckList` parses files/pasted text; `DeckEditor` creates and updates `mazzi`. Import only fills a draft; saving writes it. The new “Crea Nuovo Mazzo” dialog offers manual entry, file import, and paste import; retain that flow.
- A saved card currently contains `name`, `qty`, and optionally `section`. Missing sections mean `main`. Imported printing information has already been discarded, so historical artwork cannot be recovered precisely.
- `DeckPicker`, `App`, `DeckPreview`, and `GameView` currently accept MTGJSON-specific types. `GameView` expands quantities into `{ cardId, imageUrl }` entries for `LOAD_DECK`; no server protocol change is needed to supply the same entries from saved decks.
- Current gameplay combines main deck, sideboard, and commander into the player's deck zone. The first release preserves that behavior for both sources. Separate sideboard/command zones and turning a double-faced card to its reverse face are later gameplay features; reveal/hide currently uses the generic card back.
- Latest read-only check on 2026-10-07: **13 decks**, **545 card entries**, **1,018 copies**, **473 distinct names**, **291 entries without a section**, and **29 sideboard entries**. All entries have valid names/positive integer quantities and there are no duplicate normalized name/section groups. There are **10 brew**, **3 precon**, and **2 ownerless** decks. Stored card objects still contain only `name`, `qty`, and `section`.
- The original 2026-10-05 Scryfall experiment resolved all 382 distinct names. The fresh 2026-10-07 audit resolves **472 of the current 473 names** without fuzzy matching: seven collection requests, exact named fallbacks (including the four split/adventure regressions), and two batched exact-name searches across languages for the remaining names. **49 localized names** resolve through their printed names, e.g. `Isola` → `Island`, `Addio` → `Farewell`; all resolved cards have printing ID, Oracle ID, front image, and type line. **`Shrinking Storm` was initially unresolved**; the verified alias above resolved it during implementation. Those audit calls were read-only. Implementation later rechecked the snapshot and persisted the verified backfill described above.
- Management/read-only SQL access now works for the configured project `iyhjfmjgkbhsloqslsbk`, named **MTG match tracker**, in the **AleOgre** organization. Do not use Test-bed. Live `mazzi` has `id`, `name`, `cards`, `created_at`, `source`, `created_by`, `colors`, and the newly added `format` column. All 13 decks currently have an empty format; preserve that rather than inferring one. Neither `revision` nor `mazzi-cards` exists, and the parent has no application triggers.
- Live parent RLS matches the older policies: shared public read, authenticated insert without an ownership equality check, and update/delete with an ownerless exception but no explicit authentication requirement. The planned parent/child ownership guards remain necessary.
- Main adds a Scryfall service, card images/search, mana/type/token statistics, quantity controls, format/color filters, and a client-side edit-conflict warning. These improve the existing UI but do not implement saved-deck identities or the ZAFF connection. ZAFF's MTGJSON selection/loading code is unchanged from the original plan.

## What main’s original Registro Scryfall calls did

All calls go directly from the browser to Scryfall; the Go server and Supabase do not proxy them. Merely opening/searching a deck does not write Scryfall data to the database.

| Trigger | Endpoint / implementation | What it supplies |
| --- | --- | --- |
| Open saved deck, edit a draft, or open its card statistics | `useDeckImages` → `requestCards` → `POST /cards/collection`, up to 75 names per request | Card images, colors, front type line, mana value/cost, produced mana, and related token IDs |
| A requested name did not resolve in the collection | `GET /cards/named?fuzzy=...`, at most 25 fallbacks per batch | An approximate name match, cached under both the returned name and the original requested name |
| Type in the editor's existing name field | `GET /cards/autocomplete?q=...`, after 250 ms | Name suggestions only; this call currently bypasses the shared service queue |
| Open “Cerca carte con le immagini” and type | `searchScryfall` → `GET /cards/search?unique=cards&order=name&q=... game:paper`, after 350 ms | Up to the first 60 matching paper cards; selected cards contribute their name to the draft, not their ID |
| Open card statistics after card metadata arrives | `useTokenImages` → `requestTokens` → `POST /cards/collection` with token IDs | Token images, text, colors, and power/toughness, grouped for display |
| Display a card/token thumbnail, art crop, or full-size image | Browser image request to Scryfall image URLs | Image bytes; separate from card API lookups |

The service caches cards in memory and in `localStorage` under `mtg-scryfall-cache-v5` (up to 3,000 name/face aliases), and tokens under `mtg-scryfall-tokens-v1` (up to 1,500 IDs). Cached entries have no age/refresh policy. Not-found names are kept only for the browser session. Another device starts with its own cache; reopening on the same device usually avoids card API calls. Images may still be loaded or revalidated by the browser independently.

Ordinary/split/adventure cards use top-level images. Double-faced cards use face images, and Registro's viewer already lets the user switch faces. Statistics use main deck only: mana curve, cost pips, mana production, card types/subtypes, and token sources. Unrecognized cards are excluded from those calculations and counted as unknown. The token chart counts copies of deck cards that can create a token; it does not compute the number of tokens they will produce in a game.

`RawCard` includes the printing `id` for token parsing, but `toCard` discards it and has no `oracle_id` field. Consequently `ScryCard`, the browser card cache, picker selections passed into the draft, and the saved JSON contain no durable card identity. Later searches can overwrite a name's cached artwork. `unique=cards` collapses gameplay duplicates; it is not a request for the oldest or cheapest printing. Current display data therefore cannot be copied directly into `mazzi-cards` without changing this service.

### Changes needed before persisting lookup results

1. **Extend the existing service.** Retain all current image/statistics/token fields and add `scryfallId`, nullable `oracleId`, and resolution provenance. Add an awaitable exact-resolution operation used by saves/backfill. Keep the existing view/search APIs working. Bump/version the card cache: old v5 entries have no IDs or reliable exact-versus-fuzzy provenance and must not establish persisted identity.
2. **Use exact matches for identity assignment.** Collection lookup followed by `named?exact=` is the automatic save/backfill path. Fuzzy results may remain correction suggestions, but the user must select/confirm a replacement name before it is persisted as another card. Never treat an old fuzzy alias as a verified exact cache hit. The image picker selects card names; it remains free of printing/ID controls.
3. **Fix endpoint throttling.** `PAUSE_MS = 110` is insufficient for the current collection, named, and search endpoint limits of 2 requests/second (500 ms). Route autocomplete, discovery, exact saves, metadata refreshes, and token fetches through one scheduler; enforce at least 500 ms for the limited endpoints (550 ms is a simple conservative shared interval). Respect 429/backoff and distinguish transient failures from confirmed missing names.
4. **Deduplicate pending work.** The current cache deduplicates completed requests only. The editor and nested card view both call `useDeckImages`; if their effects run before the first response, the same name can be requested twice. Track queued/in-flight name or printing-ID requests and let all consumers await/subscribe to the same result.
5. **Separate durable printing lookup from discovery aliases.** Key metadata by printing ID and use the saved row's ID for persisted cards. A later image search must not change a saved deck's artwork/identity. Resolve unsaved/new names through the exact path; hydrate saved cards by ID when stats, tokens, or reverse-face imagery are needed. Keep ephemeral rich metadata in the browser initially; the new table needs only the agreed identity/front-image/type fields, not the full Scryfall payload.
6. **Keep asynchronous UI safe.** Cancel or ignore obsolete autocomplete/search results when the query clears or a modal closes, and keep the draft intact on network errors. Current fuzzy fallback catches all HTTP failures as no result and can mark a 503 as “missing” for the session. Only genuine not-found responses should enter that cache; unresolved names beyond the 25-fallback cap are not proof of invalid names.
7. **Support localized imported names exactly.** The current English-oriented collection/named flow does not resolve the 49 localized names in the database. After ordinary exact lookup misses, use an escaped exact-name search such as `!"Isola" lang:any game:paper`, validate against `printed_name` / face `printed_name` as well as canonical English names, and retain the original entry name. Batch OR queries within Scryfall's query-length/pagination limits for imports/backfill rather than making one search for every foreign name. Reject different Oracle identities matching the same requested name; accept the first verified printing for one identity. An identical printed name may exist in several languages (`Pacifismo` returned a Spanish printing in this audit); language/artwork are not selection controls under the agreed first-result policy. Add exact localized provenance to the cache. No extra English-printing lookup is needed after a valid localized match.

Read-only mocked probes against the actual service confirmed duplicate queued collection requests, a misspelled alias resolving silently to another name without retaining either card ID, and a fuzzy-fallback 503 being reported as missing. These checks made no Scryfall or database writes.

## Table and identity

Use the literal requested table name, `mazzi-cards`; SQL must quote the hyphenated identifier. The client table constant is `TABLE_DECK_CARDS = 'mazzi-cards'`.

| Column | Type / constraint | Purpose |
| --- | --- | --- |
| `id` | UUID primary key, database-generated | Stable identity for an entry |
| `deck_id` | Text, not null, FK to `mazzi.id`, `ON DELETE CASCADE` | Parent deck; match the existing text ID type |
| `name` | Text, not null, nonblank | Preserve the imported name and reconstruct existing lists |
| `qty` | Integer, not null, `CHECK (qty > 0)` | Number of playable copies |
| `section` | Text, not null, default `main`, constrained to `main` / `side` | Preserve the current main/side distinction |
| `position` | Integer, not null, nonnegative | Preserve display order within the saved list |
| `scryfall_id` | UUID, initially nullable | A Scryfall printing ID, not an oracle ID or MTGJSON UUID |
| `oracle_id` | UUID, nullable | Shared gameplay identity across printings; fill from Scryfall when present |
| `image_url` | Text, initially nullable | Verified front image used by preview and canvas |
| `type_line` | Text, initially nullable | Preserve preview's spell/land grouping |

Index `(deck_id, position)` for card reads and cascades. Add uniqueness for `(deck_id, section, lower(trim(name)))`, matching the editor's current same-name/section aggregation. The same card may occur separately in main and side. Merge legacy duplicates within a section by summing quantities and retaining the first spelling/position; verify parity after the same normalization on both representations.

Scryfall fields are nullable during migration so an unresolved entry is retained rather than lost. An entry is playable only when it has a verified Scryfall ID, front image, and type line. Display unresolved entries in Registro; block gameplay confirmation for an incomplete deck rather than silently dropping cards. New valid imports should resolve before their atomic save. If lookup fails, the user can keep the draft or explicitly save it with an “unresolved cards” message for Registro use; ZAFF continues to show why it is unavailable.

Keep `name`, `source`, **`format`**, `colors`, `created_by`, and `created_at` on `mazzi`. Add a `revision` bigint there, defaulting to zero and incrementing on updates, for stale-edit/backfill detection. Include `format` in every create/update/RPC/header type and preserve the new filters. Names and quantities are the durable deck data; artwork/type are cached Scryfall metadata. Do not add a duplicate child ownership column.

Existing `main` entries stay main, including commanders that older precon imports flattened into main. Do not infer a commander from card legality. Supporting an explicit commander section can be a later extension.

### Automatic Scryfall identity assignment

Store both the specific `scryfall_id` and the shared `oracle_id` in the first migration. When inserting a new card group, use an already-cached verified name lookup if available; otherwise take the first valid exact-name result from the cheapest lookup needed to resolve that card, including an exact localized printed-name match. “First” means first returned, without sorting or searching for the oldest printing, lowest price, particular artwork, or preferred frame/language. Persist the two IDs together with its image/type metadata. Initial backfill assigns them once to existing groups that don't yet have them.

Registro selects card names and quantities. Scryfall IDs are automatically assigned data: there are no ID inputs, printing/artwork selectors, or actions for changing them. Carry the saved IDs forward on quantity, ordering, section, and deck metadata edits. Preserve the current name/section grouping and one chosen printing per group; mixed-printing selection is outside this plan. Ignore printing hints in imports for this assignment policy rather than requesting extra versions.

Once assigned, an existing group's non-null IDs cannot be overwritten by a later save, browser payload, or repeated backfill. Quantity changes update the same row and its identity. Replacing a card name with a different card means removing that group and inserting a newly resolved group, not changing the old group's IDs. A lookup retry may fill unresolved/null identity fields, but must not replace an already chosen printing. A metadata refresh, if needed, looks up the stored printing ID rather than resolving the name again.

If a group is explicitly moved between main and side in a future control, preserve its persisted identity before reconciling/deleting the old section entry. Matching only `(name, section)` after deletion would incorrectly assign a new printing. If the target section already has that name, merge quantities into its existing row and retain its assigned IDs. The current separate “add to section” actions may still create separate groups.

A name-only historical import cannot recover its original artwork from information already discarded. `oracle_id` is a gameplay identity, not a rules revision/history field. Most cards expose it at the top level, but unusual reversible-card layouts carry identities on their faces, so don't make a universal top-level NOT NULL assumption. `illustration_id` and finish/printing-choice fields are unnecessary for the agreed automatic assignment flow.

### Card group removal

A card group is the saved entry for a card name and section, with `qty` copies. Reducing a group's quantity keeps its row and IDs; removing the group deletes its `mazzi-cards` row on save. Discarding a draft doesn't delete saved rows. Treat zero copies as removal rather than storing `qty = 0`. Removing a whole deck deletes its `mazzi` row and cascades to every child through `deck_id ... ON DELETE CASCADE`. No orphaned card groups remain in either case.

## Access and consistent saves

Enable RLS on the new table and grant Data API access explicitly. Preserve the existing shared-read behavior for `anon` and `authenticated`, including ZAFF players who have no Registro login. Restrict child insert/update/delete to `authenticated` and require a parent deck with `created_by = auth.uid()` or the existing legacy exception `created_by IS NULL`. For updates, check both the old and new parent; a row cannot be moved into another user's deck.

Check the deployed `mazzi` policies/defaults before implementation. Enforce the same ownership rules on the parent: new rows belong to the current user, edits cannot change ownership, and ownerless legacy rows are writable only by signed-in users. Do not copy the current SQL's ownerless exception without its missing authentication restriction. Test permissions through API roles, not only as a database administrator.

Use one Postgres RPC, `save_deck`, for create/edit: accept deck metadata, enriched entries, and an expected revision; lock/check the parent, validate entries and ownership, and save the header, compatibility JSON, and child rows in one transaction. Update existing groups, insert new ones, and delete omitted groups; carry existing IDs from persisted rows instead of trusting replacements supplied by the client. Enforce the once-assigned identity rule in the write path so an established printing/Oracle ID cannot change. Return the new revision. A failed child write must roll back the parent change. Use `SECURITY INVOKER`, an explicit search path, schema-qualified references, and authenticated-only execute permission. Do not put privileged keys in the browser.

Preserve the new editor's deleted/changed-deck warning, but replace its non-atomic fingerprint comparison with revision checks inside the RPC. The current read-then-update can race another save after the comparison. If a user explicitly chooses to overwrite, submit the revision just reviewed; a subsequent edit must produce another conflict rather than an unconditional overwrite. A successful RPC returns the new revision/snapshot. Backfill-only child enrichment must not create a false deck-content conflict, while content/header edits from old clients must increment the parent revision.

During the first release, JSON remains authoritative for names, quantities, sections, and ordering. An invoker trigger on parent `cards` changes reconciles the child rows in the same transaction, preserving resolved metadata for unchanged names/sections. The RPC writes the canonical `{ name, qty, section }` JSON projection first, lets that trigger synchronize entries, then attaches resolved metadata. Use one reconciliation routine; avoid two triggers writing back and forth.

This also covers old browser tabs that still save directly to `mazzi.cards`: changed entries appear in the new table, removed entries disappear, and new names remain explicitly unresolved until enriched. Metadata-only saves must retain existing card IDs. The revision trigger covers both old clients and the RPC. Backfill enrichment checks the expected revision and entry identity before updating, so a user edit cannot be overwritten by an older lookup result.

During compatibility, add a deferred parity constraint trigger for structural child changes: at transaction end, ordered/normalized names, quantities, and sections must match the parent's JSON. This prevents a direct child-table API write from bypassing the RPC and leaving the two representations different. Allow metadata-only enrichment, and skip the parity check when the parent has been deleted by a cascade. Remove this temporary constraint together with the JSON mirror in stage 5.

## Scryfall resolution and migration

Put parsing/normalization behind shared types/services and extend **the existing `client/src/services/scryfall.ts`** for reusable resolution. Avoid introducing a second Scryfall client or replacing the new Registro display/statistics code. Keep storage/browser subscription code behind a browser adapter so migration tooling can use the same exact-match parsing without needing `localStorage`.

1. Normalize names for matching and deduplicate requests across all decks; retain original names in the rows.
2. Carry over the persisted IDs for every existing group without another name lookup. For new names, reuse verified **exact-match** cached results or use collection lookups, at most 75 identifiers per request. Enforce at least 500 ms for collection, named, and search requests through the shared scheduler, following their current official limits. Accept the first valid exact-name result; don't request the full printing catalogue or sort by release date/price.
3. Match responses by full name or exact face name, not array index: missing results break positional assumptions. For missing collection entries, use exact named lookup, then exact multilingual search for names still missing. Validate localized matches against returned `printed_name`/face names rather than guessing a translation. The four split/adventure names and the 49 localized names are regression fixtures; include apostrophes, accents, and query escaping.
4. Reject ambiguous matches. Never automatically replace a name using fuzzy search. Let the editor offer suggestions and require the user to select a replacement when exact resolution fails.
5. At the first persisted insert/resolution, cache the returned printing ID, `oracle_id` when present, `type_line`, and `image_uris.normal`, falling back to the first face's `image_uris.normal` when needed. Preserve those identities across later edits and repeat migrations. Handle missing artwork, rate limits, transient errors, and cancellation explicitly.
6. For the initial backfill, take a fresh snapshot of every deck, expand JSON into rows with missing sections set to main, and resolve unique names outside SQL. No HTTP calls run inside the migration transaction.
7. Apply enrichment per deck in a transaction with revision checks. Re-running must reuse the same entries and mappings, not add duplicates. Report unresolved/invalid entries; never delete one just to finish the migration.
8. Verify per-deck normalized `(name, qty, section)` equality, entry ordering, copy totals, no orphans, and complete playable metadata. The observed 13-deck snapshot is a baseline, not a hardcoded production count. Take another snapshot immediately before applying/backfilling.

Use a privileged, off-browser migration path for all existing creators' decks. An owner's normal session cannot legitimately backfill someone else's deck. Keep lookup results separate from secrets and keep live data out of Git.

## Shared client services and playable data

Create shared saved-deck types and a service with `listDecks`, `getDeck`, `saveDeck`, and `deleteDeck`. Registro and ZAFF use this service. Use explicit column selections and batch reads; avoid a request per deck/card. During migration Registro can retain its JSON reader behind this service, while the playable loader reads child rows and checks completeness.

Introduce a source-independent `PlayableDeck` / `PlayableCard` in the client, with deck name/source, main/side/commander arrays, card name, quantity, Scryfall ID, image URL, and type line. Adapt MTGJSON and saved rows into that shape. Do not fabricate MTGJSON set/release metadata for saved decks. Update `App`, `DeckPicker`, `DeckPreview`, and `GameView` to consume it; network/shared Go state types stay as they are.

Subscribe to parent and child changes and reload complete deck snapshots, coalescing events from a single save. Refresh Registro's deck list after a save as well: it currently has no Realtime subscription and closing the editor alone does not refresh its mounted list. Refetch a selected saved deck before preview/confirmation so deletion or a concurrent edit cannot load a stale card list.

`GameStats` is no longer metadata-only: main added a `name, source, colors, cards` read and `DeckViewContents`; implementation routes that through the shared compatibility service. Include `GameStats`, `DeckView.normalizeDeckCards`, `DeckCards`, `cardGroups`, `DeckStats`, `deckMath`, and `useDeckImages` in the stage-4 row-reader transition. Preserve their `{ name, qty, section }` consumer shape while carrying optional saved identity through an entry-aware metadata lookup. Keep `GameForm`'s lightweight name/colors read, the home deck count, and name-based historical match records independent of full card fetches. Resolve detail selections by deck ID where available; do not introduce additional name-based ambiguity.

## Registro UI and button coverage

| Existing screen/control | Required behavior and verification |
| --- | --- |
| Bottom navigation “Mazzi”, home saved-deck/recent-deck blocks | Preserve navigation and counts; show all shared decks, refreshing after saves/deletions and remote changes |
| Sticky “Crea Nuovo Mazzo” → “Inserimento manuale” | Preserve the new creation dialog; start an empty draft using the shared entry type; save header and rows together |
| Creation dialog “Importa file (ManaBox)” | Preserve filename-derived name, quantity merging, and current main-only parsing; resolve all names before normal save |
| Creation dialog “Incolla elenco” / paste “Importa” | Preserve recognized main/side headings and separate quantities for a name in both sections |
| Paste “Annulla” | Close/discard pasted draft without a database write |
| “Importa un mazzo precon Commander…” and result selection | Retain catalogue search/cache, replace the draft as today, set source precon, resolve commander + card names |
| Card search and suggestion selection | Retain name autocomplete UX; resolve new groups for their first persisted insert, and expose unresolved typed names clearly; ID/printing controls are not offered |
| “Cerca carte con le immagini”, search/results, tap-to-add, Main/Side, close | Retain the new picker; selected name adds one copy to the chosen section; verified lookup data can avoid another save-time request; IDs remain automatic |
| Unknown-card “?” → “Trova la carta giusta” | Keep explicit name replacement and quantity/section merging; save removes the unresolved old group and inserts/merges the confirmed replacement |
| “Main Deck” / “Sideboard”, quantity field, “Aggiungi al Mazzo” | Apply the existing merge rules and correct section/quantity; no database write before save |
| Card list/grid “−” / “+” | Keep same-group IDs as quantities change; “−” at one removes the group; atomic save deletes its child row |
| Card picker/viewer close “×” | Close the overlay without deleting saved data; the present viewer “×” is not a saved-group delete button |
| Deck name, format, source, color toggles | Save all parent metadata including the new format; keep basic-land color detection/manual overrides |
| Saved-deck color/type filters and “Nessun filtro” | Preserve local filtering and format values; these filters do not restrict the ZAFF all-decks catalogue |
| “Griglia” / “Lista”, “Colore” / “Tipo”, card enlargement, arrows, reverse face | Preserve new display/grouping/preferences and multi-face viewing; persisted cards show metadata from their saved printing |
| Card-statistics histogram button, “Conta il mana incolore”, token images/close | Preserve main-only statistics and token grouping; hydrate metadata/token IDs from the saved printing without adding tokens as deck entries |
| “Salva Mazzo” / “Salva Modifiche” | Resolve, validate, call the RPC, retain draft on error, reject stale edits, refresh all consumers |
| Editor “Annulla”, close “×”, Esc/backdrop | Discard unsaved changes; abort or ignore stale lookup responses |
| Saved-deck row → detail “Modifica” | Keep edit action in the detail, load complete entries, carry IDs unchanged, enforce owner/legacy UI and database rules |
| Saved-deck row / deck detail from statistics | Same totals, source/colors, card views and unresolved-card explanation for own/other decks |
| Detail “Cancella” and its confirmation | Delete parent once; FK cascade removes entries; cancelling deletes nothing; historical matches retain names |
| Concurrent-edit overwrite/cancel warning | Preserve the choice while making the revision comparison and save atomic; deleted decks cannot be recreated accidentally by an edit |
| “Nuova Partita” / editing a match: saved-deck selector and manual-name toggle | Continue using parent deck name/colors; don't fetch full cards for a match form; manual deck names still work |
| Match save/cancel, add/remove players, name-conflict choices, winner/life controls | Regression-check the current flows; the card migration must not change match payloads |
| “Partite Salvate”: open, edit, delete, export | Keep historical deck labels and exported results; no dependency on the removed JSON card column |
| “Statistiche Mazzi”: source filter, sorting, open deck, image export | Keep calculations/history/export; migrate its new card-detail read to rows in stage 4 rather than treating the component as metadata-only |
| “Statistiche Giocatori” and “Statistiche per Sfida”: open details | Existing calculations and detail controls remain functional |
| “Gestisci Giocatori”: add, rename, delete, conflict choices | Existing roster and match-update behavior remains functional |
| Life counter: +/- controls, High Roll, reroll, close, finish, cancel | Existing behavior remains functional; no new card-data dependency |
| Login/register switch, submit, logout, “Vai a ZAFF” / return links | Keep Registro write authentication and navigation; ZAFF saved-deck reads work independently |

Implement changes using `SelectField`, `Button`, `Badge`, `Modal`, and the existing styles/tokens. Keep migration/SQL details out of product labels. Error states should identify the affected card and action the user can take.

## ZAFF selector and gameplay

- Keep the current MTGJSON type/name controls and add a nearby, always-visible **Saved decks** dropdown. Values use `mazzi.id`, never the name; disambiguate duplicate labels without filtering out entries.
- Maintain a single selection union: `{ kind: 'mtgjson', fileName }`, `{ kind: 'saved', deckId }`, or none. Picking from one dropdown clears the other source; changing MTGJSON type must not unexpectedly clear a saved selection.
- Give each catalogue independent loading/empty/error/retry states. Remove the current full-screen MTGJSON loading dependency so the saved list can be used during an MTGJSON outage and vice versa.
- List all saved decks. Incomplete decks get a readable status and correction guidance; do not silently omit them. Disable confirmation until every entry is resolved. After successful backfill every currently observed deck should be playable.
- The existing “OK” loads the chosen source and opens the common preview. “Go Back” returns to the picker; “Confirm Deck” verifies completeness and continues to game. Preserve main/side sections, spell/land grouping, artwork, and counts.
- Expand each quantity exactly once into the existing `LOAD_DECK` payload, including the boards that gameplay already loads. Never silently skip a card missing an ID/image. Verify two clients see the same copies and artwork and can reveal, tap, select, and move them.
- Existing canvas supports one visible image per card. Double-faced cards must have a valid front image in this release; dedicated transformation controls require a later protocol/UI extension.

## Rollout in small stages

### 1. Add the table and migrate existing decks

- [x] Confirm the correct project and read-only SQL access; inspect deployed parent schema/RLS (2026-10-07).
- [x] Take a fresh backup of affected deck data; verify migration permissions before application.
- [x] Create a new migration with `supabase migration new` after discovering installed CLI commands with `--help`; do not rename the repository's older manually-run migrations as part of this feature.
- [x] Add table, constraints/indexes, revision and synchronization logic, explicit grants/RLS, and atomic save RPC. Retain `mazzi.cards`.
- [x] Backfill structural rows and then enrich names using the verified resolver; validate parity and role permissions on a test database first.
- [x] Verify on the actual target after application. Run advisors for the affected schema and investigate relevant findings.

Exit achieved: every existing deck has matching card rows and playable IDs/images, including the verified `Shrinking Storm` alias. The existing Registro app still functions through JSON, and legacy saves keep rows synchronized.

### 2. Wire every Registro write path

- [x] Add shared entry/saved-deck services and extend the existing Scryfall service with durable IDs/exact resolution; update its cache and scheduler.
- [x] Route manual creation, all imports, editing, and deletion through the common service/RPC.
- [x] Preserve image picker, correction flow, quantities, stats/token views, format/color filters, and conflict UX; add exact-resolution feedback, atomic revision handling, and list refresh/Realtime.
- [x] Exercise affected UI flows with test fixtures; verify own/other/ownerless write permissions in PostgreSQL. The user’s signed-in local save walkthrough is the final hands-on check.

Exit: every deck-writing control maintains JSON/row parity atomically; errors do not partially save.

### 3. Play saved decks in ZAFF

- [x] Add the shared playable model and both adapters.
- [x] Add the Saved decks dropdown and independent catalogue states.
- [x] Update preview/game loading; test saved imports and MTGJSON decks through two clients.

Exit: any complete saved deck can be selected, previewed, and played, including decks owned by another user.

### 4. Read card lists entirely from rows

- [ ] Move Registro detail/editor/totals to rows, reconstructing `{ name, qty, section }[]` in the service for existing UI consumers.
- [ ] Move `GameStats`'s deck details and `DeckView.normalizeDeckCards` to shared row reads; use saved IDs for images/grouping/card statistics.
- [ ] Compare row-derived data with JSON for all decks; remove JSON read fallbacks once parity is verified.
- [ ] Keep compatibility JSON writes and the legacy sync trigger during this release for rollback/old tabs.

Exit: both parts of the app read card contents from the new table; metadata/statistics/history still work.

### 5. Remove `mazzi.cards` later

- [ ] Confirm no deployed application or migration job still selects/writes `mazzi.cards`, including implicit `select('*')` assumptions.
- [ ] Retire legacy clients through the deployment/reload procedure and retain a final backup.
- [ ] In a separate migration, remove the JSON synchronization trigger and change the same save RPC to write parent + rows directly; retain revision checks and atomicity.
- [ ] Drop `mazzi.cards`; verify all UI controls and games again. Scryfall metadata may stay nullable to allow unresolved log entries; completeness remains a gameplay requirement.

Before stage 5, rollback means restoring the previous app reader while the JSON mirror is still maintained. After stage 5, restoring an older app requires recreating/backfilling JSON from ordered child rows and reinstating compatibility writes; rolling back only the frontend is insufficient.

## Checks that justify the rollout

- Parser/resolver tests: repeated names, same name in both sections, legacy missing sections, the four exact named fallbacks, double-faced front artwork, unknown names, and interrupted/rate-limited requests. Verify first-result selection without date/price sorting, reuse of cached results, and no new lookup for an already assigned group.
- Extend service tests for old v5 cache entries, fuzzy-versus-exact provenance, in-flight deduplication across nested views, shared autocomplete/search/token throttling, retryable 429/503 failures, stale query cancellation, and saved-printing metadata surviving later name searches.
- Add exact localized-name fixtures (`Isola`, `Addio`, `Profondità Oscure`, `Il Cristallo dell'Acqua`, `Pacifismo`), matching via `printed_name`/face fields, mixed-language imports, colliding Oracle identities, escaped query operators/quotes, the verified `Shrinking Storm` alias, and a truly unknown card name. Keep original imported labels and quantities; do not silently translate or replace them.
- Database tests: totals/parity, repeat backfill without changing assigned IDs, quantity/section edits preserving identity, group removal deleting its row, whole-deck cascade deletion, missing parent/invalid quantity, anonymous read but no write, own/other/ownerless writes, attempted ownership/identity reassignment, transaction rollback, direct child writes that would break JSON parity, and stale revision rejection. Include legacy direct-JSON saves during the transition.
- UI tests: creation dialog/manual/file/paste/precon imports; image picker add/correct/Main/Side; −/+ including removal at one; grid/list/color/type modes and face switching; format/color filters; card/token statistics; cancel with lookup pending; atomic conflict/overwrite flow; save failure preserving draft; immediate list refresh; source switching; duplicate deck names; catalogue failure isolation; preview/confirmation blocking incomplete data.
- Run `npm run test` and `npm run build` for implementation changes. The root advertises a lint script but `client/package.json` currently has no lint script; don't claim lint passed until one exists. Run Go tests if the server/protocol changes; this design doesn't require those changes.
- Manual two-browser check: select one saved deck and one MTGJSON deck, confirm, verify copy counts on both clients and exercise reveal/tap/drag. Repeat with an existing saved deck containing sideboard or multi-face cards.

Baseline verification after the merge (2026-10-07): the existing 10 JoinScreen tests pass. `npm run build` passes after synchronizing the checked-in dependencies with `npm ci`; the initial build failed because the newly declared `html-to-image` package was not installed in the local checkout. Existing tests do not cover the new Scryfall/Registro behavior, so passing them does not replace the migration/service/UI checks above. No lockfile or feature-source changes were required for this review.

Stage 1 passed its local and live parity/permission checkpoint; stages 2–3 are implemented and tested for local use. Stages 4–5 are the later removal work requested separately from the first migration.

## Implementation locations

| Area | Files |
| --- | --- |
| Migration/backfill/verification | New timestamped files under `supabase/migrations/`, new migration tooling/tests, migration README |
| Shared deck data and resolution | `client/src/services/supabase.ts`, existing `scryfall.ts`, new saved-deck service/types and exact-resolution adapter |
| Registro controls | `client/src/components/mtglog/DeckList.tsx`, `DeckEditor.tsx`, `client/src/components/MtgLog.tsx` |
| Registro images/card statistics | `CardPicker.tsx`, `DeckCards.tsx`, `DeckView.tsx`, `DeckStats.tsx`, `deckMath.ts`, `cardGroups.ts`, `useDeckImages.ts` |
| Additional card-content reader | `GameStats.tsx` (now opens deck contents) |
| Lightweight consumers/regression checks | `GameForm.tsx`, `HomeOverview.tsx`, `GameList.tsx`, roster/statistics/life/navigation/export components |
| Selection/preview/play | `client/src/App.tsx`, `DeckPicker.tsx`, `DeckPreview.tsx`, `GameView.tsx`, MTGJSON adapter |

## References checked

- [Scryfall collection lookup and current batch/rate limits](https://scryfall.com/docs/api/cards/collection).
- [Scryfall exact named lookup](https://scryfall.com/docs/api/cards/named).
- [Scryfall search and gameplay-printing rollup](https://scryfall.com/docs/api/cards/search).
- [Scryfall name autocomplete](https://scryfall.com/docs/api/cards/autocomplete).
- [Scryfall exact-name and language search syntax](https://scryfall.com/docs/syntax).
- [Scryfall card and face image fields](https://scryfall.com/docs/api/cards).
- [Supabase database functions and invoker permissions](https://supabase.com/docs/guides/database/functions).
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Supabase explicit Data API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

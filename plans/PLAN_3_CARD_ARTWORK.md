# Plan 3: Card Artwork and Data Sourcing for Magic: The Gathering

## 1. API Evaluation

### 1.1 Scryfall API (https://scryfall.com)

| Criterion | Assessment |
|---|---|
| **CORS policy** | Full CORS support. Both `api.scryfall.com` and `cards.scryfall.io` (image CDN) return `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS`. Browser JS can call both the API and load images directly with zero restrictions. |
| **Image hosting & CORS** | Scryfall hosts its own images on `cards.scryfall.io`, a dedicated CDN. Images have `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=31556952` (one year), and proper `Content-Disposition` headers. This means images can be drawn on an HTML canvas with `crossOrigin: "anonymous"` without tainting it. |
| **Rate limits** | 10 requests/second sustained for most endpoints. The `/cards/collection` batch endpoint is limited to 2 requests/second. No API key required. Exceeding limits returns HTTP 429. Scryfall asks that bulk use cases download their daily bulk-data exports instead of crawling. |
| **Card coverage** | Complete: 1,049 sets from Limited Edition Alpha (1993-08-05) through upcoming sets (Star Trek Commander, November 2026). Every printing of every card. |
| **Image quality & formats** | 7+ image renditions per card: `small` (146x204 JPG, ~12KB), `normal` (488x680 JPG, ~84KB), `large` (672x936 JPG, ~125KB), `png` (745x1040 PNG, ~844KB), `art_crop` (art only, variable, JPG), `border_crop` (480x680 JPG), `thumb` (WebP ~8KB), `display` (WebP ~63KB). |
| **Metadata richness** | Extremely rich: name, mana_cost, cmc, type_line, oracle_text, colors, color_identity, keywords, power, toughness, loyalty, rarity, set, set_name, released_at, flavor_text, artist, legalities (all formats), prices, rulings URI, collector_number, layout (normal/transform/split/etc.), plus related cards. |
| **Deck/decklist data** | No built-in deck endpoint. However, the search syntax is powerful enough to build decks programmatically (filter by color, type, CMC, year range, format legality, rarity, power/toughness). |
| **API stability** | Actively maintained, widely used (the de facto standard MTG API). Stable versioning. Cloudflare-backed. |

### 1.2 MTGJSON (https://mtgjson.com)

| Criterion | Assessment |
|---|---|
| **CORS policy** | `Access-Control-Allow-Origin: *` on all data files. Browser JS can fetch JSON files directly. |
| **Image hosting** | None. MTGJSON provides only metadata. Cards include `identifiers.scryfallId` which can be used to construct Scryfall image URLs or look up images via the Scryfall API. |
| **Rate limits** | No rate limits -- files are static JSON served from Cloudflare. However, files can be very large (AllPrintings is 631MB uncompressed). |
| **Card coverage** | Complete -- same source data as Scryfall, rebuilt daily. |
| **Image quality** | N/A (no images). |
| **Metadata richness** | Extremely rich and includes fields Scryfall lacks: foreign language data, original printed text, purchase URLs, detailed identifiers for every platform (MTGO, Arena, TCGPlayer, CardMarket, Cardosphere, etc.). |
| **Deck/decklist data** | 3,042 premade decks across many categories: Theme Decks (220), Commander Decks (190), Intro Packs (167), Jumpstart (570), Challenger Decks (22), Event Decks (26), World Championship Decks (32), and more. Each deck includes full card data with mainBoard, sideBoard, and optional commander arrays. Cards include a `count` field for quantities. |
| **API stability** | Open-source, daily builds since 2016, active maintainers, Patreon-supported. Very stable. |

### 1.3 Magic: The Gathering API (https://magicthegathering.io)

| Criterion | Assessment |
|---|---|
| **CORS policy** | `Access-Control-Allow-Origin: *` (conditional, sent when `Origin` header is present). `Access-Control-Allow-Methods: GET`. |
| **Image hosting** | Points to Wizards of the Coast Gatherer service (`gatherer.wizards.com`). Those images redirect to `gatherer-static.wizards.com` which does NOT set CORS headers. Images cannot be used on a canvas without tainting it. Furthermore, images require a `multiverseId` and not all cards have one. |
| **Rate limits** | 1,000 requests/hour (header says `ratelimit-limit: 1000`, documentation previously said 5,000 -- the lower actual value applies). |
| **Card coverage** | Historically complete but frozen -- no guarantee of new sets being added. |
| **Image quality** | Single format from Gatherer, medium quality, no size options. |
| **Metadata richness** | Good but less rich than Scryfall: name, manaCost, cmc, colors, colorIdentity, type, supertypes, subtypes, types, rarity, set, text, flavor, artist, power, toughness, loyalty, legalities, rulings, foreignNames, printings. |
| **Deck/decklist data** | None. |
| **API stability** | **DEPRECATED.** Officially end-of-life on March 1, 2027. Redirects users to Scrydex (a paid service at $29+/month). Should not be used for new projects. |

### 1.4 Scrydex (https://scrydex.com) -- successor to magicthegathering.io

| Criterion | Assessment |
|---|---|
| **Pricing** | Paid only. Starts at $29/month for 5,000 API credits. |
| **Verdict** | Disqualified by the "free, no paid API" requirement. |

### 1.5 Other Sources Considered

**MTGGoldfish** (https://www.mtggoldfish.com): No public API. Deck downloads are plain text files with no CORS headers for API use. Good as a human-curated source of competitive decklists but not suitable for programmatic access.

**Archidekt / Moxfield**: No documented public APIs. Community deck-building sites without official third-party access.

---

## 2. Recommended Approach: Scryfall (primary) + MTGJSON (deck data supplement)

### Rationale

**Scryfall as the primary API** because:
- It is the only source that provides both card metadata AND images with full CORS support (`Access-Control-Allow-Origin: *` on both API and image CDN)
- Images can be loaded into fabricJS canvas objects with `crossOrigin: "anonymous"` without tainting the canvas, meaning serialization with `toDataURL()` or `toJSON()` will work
- The search syntax is extremely powerful: `c:b t:creature year<=1997 cmc<=3 pow>=2` returns exactly "old-school black aggro creatures"
- No API key required; 10 req/sec rate limit is generous for interactive use
- The `/cards/collection` batch endpoint accepts up to 75 card identifiers per request, ideal for loading entire decks in 1-2 calls
- Active maintenance, industry standard, Cloudflare-backed CDN with year-long cache headers

**MTGJSON as a supplement for deck data** because:
- Scryfall has no deck endpoint at all
- MTGJSON provides 3,042 premade decks covering a wide range of archetypes, formats, and eras
- Each MTGJSON deck card includes `identifiers.scryfallId`, which directly maps to Scryfall for image URLs and full data
- MTGJSON deck files are static JSON with CORS enabled -- a single fetch per deck, no pagination

The workflow: load deck compositions from MTGJSON, then resolve card images and metadata via Scryfall.

---

## 3. Card Data Model

### 3.1 Client-Side Card Interface

The card model stored client-side should balance between what Scryfall provides and what the app actually needs. Since the app "has no idea what card is that outside its id and linked picture" (per END_GOAL.md), the model should be lean for the game state but allow optional metadata for display.

```typescript
interface CardData {
  // Identity (required for game state)
  id: string               // Scryfall UUID (e.g., "7673784e-db4b-43a1-8d55-1bb9fc1e284f")
  name: string             // "Lightning Bolt"

  // Images (required for rendering)
  imageUrl: string          // normal-size image URL from cards.scryfall.io
  imageBackUrl: string|null // for double-faced cards; null for normal cards

  // Metadata (for tooltip/detail panel)
  manaCost: string|null     // "{1}{B}{B}" -- raw mana cost string with symbols
  cmc: number               // 3 -- converted mana cost
  typeLine: string          // "Creature -- Human Knight"
  oracleText: string|null   // rules text
  flavorText: string|null   // flavor text
  power: string|null        // "2" (string because of "*" etc.)
  toughness: string|null    // "2"
  loyalty: string|null      // for planeswalkers

  // Classification (for filtering/deck building)
  colors: string[]          // ["B"] -- color abbreviations
  colorIdentity: string[]   // ["B"]
  rarity: string            // "common" | "uncommon" | "rare" | "mythic"
  setCode: string           // "lea"
  setName: string           // "Limited Edition Alpha"
  releasedAt: string        // "1993-08-05"

  // Layout info
  layout: string            // "normal" | "transform" | "split" | "flip" | "modal_dfc" | ...
}
```

### 3.2 Game-State Card Reference

For the shared game state (what gets serialized and sent between players via WebSocket), only the minimal reference is needed:

```typescript
interface CardRef {
  id: string          // Scryfall UUID -- the single source of truth
  count: number       // how many copies (for deck definition)
}
```

The full `CardData` is resolved client-side from a local cache keyed by `id`.

### 3.3 Mapping from Scryfall Response

The card data model maps from Scryfall fields as follows:
- `id` <-- `id`
- `name` <-- `name`
- `imageUrl` <-- `image_uris.normal` (for single-faced cards) or `card_faces[0].image_uris.normal` (for multi-faced cards)
- `imageBackUrl` <-- `card_faces[1].image_uris.normal` (if present)
- `manaCost` <-- `mana_cost`
- `cmc` <-- `cmc`
- `typeLine` <-- `type_line`
- `oracleText` <-- `oracle_text`
- `flavorText` <-- `flavor_text`
- `power` <-- `power`
- `toughness` <-- `toughness`
- `loyalty` <-- `loyalty`
- `colors` <-- `colors`
- `colorIdentity` <-- `color_identity`
- `rarity` <-- `rarity`
- `setCode` <-- `set`
- `setName` <-- `set_name`
- `releasedAt` <-- `released_at`
- `layout` <-- `layout`

Important: multi-faced cards (transform, modal_dfc, split) do NOT have a top-level `image_uris`. Instead they have `card_faces[]` each with its own `image_uris`. The mapping code must handle this.

---

## 4. Deck Sourcing Strategy

### 4.1 Sources for Premade Decklists

**Primary: MTGJSON Deck Files**

MTGJSON provides 3,042 official/preconstructed decks. The `DeckList.json` endpoint provides an index with name, type, set code, release date, and file name for each deck. Individual deck files are fetched from `https://mtgjson.com/api/v5/decks/{fileName}.json`.

Deck types available and counts:
- Theme Deck: 220
- Commander Deck: 190
- Intro Pack: 167
- Jumpstart: 570
- Challenger Deck: 22
- Event Deck: 26
- World Championship Deck: 32
- Duel Deck: 52
- And many more (Secret Lair, Sample Deck, Starter Deck, etc.)

**Secondary: App-bundled curated lists**

For the "black aggro old school" use case, MTGJSON decks may not perfectly match. The app should ship a small set of curated archetype definitions that are assembled dynamically from Scryfall search:

```typescript
interface Archetype {
  name: string              // "Black Aggro Old School"
  displayName: string       // "Black Aggro (Old School)"
  description: string       // "Fast black creatures from the early days of Magic"
  scryfallQuery: string     // "c:b t:creature cmc<=3 pow>=2 year<=1997 f:vintage"
  landDistribution: object  // { "Swamp": 24 }
  targetSize: number        // 60
  creatureRatio: number     // 0.5  -- target ratio of creatures to spells
  spellQuery: string        // "c:b t:instant OR t:sorcery cmc<=3 year<=1997 f:vintage"
}
```

### 4.2 Deck Storage Format

Decks in the app are stored as an array of card references:

```typescript
interface Deck {
  id: string                // unique deck ID (generated or from MTGJSON)
  name: string              // "Abzan Siege"
  source: string            // "mtgjson" | "curated" | "generated"
  type: string              // "Theme Deck" | "Commander" | "Archetype" etc.
  format: string|null       // "standard" | "modern" | "legacy" | "vintage" | null
  era: string|null          // "old-school" | "modern" | null -- for UI filtering
  colors: string[]          // ["B"] -- derived from cards
  cards: CardRef[]          // [ {id: "...", count: 2}, ... ]
  sideBoard: CardRef[]      // optional
  commander: CardRef|null   // optional
}
```

### 4.3 User Deck Selection Flow

The user selects a deck through a simple browsing interface (not full search -- that is out of initial scope):

1. **Browse by category**: User picks a high-level filter: Color (W/U/B/R/G/multi), Era (Old School pre-1997 / Classic 1997-2003 / Modern 2003-2015 / Recent 2015+), Style (Aggro / Control / Midrange / Combo), or Source (Official / Curated)
2. **Deck list**: Shows matching decks with name, color identity, era, and brief description
3. **Deck preview**: Shows card thumbnails (Scryfall `small` images) and metadata
4. **Load deck**: Resolves all card data and images from Scryfall, then adds the deck to the game canvas

### 4.4 Scryfall Search Capabilities for Filtering

Scryfall's search syntax supports all the filters needed:
- **Color**: `c:b` (black), `c:br` (black and red), `c<=b` (mono-black or colorless)
- **Type**: `t:creature`, `t:instant`, `t:sorcery`
- **Year/Era**: `year<=1997`, `year>=2003`, `year:1994`
- **Format legality**: `f:legacy`, `f:vintage`, `f:modern`
- **CMC**: `cmc<=3`, `cmc:2`
- **Power/Toughness**: `pow>=2`, `tou>=3`
- **Rarity**: `r:rare`, `r:mythic`
- **Set**: `set:lea` (Alpha), `set:2ed` (Unlimited)
- **Combined**: `c:b t:creature cmc<=3 pow>=2 year<=1997 f:vintage` -- this exact query returns 54 cards, perfect for building an "old school black aggro" creature base

### 4.5 Deck Assembly from Archetypes

For curated archetypes that are assembled from Scryfall search results:

1. Fetch creature candidates from `scryfallQuery` (limited to 40-60 results)
2. Fetch spell candidates from `spellQuery`
3. Apply the `creatureRatio` to select N creatures and M spells
4. Selection strategy: pick the top results by `edhrec_rank` (Scryfall provides this), which reflects community popularity and is a good proxy for "staple cards"
5. Add lands per `landDistribution`
6. Total to `targetSize` (typically 60 for constructed)

This creates a deterministic, repeatable deck for a given archetype definition.

---

## 5. Image Loading Strategy

### 5.1 Loading Card Images into FabricJS Canvas Objects

Since Scryfall images are served with `Access-Control-Allow-Origin: *`, the fabricJS integration is straightforward:

```typescript
// Pseudocode -- not implementation
fabric.Image.fromURL(card.imageUrl, (img) => {
  img.set({ left: x, top: y, scaleX: scale, scaleY: scale });
  canvas.add(img);
}, { crossOrigin: 'anonymous' });
```

The critical detail: the `{ crossOrigin: 'anonymous' }` option MUST be passed as the third argument to `fabric.Image.fromURL`. This tells the browser to make a CORS request for the image, and since Scryfall responds with `Access-Control-Allow-Origin: *`, the canvas will not be tainted. This is essential because:

- FabricJS serialization via `canvas.toJSON()` includes image data
- `canvas.toDataURL()` for thumbnails or exports requires an untainted canvas
- If `crossOrigin` is omitted, the canvas becomes tainted even though the images display correctly

### 5.2 CORS Considerations

**Verified safe**: Both `api.scryfall.com` and `cards.scryfall.io` return `Access-Control-Allow-Origin: *`. There is no risk of tainted canvas when using Scryfall images with `crossOrigin: 'anonymous'`.

**Not safe**: Wizards of the Coast Gatherer images (`gatherer-static.wizards.com`) do NOT return CORS headers. These cannot be used with fabricJS canvas operations. This eliminates the magicthegathering.io API as a viable image source.

### 5.3 Caching Strategy

**Layer 1 -- Browser HTTP cache (automatic)**: Scryfall images are served with `Cache-Control: public, max-age=31556952` (1 year). Once a card image is loaded, the browser will serve it from disk cache for subsequent requests. No code needed.

**Layer 2 -- In-memory card data cache**: Maintain a `Map<string, CardData>` in the card service module. When a card is fetched from Scryfall, store the parsed `CardData` in this map. Subsequent lookups by ID hit the map instead of making API calls.

**Layer 3 -- SessionStorage or IndexedDB for card metadata (optional, future)**: For the initial implementation, the in-memory cache is sufficient. Card data is small (~1-2KB per card) and a 60-card deck is only ~60-120KB of metadata. If the app grows to support very large collections, IndexedDB could store the card metadata cache persistently.

**Layer 4 -- Service Worker (future)**: Not needed for MVP. The browser's built-in HTTP cache with Scryfall's year-long cache headers is sufficient. A service worker could be added later for offline support.

### 5.4 Image Size/Resolution Considerations

For the game canvas rendering, the `normal` size (488x680 JPG, ~84KB per card) is the recommended default:
- At typical game zoom levels, cards are displayed at roughly 100-200px wide, so 488px is more than sufficient
- At ~84KB per card, a full 60-card deck is ~5MB of images, acceptable for modern connections
- JPG format is universally supported and renders fast on canvas

For card list/deck-browsing UI, use `small` (146x204 JPG, ~12KB):
- 60 thumbnails = ~720KB, loads quickly
- Appropriate for list views and deck previews

The `large` and `png` formats should be avoided in normal gameplay -- they are 125KB-844KB per card and add no visible benefit at game canvas scales.

For card detail/zoom views (when a user clicks to read a card), the `large` (672x936 JPG) or `border_crop` (480x680 JPG) is appropriate.

### 5.5 Preloading Strategy

When a user selects a deck:
1. Immediately show deck card list using metadata (names, mana costs) -- fetched via Scryfall `/cards/collection` batch endpoint (up to 75 cards per request, so a 60-card deck needs 1 request)
2. Start loading `small` thumbnails for the deck preview panel
3. When the user confirms and enters the game, start loading `normal` images for all cards in the deck
4. Load images in priority order: cards in hand first, then library (face-down cards do not need images loaded immediately)

---

## 6. Integration with the App

### 6.1 Card Service Module Structure

The card service should be a standalone module with no fabricJS dependency, responsible only for fetching and caching card data:

```
src/
  services/
    cards/
      cardService.ts       -- main service: fetchCard, fetchCards, searchCards
      cardTypes.ts         -- CardData, CardRef, Deck, Archetype type definitions
      scryfallClient.ts    -- Scryfall API wrapper with rate limiting
      mtgjsonClient.ts     -- MTGJSON data fetcher for decks
      cardCache.ts         -- in-memory cache with Map<string, CardData>
      cardMapper.ts        -- maps Scryfall JSON response -> CardData
      deckService.ts       -- deck loading, archetype assembly, deck index
      deckDefinitions.ts   -- curated archetype definitions (static data)
```

### 6.2 API Call Patterns

**Batch loading (preferred)**: Use Scryfall's `POST /cards/collection` endpoint to load multiple cards at once. It accepts up to 75 identifiers per request. For a 60-card unique deck, this means a single API call. For decks with more unique cards, batch into chunks of 75.

Identifiers can be:
- `{ id: "scryfall-uuid" }` -- best, works when we have Scryfall IDs from MTGJSON
- `{ name: "Lightning Bolt" }` -- fallback, returns the most recent printing
- `{ set: "lea", collector_number: "141" }` -- for specific printings

**Individual card lookup**: Use `GET /cards/{id}` only for single-card operations (card detail view, random card).

**Search**: Use `GET /cards/search?q={query}` for archetype assembly. Returns up to 175 cards per page with pagination. For assembling a deck, 1-2 pages are usually sufficient.

**Rate limiting implementation**: The `scryfallClient.ts` module should implement a simple token-bucket rate limiter:
- General endpoints: max 10 requests per second (100ms minimum between requests)
- `/cards/collection`: max 2 requests per second (500ms minimum)
- Use a queue + setTimeout approach to space requests

### 6.3 Deck Loading Workflow

**Loading an MTGJSON premade deck:**
1. Fetch deck index: `GET https://mtgjson.com/api/v5/DeckList.json` (cache this -- it changes daily but is small)
2. User selects a deck
3. Fetch deck file: `GET https://mtgjson.com/api/v5/decks/{fileName}.json`
4. Extract `scryfallId` from each card's `identifiers`
5. Batch-fetch card data from Scryfall: `POST /cards/collection` with `{ id: scryfallId }` identifiers
6. Map responses to `CardData` objects, populate cache
7. Build `Deck` object with `CardRef` array (using Scryfall IDs and MTGJSON `count` values)

**Loading a curated archetype deck:**
1. User selects an archetype (e.g., "Black Aggro Old School")
2. Fetch creatures: `GET /cards/search?q={archetype.scryfallQuery}&order=edhrec`
3. Fetch spells: `GET /cards/search?q={archetype.spellQuery}&order=edhrec`
4. Apply selection algorithm (top N by edhrec rank, respecting creature/spell ratio)
5. Add basic lands per `landDistribution`
6. Cache all card data, build `Deck` object

### 6.4 Error Handling

**Missing cards/images:**
- Scryfall's `/cards/collection` returns a `not_found` array alongside `data`. Log missing cards and display a warning to the user ("3 cards from this deck could not be found").
- If `image_uris` is null (rare, but possible for placeholder entries), fall back to a local placeholder card-back image.

**Multi-faced cards:**
- Check `card.layout` -- if it is `"transform"`, `"modal_dfc"`, `"reversible_card"`, etc., look in `card.card_faces[n].image_uris` instead of `card.image_uris`.
- Store both front and back image URLs in `CardData`.

**Network errors:**
- Wrap all fetch calls in try/catch. On failure, retry once after 1 second.
- If Scryfall returns 429 (rate limited), back off exponentially (1s, 2s, 4s).
- If MTGJSON files are unavailable, the deck browser shows "Deck library temporarily unavailable" and the user can still load cards by other means (future search feature).

**Image load failures:**
- fabricJS `Image.fromURL` calls back with a null image on failure. Detect this and show a placeholder.
- Retry image load once on failure, then fall back to card-back placeholder.

### 6.5 Integration with Game State (Plan 2 Connection Point)

The game state (managed by the WebSocket server from Plan 2) only stores `CardRef` objects (Scryfall ID + position/rotation/zone data). When a client connects and receives the full state:

1. Collect all unique card IDs from the state
2. Check local cache -- any IDs not cached are fetched via Scryfall batch endpoint
3. Render cards on the fabricJS canvas using cached `CardData.imageUrl` values

This means the server never handles card images or metadata -- it only tracks card IDs and their game positions. Image resolution is purely client-side, which is consistent with the "no self-hosting" requirement for card data.

---

## Summary of Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Primary API | Scryfall | Only source with full CORS on both API and images; richest metadata; no API key; fabricJS-safe |
| Deck data source | MTGJSON | 3,042 premade decks with card data; cross-references to Scryfall IDs; free static files |
| Image size for gameplay | `normal` (488x680, ~84KB) | Good balance of quality and download size for 60-card decks |
| Image size for browsing | `small` (146x204, ~12KB) | Fast loading for deck list previews |
| Card batch loading | Scryfall `/cards/collection` | Up to 75 cards per request, minimizes API calls |
| Caching | Browser HTTP cache (1yr headers) + in-memory Map | Zero-config for images; simple in-memory store for metadata |
| fabricJS CORS | `{ crossOrigin: 'anonymous' }` | Required to prevent tainted canvas; verified working with Scryfall CDN |
| Game state card reference | ID-only (`CardRef`) | Keeps WebSocket payloads small; clients resolve metadata locally |

---

### Critical Files for Implementation
- `client/src/services/cards/scryfallClient.ts` -- Scryfall API wrapper with rate limiting; the central integration point for all card data and image URLs
- `client/src/services/cards/cardMapper.ts` -- mapping logic from Scryfall JSON to the app's CardData model, including multi-faced card handling
- `client/src/services/cards/deckService.ts` -- deck loading from MTGJSON, archetype assembly from Scryfall search, deck index management
- `client/src/services/cards/cardTypes.ts` -- TypeScript type definitions for CardData, CardRef, Deck, and Archetype; shared between card service, game state, and UI

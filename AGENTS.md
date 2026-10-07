# ZAFF — Collectible Card Game Platform

## Project Structure

```
zaff/
├── client/          # React + Vite + Tailwind frontend
│   └── src/
│       ├── components/   # UI components (JoinScreen, DeckPicker, DeckPreview, GameView)
│       ├── network/      # WebSocket layer (socket.ts, useSocket.ts)
│       ├── state/        # Game store (stub, not yet active)
│       └── services/     # MTGJSON API client
├── server/          # Go WebSocket game server
│   └── internal/    # ID generation
├── shared/          # TypeScript types shared between client and server
│   └── src/
│       ├── state.ts     # GameState, Player, Card types
│       ├── actions.ts   # ActionTypes enum, Action, SequencedAction
│       └── protocol.ts  # ClientMessage, ServerMessage envelopes
│── plans/           # Implementation plans
└── supabase/        # supabase connection
    └── migrations/  # supabase sql files
```

## Build & Run

```bash
npm run dev:all      # Start client (Vite :5173) + server (Go :8080)
                     # Server prompts for Cloudflare tunnel interactively
npm run dev          # Client only
npm run dev:server   # Server only
npm run build        # Build shared + client
npm run test         # Run client tests (vitest)
npm run lint         # Not wired yet: client/package.json has no lint script
```

The Go server binary is at `server/`. Run directly: `cd server && go run . --port 8080`.
Use npm workspaces and `package-lock.json` for client dependencies and CI. The
existing `pnpm-lock.yaml` only describes root tooling, not the client workspace.

## Tech Stack

- **Client**: React 19, Vite, Tailwind CSS v4, FabricJS, TypeScript
- **UI**: daisyUI 5 + shared React kit in `client/src/components/ui/`. Base UI has been removed. Buttons, basic fields, badges, and modal close controls are migrated; custom widgets and overlay behavior retain their existing implementations.
- **Server**: Go, `coder/websocket`, built-in Cloudflare tunnel support
- **Shared types**: TypeScript package `@zaff/shared`, consumed by client
- **Card data**: MTGJSON API (deck lists), Scryfall (card images)

---

## Protocol Reference

### Connection Lifecycle

1. Client opens WebSocket: `ws[s]://{host}/ws?name={playerName}`
2. Server creates a `Player` (assigns seat, life=20, connected=true)
3. Server initializes 5 per-player zones: `{playerId}:deck`, `{playerId}:hand`, `{playerId}:battlefield`, `{playerId}:graveyard`, `{playerId}:exile`, plus `shared:stack` (once)
4. Server sends **WELCOME** → **STATE_SYNC** → broadcasts **PLAYER_JOINED**
5. Client enters read loop; server enters read loop
6. On disconnect: player marked `connected: false`, **PLAYER_LEFT** broadcast

### Seating

Seats assigned in join order: `south` → `north` → `east` → `west` (max 4 players).

#### Seat Colors

| Seat   | Color   | Hex       |
|--------|---------|-----------|
| south  | Red     | `#ef4444` |
| north  | Blue    | `#3b82f6` |
| east   | Yellow  | `#eab308` |
| west   | Green   | `#22c55e` |

Used for card selection borders. Own cards show fabric selection border in your color. Other players' selections appear as a stroke on the card in their color.

---

### Message Envelopes

#### Client → Server (`ClientMessage`)

| `msg`    | Fields                   | Purpose                     |
|----------|--------------------------|-----------------------------|
| `ACTION` | `action: Action`         | Send a game action          |
| `UNDO`   | `seq: number`            | Undo a previously sequenced action |
| `PING`   |                          | Keepalive                   |

#### Server → Client (`ServerMessage`)

| `msg`           | Fields                                          | Purpose                                      |
|-----------------|-------------------------------------------------|-----------------------------------------------|
| `WELCOME`       | `playerId`, `playerName`                        | Sent to connecting client                     |
| `STATE_SYNC`    | `state: GameState`, `log: SequencedAction[]`    | Full state snapshot on connect                |
| `ACTION_RESULT` | `action: SequencedAction`, `state: GameState`   | Broadcast to ALL clients after every action   |
| `PLAYER_JOINED` | `playerId`, `playerName`                        | Broadcast to ALL clients                      |
| `PLAYER_LEFT`   | `playerId`                                      | Broadcast to remaining clients                |
| `ERROR`         | `error: string`, `refSeq?: number`              | Sent to originating client only               |
| `PONG`          |                                                 | Reply to PING                                 |

**Important**: `ACTION_RESULT` always includes the **complete current `GameState`** — full state replacement, not a delta.

---

### Types

#### `GameState`

```ts
interface GameState {
  players: Record<string, Player>;   // playerId → Player
  cards:   Record<string, Card>;     // instanceId → Card
  zones:   Record<string, string[]>; // zone key → array of instanceIds
}
```

#### `Player`

```ts
interface Player {
  name: string;
  seat: string;       // "south" | "north" | "east" | "west"
  life: number;       // starts at 20
  connected: boolean;
}
```

#### `Card`

```ts
interface Card {
  instanceId: string;  // unique per card instance (server-generated)
  cardId: string;      // Scryfall ID
  imageUrl: string;    // Scryfall image URL
  ownerId: string;     // playerId who owns the card
  zone: string;        // current zone key (e.g. "{playerId}:deck")
  zoneIndex: number;   // position within the zone
  x: number;
  y: number;
  rotation: number;
  faceDown: boolean;
  selectedBy: string;  // playerId of player selecting this card, or ""
  counters: Record<string, number>;
}
```

#### `Action`

```ts
interface Action {
  type: string;                    // one of ActionTypes
  payload: Record<string, unknown>;
}

interface SequencedAction extends Action {
  seq: number;        // monotonically increasing sequence number
  playerId: string;   // who dispatched it
  timestamp: number;  // Unix millis
  undo: Action;       // inverse action for undo support
}
```

---

### Action Types & Payloads

| ActionType           | Payload                                              | Description                                               |
|----------------------|------------------------------------------------------|-----------------------------------------------------------|
| `LOAD_DECK`          | `{ cards: [{ cardId, imageUrl }, ...] }`             | Load a full deck — creates Card instances in `{playerId}:deck`, all face-down. Undo = `CLEAR_PLAYER_CARDS`. |
| `CLEAR_PLAYER_CARDS` | `{}`                                                 | Remove all cards owned by the player. Undo = `LOAD_DECK` with removed cards. |
| `ADD_CARD`           | `{ cardId, imageUrl, zone, faceDown }`               | Add a single card to a zone                               |
| `REMOVE_CARD`        | `{ instanceId }`                                     | Remove a card by instanceId                               |
| `MOVE_CARD`          | `{ instanceId, toZone, toIndex? }`                   | Move a card between zones                                 |
| `SET_CARD_POSITION`  | `{ instanceId, x, y }`                               | Set card x/y on the canvas                                |
| `ROTATE_CARD`        | `{ instanceId, rotation }`                            | Set card rotation in degrees                              |
| `FLIP_CARD`          | `{ instanceId }`                                     | Toggle faceDown                                           |
| `DRAW_CARD`          | `{ fromZone, count? }`                               | Draw from end of zone → `{playerId}:hand`, sets faceDown=false. Default count=1. |
| `SHUFFLE_ZONE`       | `{ zone }`                                           | Randomize card order in a zone                            |
| `SET_ZONE_ORDER`     | `{ zone, instanceIds }`                              | Set explicit order of cards in a zone                     |
| `SET_COUNTER`        | `{ instanceId, counter, value }`                     | Set a named counter on a card                             |
| `SET_PLAYER_LIFE`    | `{ life }`                                           | Set the player's life total                               |
| `CARD_SELECTED`      | `{ instanceId }`                                     | Select a card (deselects player's previous). Empty instanceId = deselect only. |
| `CARD_MOVING`        | `{ instanceId, x, y }`                               | Update card position on canvas (throttled at 100ms client-side) |
| `REVEAL_CARD`        | `{ instanceId }`                                     | Toggle faceDown (double-click). Only owner can reveal. Self-inverse. |
| `TAP_CARD`           | `{ instanceId }`                                     | Toggle rotation 0↔90° (right-click). Origin: center-x, bottom minus half-width. Self-inverse. |

---

### Zone Keys

Zones are strings in the format `{playerId}:{zoneName}` or `shared:{zoneName}`.

Per-player zones (created on join):
- `{playerId}:deck`
- `{playerId}:hand`
- `{playerId}:battlefield`
- `{playerId}:graveyard`
- `{playerId}:exile`

Shared zones:
- `shared:stack`

---

### Client Architecture

#### Routes

React Router owns navigation through `appRoutes` in `client/src/App.tsx` and
`registroRoutes` in `mtglog/RegistroPages.tsx`. `router.ts` holds shared paths and
the Vite basename (`/collectible-card-gaming/`).

```
/                         → Registro overview
/games                    → saved games
/games/new                → new game
/games/:gameId             → game detail / image export
/games/:gameId/edit        → edit the saved game
/games/:gameId/rematch     → rematch from the saved game
/decks                    → saved decks
/decks/new                → new deck / imported draft
/decks/:deckId             → saved deck detail / card view
/decks/:deckId/stats       → saved deck composition / mana / token charts
/decks/:deckId/edit        → edit the saved deck
/stats                    → statistics menu
/stats/decks               → deck statistics
/stats/players             → player standings
/stats/players/:playerName → individual player statistics / image export
/stats/matchups            → matchup statistics
/stats/matchups/A/vs/B     → exact formation statistics / image export
/more                     → account / other actions
/players                  → player roster
/zaff                     → JoinScreen → DeckPicker → DeckPreview → GameView
```

Registro sections, saved game/deck details, and editors are pages. Their URLs
survive refresh and login; persisted records reopen by ID through existing services.
Older `?partita=ID` links redirect to `/games/:gameId`. Imported deck input is carried
in router history state. Unsaved form changes are not persisted across refresh.
Game forms guard navigation/Back and refresh; editor persistence blocks leaving
until the write completes. The bottom navigation uses real router links.
Deck list and deck statistics link to the same `/decks/:deckId` page. Saving or
cancelling an existing deck edit returns to its detail; creating a deck opens its
new detail page. Shared breadcrumbs show the page hierarchy (Home → section →
record → editor), independent of browser history.
Saved-deck charts use `/decks/:deckId/stats`, with a breadcrumb back to the deck.
Detail and statistics pages share `mtglog/useSavedDeck.ts`; chart rendering stays
in `DeckStatsContents`. The editor's local statistics preview uses its unsaved
draft, so it remains a task dialog and never substitutes the persisted card list.
Player and matchup details are routed pages, reusing Registro's shared games,
personal/group charts, and image export components. Matchup URLs accept any
formation size: `/stats/matchups/A/vs/B/vs/C`. They match the exact set of names,
independent of URL order. Encode each name through `router.ts` helpers and read
it once through the paired path readers; names may contain spaces, slashes, or
literal percent encodings. Derived matchup keys use JSON arrays, not delimiters
that can also appear inside a name. No selected-row/modal state is needed.

ZAFF's live-game sub-screens remain internal state: a refresh under `/zaff` lands
on the join screen. Leaving that route unmounts its connection. The build emits
`404.html` as a copy of `index.html` so GitHub Pages serves all deep links.

WebSocket is opened only when entering `GameView`. Deck selection/preview is purely client-side using MTGJSON API.

#### Shared UI kit (`client/src/components/ui/`)

Both halves of the app use this kit. Extend it instead of introducing parallel
Registro and ZAFF implementations. Some legacy controls still bypass it.

| Component | Purpose |
|-----------|---------|
| `Button` / `ButtonLink` / `ButtonRouteLink` | daisyUI `primary`, outlined `ghost`, soft secondary `link`, `danger`, text-style `text`, `subtle` (daisyUI ghost), and solid `neutral` × `sm`/`md`/`lg`/`xl`. Square/circle shapes use daisyUI modifiers. `link` is a historical variant name; use `ButtonRouteLink` for internal navigation and `ButtonLink` for external links. |
| `Field` | daisyUI `TextField`, `SelectField`, `TextAreaField` (label + control + associated hint/error), `density="compact"` for dense forms |
| `Panel` | `CenteredPanel` — the full-screen mask (ZAFF join, registro login, deck picker) |
| `SectionPage` / `Breadcrumbs` | Shared routed page shell: mobile widths, heading, daisyUI breadcrumb hierarchy, safe-area padding |
| `Modal` | Task overlay with ✕/Esc/backdrop close; `level={2}` stacks over another task |
| `CloseButton` | Shared square daisyUI button; default panel style or solid `surface="image"` contrast for card/token previews. Full label, title, and a decorative close icon. |
| `Badge` | daisyUI badges for deck sources, format tags, and quantities; semantic tones and `xs`/`sm`/`md`/`lg`/`xl` sizes. |
| `FilterTabs`, `NumberStepper` | Group/source filters, −/+ numeric input |
| `Tile` | `GridTile` and the existing navigation illustrations |
| `styles.ts` | `PANEL`, `FIELD_*`, `HEADING_*`, `TEXT_*`, `cx()` |

Fonts: Cinzel (`font-serif`) is for headings only — always via `HEADING_*`. Everything
else uses Inter (`font-sans`). Mana symbols come from mana-font via `mtglog/ManaIcon`.

#### UI Best Practices — Registro and ZAFF

These rules apply to both routes and every new or changed UI component. Existing
one-off controls are migration work, not examples to copy. The assessment and
implementation sequence are in [plans/PLAN_DAISYUI_MIGRATION.md](plans/PLAN_DAISYUI_MIGRATION.md).

**Library and migration boundary**

- Use **daisyUI 5 + Tailwind CSS 4 + our shared React kit**. daisyUI
  supplies component styles; React and native HTML supply interaction behavior.
  Do not introduce another general-purpose UI library or start using Base UI.
- Migrated primitives include shared buttons, button filters, basic
  input/select/textarea fields, page breadcrumbs, badges, and close buttons. `index.css` enables
  those daisyUI components and their field/label styles. Extend that allowlist
  when implementing another shared primitive; do not use classes whose component
  CSS is not enabled.
- Custom pie charts, histograms, deck/card views, life-counter play areas,
  and true task dialogs keep their domain behavior. Navigation sections use
  React Router pages, composed with `SectionPage`; do not recreate section
  overlays. An ordinary UI task should not expand into rewriting domain views. Existing
  shared buttons/fields inside them naturally receive the common kit styles.
- During migration, change shared implementations first so both routes receive
  the same controls. After a primitive is migrated, its daisyUI implementation
  is the only implementation for new uses; do not maintain a legacy twin.
- Consult the official docs for the installed daisyUI major before using a new
  component or modifier. Do not copy older Tailwind/daisyUI setup snippets.

**Component reuse and simple APIs**

- Search `components/ui/` and existing feature components before building.
  Standard buttons, links styled as buttons, fields, badges, filters, panels,
  pages, and dialogs must use shared components. Raw HTML controls belong inside
  those shared implementations, not as freshly styled controls in screens.
- Extend a shared component with a small typed prop or variant when needed.
  A new shared primitive is appropriate when it establishes a common control
  or behavior; do not create a second button, field, or modal for one route.
- Use `CloseButton` for icon close actions in task dialogs and full-screen
  card/token previews. Use `Badge` for source labels, JPG tags, and card counts
  in both Registro and ZAFF; do not draw these badges with one-off spans or SVGs.
- Put daisyUI component classes in the shared kit. Screen `className` props may
  handle placement, width, and surrounding layout; do not override a control's
  colors, font, radius, padding, focus, or disabled appearance at each call site.
  Promote repeated visual choices to a shared size, variant, or theme token.
- Keep component APIs easy to read: explicit props, standard HTML attributes,
  typed values/callbacks, and local state for local interactions. Derive values
  from existing data instead of storing synchronized copies. Keep visual
  primitives free of API calls, database access, and game rules.
- Reuse domain views when behavior matches. Adapt their input with existing
  types/helpers instead of copying a Registro component into ZAFF. Share the
  common presentation without coupling unrelated authentication or game flows.
- MTG card artwork, mana symbols, charts, seat colors, Fabric canvas rendering,
  and life-counter play areas are domain UI. Custom rendering is allowed where
  daisyUI has no equivalent; compose standard controls from the kit and keep
  the domain rendering reusable. This is not an exception for ordinary buttons
  or bespoke modal behavior.

**Theme, layout, and states**

- Use one application theme across Registro and ZAFF. Keep theme definitions
  in `index.css` and shared presentation helpers in `ui/styles.ts`. Once
  migrated, use daisyUI semantic colors (`base-*`, `primary`, `accent`,
  `success`, `warning`, `error`) instead of a second screen-specific palette.
- Use the existing typography helpers: Cinzel for headings, Inter for body
  and controls. Prefer daisyUI sizes and the Tailwind spacing scale. Introduce
  special dimensions centrally only for a concrete need such as card ratios,
  safe areas, canvas geometry, or large life-counter targets.
- Build responsive layouts that support narrow phones, long names, scrolling,
  and safe-area insets. Keep primary actions reachable and give small icon
  controls enough room to tap. Preserve the existing iOS date/time fixes.
- Include loading, empty, error, disabled, and saving states where relevant.
  Preserve input on failed saves and prevent duplicate submissions. Use shared
  feedback patterns when the same status appears in multiple screens.

**Navigation and page structure**

- Give app sections and persisted record details/editors a React Router route.
  Keep route definitions in the existing trees and reuse `router.ts` paths.
  Do not add modal state machines or direct `history.pushState`/`replaceState`
  calls for navigation. The router handles the Vite deployment basename.
- Compose Registro sections with `SectionPage`. Keep their narrow mobile widths,
  normal document scrolling, safe-area padding, and bottom navigation. A page
  has an `h1` and the shared breadcrumb trail; it does not lock background scrolling.
- Breadcrumbs describe hierarchy, not the previous visited page. Supply linked
  ancestors through `SectionPage`; it adds Home and the nonlinked current page
  with `aria-current="page"`. Use saved record names when available, and keep
  Home visible on narrow phones. The shared trail fits one row by shortening
  whole words from the earliest ancestor onward, then the next, and the current
  page last. Never cut a word in half. Preserve full accessible names, link
  destinations, and title hints when a crumb becomes `…`; restore full labels
  as space grows. Do not recreate trails in each screen.
- Put persisted IDs in the URL and load through existing services/shared data.
  Do not require a clicked record in component state to reopen a page. Preserve
  the requested URL through authentication and handle missing/forbidden records.
- Use router links for navigation, including menus and the bottom bar. Browser
  Back/Forward should follow visited pages; tapping the active section stays
  there. Keep unsaved-game and save-in-progress guards through `useLeaveGuard`.
- Reserve dialogs for short local tasks such as choosing cards/players/formats
  and confirmations. Existing custom card views/life-counter interactions stay
  intact; route changes do not justify rewriting their rendering.

**Interaction and accessibility**

- Use buttons for actions and anchors for navigation, preserving `href` and
  the shared router paths and `ButtonRouteLink`/React Router `Link`. Label every
  input and icon-only control. Connect field
  hints/errors with `aria-describedby` and mark invalid fields with
  `aria-invalid`. Keep visible keyboard focus; color alone is not a status.
- Filters use pressed-button semantics; only actual tab panels use tab roles
  and tab keyboard behavior. Prefer native selects over custom listboxes unless
  the feature needs search or another behavior a select cannot provide.
- When undertaking a separate overlay migration, true blocking dialogs must
  have an accessible name, initial focus, focus
  containment/return, Escape and backdrop handling, and reliable scroll cleanup.
  With daisyUI, implement native `<dialog>`/`showModal()` through the shared
  React wrapper and synchronize close/cancel events with React state. Do not
  use checkbox/URL hacks or assume styling supplies focus management.
- Task dialogs cover the page and its bottom navigation. Full-screen card
  viewers/pickers must remain above their parent dialog; a larger `z-index`
  cannot escape a native dialog's top layer. Handle this in the shared overlay
  implementation when migrating true dialogs.

**API, hook, and type reuse**

- Reuse the existing data boundary before adding requests:

  | Need | Reuse |
  |------|-------|
  | Saved deck read/write/subscriptions | `services/savedDecks.ts` |
  | Read-only saved deck page loading/subscriptions | `mtglog/useSavedDeck.ts` |
  | Registro game statistics / player and matchup data | `useRegistro()` shared games and `mtglog/stats.ts` |
  | Deck parsing, normalization, identity | `services/deckCards.ts` |
  | ZAFF deck adapters, validation, expansion | `services/playableDeck.ts` |
  | MTGJSON deck index/details | `services/mtgjson.ts` |
  | Card search/images/autocomplete | `services/scryfall.ts` and `mtglog/useDeckImages.ts` |
  | Scryfall request queue and verified resolution | `services/scryfallLookup.ts` |
  | Live game connection/actions | `network/useSocket.ts`, `network/socket.ts`, `@zaff/shared` |
  | Existing database client, table constants, subscriptions | `services/supabase.ts` |

- New remote requests and database operations belong in a named service, with
  shared types and error handling. Components call that service directly or
  through a hook when React lifecycle/subscription behavior needs reuse. Do
  not create another client, endpoint string, cache, or transport in a screen.
- Registro still has direct queries/auth calls and an in-component precon
  loader. Do not multiply those patterns. When related work needs the same
  operation again, extract/extend a service rather than copying the query.
  Do not rewrite all persistence as part of an unrelated styling change.
- Preserve saved-deck revisions/conflict handling, card identities, subscription
  cleanup, and full-state WebSocket replacement. A UI library change must not
  change data sources, storage formats, or game action payloads incidentally.

**Verification and review**

- For executable UI changes, run `npm run build` and the relevant existing
  interaction tests. Shared behavior changes need focused coverage, especially
  forms, asynchronous saving, dialog close/focus, and nested overlays. Cosmetic
  changes do not need tests that only assert classes.
- Visually check affected screens on phone and desktop. Changes to shared
  controls need a representative Registro screen and a ZAFF screen; dialog
  changes also need keyboard, nested-dialog, navigation, and scroll checks.
- `npm run lint` is currently not wired in the client. Do not report it as a
  passing check. Documentation-only changes need document/diff checks.
- Before handing off, inspect the diff for duplicated controls/services,
  screen-level appearance overrides, and unexplained custom CSS. State which
  shared components/APIs were reused or extended and what was verified.
  These are agent/review rules; they do not constitute an automated lint gate.

If a requested design needs a one-off style, explain the shared component or
theme change that would keep both routes consistent and use that route by
default. Honor an explicit user choice for a one-off without asking again.

#### Socket Layer

- **`socket.ts`** — `WebSocketGameSocket` class: `connect()`, `sendAction()`, `sendUndo()`, `sendPing()`, `onMessage()`, `onStatusChange()`
- **`useSocket.ts`** — React hook wrapping the socket. Returns `{ status, playerId, gameState, sendAction, sendUndo, disconnect }`.

Message handling in `useSocket`:

| Server Message   | Client Action                                                  |
|------------------|----------------------------------------------------------------|
| `WELCOME`        | Store `playerId`                                               |
| `STATE_SYNC`     | Replace entire `gameState` with `message.state`                |
| `PLAYER_JOINED`  | Merge new player into `gameState.players`                      |
| `PLAYER_LEFT`    | Set `connected: false` on player                               |
| `ACTION_RESULT`  | Replace entire `gameState` with `message.state`                |
| `ERROR`          | `console.error`                                                |
| `PONG`           | No-op                                                          |

#### Deck Confirmation → LOAD_DECK Flow

1. User clicks "Confirm Deck" in `DeckPreview`
2. `ZaffApp` switches to `game` screen, passes `selectedDeck` + `connection` to `GameView`
3. `GameView` mounts → `useSocket` opens WebSocket
4. On `connected` + `selectedDeck` present: `useEffect` fires (once, via ref guard)
5. Expands deck cards by count (4× of a card = 4 entries), sends:
   ```json
   { "msg": "ACTION", "action": { "type": "LOAD_DECK", "payload": { "cards": [{ "cardId": "<scryfallId>", "imageUrl": "<url>" }, ...] } } }
   ```
6. Server creates Card instances in `{playerId}:deck` zone (all `faceDown: true`)
7. Server broadcasts `ACTION_RESULT` with full updated `GameState`
8. All clients replace their `gameState` — deck zone now has the loaded cards

---

### Key Files

| File | Purpose |
|------|---------|
| `shared/src/state.ts` | GameState, Player, Card types |
| `shared/src/actions.ts` | ActionTypes enum, Action, SequencedAction interfaces |
| `shared/src/protocol.ts` | ClientMessage, ServerMessage envelopes |
| `server/main.go` | Server entry, WebSocket handler, connection lifecycle |
| `server/room.go` | Room: ProcessAction, ProcessUndo, AddClient, broadcast |
| `server/reducer.go` | Reduce function — all 13 action types |
| `server/protocol.go` | Go-side message/payload structs |
| `server/state.go` | Go GameState, Player, Card structs, zone init |
| `server/client.go` | Client: ReadLoop, handleMessage dispatch |
| `server/tunnel.go` | Built-in Cloudflare tunnel support |
| `client/src/App.tsx` | React Router tree and app shell |
| `client/src/components/ZaffApp.tsx` | ZAFF screen state machine |
| `client/src/components/mtglog/RegistroPages.tsx` | Registro route definitions and page composition |
| `client/src/router.ts` | Shared route paths, basename, and share-link hrefs |
| `client/src/components/ui/` | Shared UI kit (buttons, fields, panel, modal…) |
| `client/src/components/MtgLog.tsx` | Registro authentication, shared data, and page outlet |
| `client/src/components/GameView.tsx` | Game screen, LOAD_DECK dispatch |
| `client/src/components/DeckPreview.tsx` | Deck review before confirmation |
| `client/src/network/useSocket.ts` | Central client message handler |
| `client/src/network/socket.ts` | WebSocketGameSocket class |

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
└── plans/           # Implementation plans
```

## Build & Run

```bash
npm run dev:all      # Start client (Vite :5173) + server (Go :8080)
                     # Server prompts for Cloudflare tunnel interactively
npm run dev          # Client only
npm run dev:server   # Server only
npm run build        # Build shared + client
npm run test         # Run client tests (vitest)
npm run lint         # Lint client
```

The Go server binary is at `server/`. Run directly: `cd server && go run . --port 8080`.

## Tech Stack

- **Client**: React 19, Vite, Tailwind CSS v4, FabricJS (planned), TypeScript
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

Two pages, resolved from the path in `client/src/router.ts` (base `/collectible-card-gaming/`):

```
/        → MtgLog       registro partite — the app's home
/zaff    → JoinScreen → DeckPicker → DeckPreview → GameView
             (join)      (pickDeck)   (previewDeck)   (game)
```

`useRoute()` uses `history.pushState` + `popstate`; the ZAFF sub-screens stay internal
state (a refresh under `/zaff` lands on the join screen). The build emits `404.html` as
a copy of `index.html` so GitHub Pages serves the deep link.

WebSocket is opened only when entering `GameView`. Deck selection/preview is purely client-side using MTGJSON API.

#### Shared UI kit (`client/src/components/ui/`)

Both halves of the app are built from these; prefer extending them over new one-off classes.

| Component | Purpose |
|-----------|---------|
| `Button` / `ButtonLink` | `primary` (gradient), `ghost`, `link`, `danger` × `sm`/`md`/`lg` |
| `Field` | `TextField`, `SelectField`, `TextAreaField` (label + control + error), `density="compact"` for dense forms |
| `Panel` | `CenteredPanel` — the full-screen mask (ZAFF join, registro login, deck picker) |
| `Modal` | Overlay with ✕/Esc/backdrop close; `level={2}` stacks over another modal |
| `FilterTabs`, `Badge`, `NumberStepper` | Group/source filters, pills, −/+ numeric input |
| `styles.ts` | `PANEL`, `FIELD_*`, `HEADING_*`, `TEXT_*`, `cx()` |

Fonts: Cinzel (`font-serif`) is for headings only — always via `HEADING_*`. Everything
else uses Inter (`font-sans`). Mana symbols come from mana-font via `mtglog/ManaIcon`.

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
2. `App` switches to `game` screen, passes `selectedDeck` + `connection` to `GameView`
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
| `client/src/App.tsx` | Route + screen state machine |
| `client/src/router.ts` | Two-route router (`/`, `/zaff`) |
| `client/src/components/ui/` | Shared UI kit (buttons, fields, panel, modal…) |
| `client/src/components/MtgLog.tsx` | Registro partite home (header, standings, modals) |
| `client/src/components/GameView.tsx` | Game screen, LOAD_DECK dispatch |
| `client/src/components/DeckPreview.tsx` | Deck review before confirmation |
| `client/src/network/useSocket.ts` | Central client message handler |
| `client/src/network/socket.ts` | WebSocketGameSocket class |

# Plan 2: ZAFF Game State Server

## 1. Stack Decision: Go vs Node.js

### Comparison for This Use Case

| Criterion | Go | Node.js |
|---|---|---|
| **Single binary distribution** | Native -- `go build` produces one static binary. No runtime needed on user's machine. | Requires Node runtime or bundling via `pkg`/`bun compile`/`nexe`. Adds 40-80 MB to output. |
| **Cross-compilation** | Built-in. `GOOS=windows GOARCH=amd64 go build` just works. No C toolchain needed when CGO is disabled. | Not natively cross-compilable. `pkg` can do it but is fragile. |
| **WebSocket support** | `coder/websocket` (formerly nhooyr/websocket) is actively maintained, context-aware, handles concurrent writes safely. | `ws` package is mature and battle-tested. Native WebSocket support exists in Node 22+. |
| **JSON handling** | `encoding/json` is fine for this scale. Slightly more boilerplate than JS. | JSON is native to the language. Zero friction. |
| **Type sharing with client** | No shared types -- must keep server and client action definitions in sync manually or via codegen. | TypeScript types can be shared directly in a monorepo (e.g., a `shared/` package). |
| **Development speed** | Slightly slower initial velocity due to struct definitions and error handling. Offset by compile-time checks catching bugs early. | Fastest path to a working prototype. Hot-reload with `tsx --watch`. |
| **Concurrency model** | Goroutine-per-connection is a natural fit for WebSocket servers. | Single-threaded event loop works fine at this scale (2-4 connections). |
| **GitHub Releases** | Trivial via `goreleaser` or a matrix build in Actions. | Possible but awkward. Needs a bundler. |
| **Dev machine readiness** | Go 1.24.2 is installed. | Node 24.14.0 is installed. |

### Recommendation: Start with Go directly

Rationale:

1. The server is simple enough (under 500 lines of application logic) that Go's "verbosity overhead" is negligible. There are no complex abstractions, no ORM, no template rendering -- just WebSocket message handling and JSON state management.

2. Starting with Node.js to "prototype faster" means eventually rewriting in Go anyway. The rewrite cost exceeds the small initial speedup, especially since WebSocket + JSON in Go is straightforward.

3. The primary distribution requirement -- a single downloadable binary per platform via GitHub Releases -- is Go's strongest advantage and Node's weakest.

4. Go is already installed on the dev machine. No setup friction.

5. The type-sharing disadvantage is real but manageable. The action format will be defined as a JSON schema document in the repo's `docs/` or `shared/` directory that both the Go server and the TypeScript client reference. This is actually more robust than TypeScript type sharing because it forces an explicit protocol contract.

**Library choices for Go:**
- WebSocket: `coder/websocket` (v2) -- actively maintained, idiomatic `context.Context` API, safe concurrent writes
- HTTP: standard library `net/http` -- no framework needed for a single-endpoint server
- JSON: standard library `encoding/json`
- CLI flags: standard library `flag` -- just needs `--port` and `--room-code` at most
- Logging: `log/slog` (standard library, structured logging, available since Go 1.21)

**Project location:** `server/` directory at the repo root. The Go module would be `github.com/asturur/collectible-card-gaming/server`.

---

## 2. Action/Reducer Architecture

### 2.1 Core Principles

- The server is the **single source of truth**. All state mutations go through the server.
- Actions flow: **Client dispatches action -> Server reduces -> Server broadcasts to all clients**.
- The server's reducer computes the **inverse (undo) action** during reduction and attaches it to the action log entry. Clients do not need to pre-compute undo.
- The action log is an ordered, append-only list. Undo is achieved by applying inverse actions from the log in reverse order.

### 2.2 Action Format (JSON Schema)

```
Action (client -> server):
{
  "type": string,          // Action type identifier, e.g., "MOVE_CARD"
  "payload": object,       // Type-specific data
}

SequencedAction (server -> all clients, and stored in log):
{
  "type": string,
  "payload": object,
  "seq": integer,          // Monotonically increasing sequence number, assigned by server
  "playerId": string,      // Which player dispatched this action, set by server
  "timestamp": integer,    // Unix millis, set by server
  "undo": {                // Inverse action, computed by server reducer
    "type": string,
    "payload": object
  }
}
```

The client sends a minimal action (just `type` + `payload`). The server enriches it with `seq`, `playerId`, `timestamp`, and `undo` before storing and broadcasting.

### 2.3 Action Types (Initial Set)

| Action Type | Payload | Undo Payload | Description |
|---|---|---|---|
| `ADD_CARD` | `{ cardId, imageUrl, zone, faceDown }` | `REMOVE_CARD { instanceId }` | Add a card instance to the game |
| `REMOVE_CARD` | `{ instanceId }` | `ADD_CARD { ...full card state }` | Remove a card instance |
| `MOVE_CARD` | `{ instanceId, toZone, toIndex? }` | `MOVE_CARD { instanceId, toZone: <prev>, toIndex: <prev> }` | Move card between zones |
| `SET_CARD_POSITION` | `{ instanceId, x, y }` | `SET_CARD_POSITION { instanceId, x: <prev>, y: <prev> }` | Position card on battlefield |
| `ROTATE_CARD` | `{ instanceId, angle }` | `ROTATE_CARD { instanceId, angle: <prev> }` | Rotate card (tap = 90 degrees) |
| `FLIP_CARD` | `{ instanceId }` | `FLIP_CARD { instanceId }` | Toggle face-up/face-down (self-inverse) |
| `SHUFFLE_ZONE` | `{ zone }` | `SET_ZONE_ORDER { zone, order: <prev> }` | Randomize card order in zone |
| `SET_ZONE_ORDER` | `{ zone, order: [instanceIds] }` | `SET_ZONE_ORDER { zone, order: <prev> }` | Explicit reorder |
| `DRAW_CARD` | `{ fromZone, count? }` | `RETURN_CARDS { cards: [...], toZone, indices }` | Draw top N cards from zone to hand |
| `SET_COUNTER` | `{ instanceId, name, value }` | `SET_COUNTER { instanceId, name, value: <prev> }` | Set a named counter on a card |
| `SET_PLAYER_LIFE` | `{ life }` | `SET_PLAYER_LIFE { life: <prev> }` | Change player life total |
| `LOAD_DECK` | `{ cards: [{cardId, imageUrl}...] }` | `CLEAR_PLAYER_CARDS {}` | Bulk load a deck for a player |
| `CLEAR_PLAYER_CARDS` | `{}` | `LOAD_DECK { cards: [...] }` | Remove all of a player's cards |

### 2.4 Reducer Implementation (Go side)

The reducer is a pure function (in the functional sense -- given the same state and action, it produces the same result):

```
func Reduce(state *GameState, action Action, playerId string) (newState *GameState, undoAction Action, err error)
```

Implementation pattern:
- A `switch` on `action.Type`
- Each case reads the relevant part of state, computes the undo payload from current values, applies the mutation, returns both the new state and the undo action
- Unknown action types return an error (which the server sends back to the client as an error message)
- The reducer operates on a pointer to the state (since Go does not have immutable data structures, and deep-copying the entire state on every action would be wasteful for this use case). The undo action captures the previous values needed to reverse the change.

### 2.5 Undo Mechanism

The action log stores every `SequencedAction` (with its `undo` field) in an ordered slice.

When a client requests undo:
1. The server looks up the action by `seq` number in the log
2. The server takes the `undo` field from that log entry
3. The server reduces the undo action as a new action (creating a new log entry -- the undo itself is undoable)
4. The undo action is broadcast like any other action

This means the action log is strictly append-only. "Undoing action 42" is just "applying action 57 which happens to be the inverse of action 42." This avoids the complexity of rewinding and replaying.

Constraints:
- Undo is only safe if no later action depends on the state that action 42 produced. Since players coordinate verbally and the game has no rules engine, this is acceptable. If an undo produces an inconsistent state (e.g., undoing a card move when that card has since been moved again), the second undo action simply won't find the card where it expects -- the reducer should handle this gracefully by returning an error or no-op.

---

## 3. WebSocket Protocol Design

### 3.1 Connection Flow

```
1. Client opens WebSocket to ws://localhost:PORT/ws?name=PlayerName
2. Server assigns a playerId (UUID) and adds client to the room
3. Server sends STATE_SYNC message with full current state + action log
4. Server broadcasts PLAYER_JOINED to all other clients
5. Client is now live -- sends actions, receives broadcasts
```

### 3.2 Message Envelope

All WebSocket messages are JSON with a `msg` field identifying the type:

**Client -> Server messages:**

```json
{ "msg": "ACTION", "action": { "type": "...", "payload": {...} } }
{ "msg": "UNDO", "seq": 42 }
{ "msg": "PING" }
```

**Server -> Client messages:**

```json
{ "msg": "WELCOME", "playerId": "uuid", "playerName": "Alice" }
{ "msg": "STATE_SYNC", "state": {...}, "log": [...] }
{ "msg": "ACTION_RESULT", "action": { ...sequenced action with undo... } }
{ "msg": "PLAYER_JOINED", "playerId": "uuid", "playerName": "Bob" }
{ "msg": "PLAYER_LEFT", "playerId": "uuid" }
{ "msg": "ERROR", "error": "description", "refSeq": 42 }
{ "msg": "PONG" }
```

### 3.3 Message Flow Details

**Normal action:**
1. Client A sends `ACTION` message
2. Server reduces it, assigns seq number, computes undo
3. Server stores in action log
4. Server sends `ACTION_RESULT` to ALL connected clients (including sender)
5. All clients apply the action to their local state

**Why broadcast to sender too?** Because the server is authoritative. The client should not optimistically apply actions before the server confirms. This keeps all clients in lockstep. Given the localhost prototype scenario, latency is sub-millisecond so there is no perceptible delay.

**New client joining:**
1. New client connects
2. Server sends `WELCOME` with assigned player identity
3. Server sends `STATE_SYNC` with the full current `GameState` object
4. Server broadcasts `PLAYER_JOINED` to existing clients
5. The action log is optionally included in `STATE_SYNC` -- the client can use it for a "recent moves" feed but does not need it for state reconstruction.

**Undo:**
1. Client sends `UNDO` with the `seq` number of the action to reverse
2. Server looks up the action in the log, extracts the `undo` field
3. Server reduces the undo action as a normal action
4. Result is broadcast as a normal `ACTION_RESULT` to all clients

### 3.4 Ping/Pong

WebSocket protocol-level pings are handled by `coder/websocket` automatically. Application-level `PING`/`PONG` messages are optional but useful for latency display in the client UI.

---

## 4. Room/Session Management

### 4.1 Initial Design: Single Room

For the localhost prototype, the server runs a single room. All connecting clients join the same room. No room codes, no room selection.

### 4.2 Extensible Design

Even though only one room is needed now, the Go code should be structured so that rooms are a first-class concept:

```
Server
  └── map[roomCode]*Room
        └── Room
              ├── GameState
              ├── ActionLog []SequencedAction
              ├── Clients   map[playerId]*Client
              ├── SeqCounter uint64
              └── mu sync.RWMutex
```

- `Server` holds a map of rooms, initially containing just one default room.
- `Room` encapsulates all game state, the action log, connected clients, and a mutex for safe concurrent access.
- `Client` wraps a WebSocket connection and player metadata.

The single-room prototype uses a hardcoded room code (e.g., `"default"`). Adding multi-room support later means:
1. Adding a `room` query parameter to the WebSocket URL
2. Creating rooms on demand when the first client joins with a new code
3. Destroying rooms when the last client leaves
4. Adding an HTTP endpoint to list/create rooms (optional)

### 4.3 Player Identity

Players are identified by a server-assigned UUID. The player provides a display name via the `name` query parameter on connection. There is no authentication -- this is a trusted, friends-only game.

---

## 5. State Shape

### 5.1 GameState Structure

```json
{
  "players": {
    "<playerId>": {
      "name": "Alice",
      "life": 20,
      "connected": true
    }
  },
  "cards": {
    "<instanceId>": {
      "instanceId": "inst-uuid-1",
      "cardId": "mtg-12345",
      "imageUrl": "https://api.scryfall.com/cards/.../image",
      "ownerId": "<playerId>",
      "zone": "player1:battlefield",
      "zoneIndex": 0,
      "x": 350.5,
      "y": 200.0,
      "rotation": 90,
      "faceDown": false,
      "counters": {
        "+1/+1": 2,
        "loyalty": 4
      }
    }
  },
  "zones": {
    "<playerId>:deck": ["inst-uuid-1", "inst-uuid-2"],
    "<playerId>:hand": ["inst-uuid-3"],
    "<playerId>:battlefield": ["inst-uuid-4", "inst-uuid-5"],
    "<playerId>:graveyard": [],
    "<playerId>:exile": [],
    "shared:stack": []
  }
}
```

### 5.2 Design Decisions

**Why `instanceId` separate from `cardId`?** A player can have multiple copies of the same card (e.g., 4x Lightning Bolt). `cardId` is the card's identity in the MTG database (used to fetch art). `instanceId` is the unique identity of this specific card instance in this game session, generated as a UUID when the card is added.

**Why store cards in a flat map AND track zone membership in a `zones` map?** This is deliberate denormalization for efficient access patterns:
- `cards` map: O(1) lookup by instanceId for mutations (move, rotate, flip)
- `zones` map: ordered lists for zone-aware operations (draw from top of deck, display hand in order)
- The card's `zone` field and its presence in `zones[zone]` must stay in sync. The reducer is responsible for maintaining this invariant.

**Position (`x`, `y`) semantics:** Only meaningful for cards on the battlefield zone. For cards in hand/deck/graveyard, the client determines visual layout. The server stores `x: 0, y: 0` for non-battlefield cards.

**Rotation:** Stored in degrees. Common values: 0 (upright), 90 (tapped), 180 (flipped orientation). The client can support arbitrary rotation if desired.

**`faceDown`:** Boolean. When `true`, the client should render the card back. Since all state is visible to all clients (by design -- "we are mature adults"), this is a visual convention, not a security boundary.

**`life`:** Player life total, defaulting to 20. This is a simple integer that can be changed via `SET_PLAYER_LIFE`.

**`connected`:** Boolean tracking whether the player's WebSocket is currently open. When a player disconnects, their cards and state remain. They can reconnect and resume (within the same server session).

### 5.3 Go Type Definitions

The Go structs would mirror this JSON structure:

- `GameState` struct with `Players map[string]*Player`, `Cards map[string]*Card`, `Zones map[string][]string`
- `Player` struct with `Name`, `Life`, `Connected` fields
- `Card` struct with all the fields listed above
- JSON tags on all fields for clean serialization

---

## 6. Build and Release Pipeline

### 6.1 Directory Structure

```
server/
  go.mod
  go.sum
  main.go              # Entry point: flag parsing, HTTP server setup
  room.go              # Room struct, client management, broadcast
  reducer.go           # Reducer function, all action handlers
  reducer_test.go      # Table-driven tests for every action type
  state.go             # GameState, Player, Card type definitions
  protocol.go          # Message types (ClientMessage, ServerMessage envelopes)
  client.go            # Client struct, read/write loops per connection
```

### 6.2 Local Development

```bash
cd server
go run .                     # Start server on :8080 (default)
go run . --port 3001         # Custom port
go test ./...                # Run all tests
```

### 6.3 GitHub Actions Workflow

File: `.github/workflows/server-release.yml`

Trigger: Push of a tag matching `server/v*` (e.g., `server/v0.1.0`).

Strategy: Use a build matrix to compile for 6 targets:
- `linux/amd64`, `linux/arm64`
- `darwin/amd64`, `darwin/arm64`
- `windows/amd64`, `windows/arm64`

Steps:
1. Checkout code
2. Setup Go (matching the version in `go.mod`)
3. Run `go test ./...` in the `server/` directory
4. For each matrix entry: `GOOS=$os GOARCH=$arch CGO_ENABLED=0 go build -o zaff-server-$os-$arch`
5. Compress: `.tar.gz` for Linux/macOS, `.zip` for Windows
6. Create GitHub Release using `softprops/action-gh-release`
7. Attach all 6 binaries to the release

Setting `CGO_ENABLED=0` is critical -- it produces fully static binaries with no system library dependencies, ensuring the binaries work on any machine of the target OS/arch without installing anything.

### 6.4 Versioning

Use semantic versioning with a `server/` prefix for tags to keep server releases independent from client releases. The repo will eventually contain both the Vite client app and the Go server; prefixed tags prevent confusion.

---

## 7. Error Handling and Edge Cases

### 7.1 Client Disconnect

When a WebSocket connection closes (clean or unclean):
1. The server marks `player.Connected = false` in the game state
2. The server broadcasts `PLAYER_LEFT` to remaining clients
3. The player's cards and state remain intact in the game state
4. The player's entry stays in `Room.Clients` with a nil connection, allowing reconnect

### 7.2 Client Reconnect

When a client connects with the same `name` as a disconnected player:
1. The server reuses the existing `playerId` for that name
2. The server sends `STATE_SYNC` with full current state
3. The server marks `player.Connected = true`
4. The server broadcasts `PLAYER_JOINED` to other clients
5. The reconnected client is now fully caught up

Name-based reconnection is simple and sufficient for a localhost prototype. It does not handle the case where two different people use the same name, but that is not a realistic scenario for a two-player game between friends.

### 7.3 Invalid Actions

If a reducer cannot apply an action (e.g., `MOVE_CARD` with a nonexistent `instanceId`):
1. The reducer returns an error
2. The server sends an `ERROR` message to the requesting client only (not broadcast)
3. The action is NOT added to the log
4. No state change occurs

### 7.4 Undo of Already-Undone or Stale Actions

If a client requests undo of an action whose effects have been superseded:
1. The server retrieves the stored undo action
2. The reducer attempts to apply it
3. If the undo action fails (e.g., the card is no longer where the undo expects it), the server returns an `ERROR`
4. If it succeeds, it is applied normally

This is a best-effort undo. For a rules-free game where players coordinate verbally, this is appropriate.

### 7.5 Last Client Leaves

When all clients disconnect from a room:
- The room and its state remain in memory for a configurable grace period (default: 5 minutes)
- If no client reconnects within the grace period, the room is destroyed and all state is lost
- For the single-room prototype, this can be simplified to "state lives as long as the server process runs"

### 7.6 Message Ordering

Since Go handles each WebSocket connection in its own goroutine, and all mutations go through a single room mutex, actions are serialized at the room level. The `seq` counter provides a total ordering. If two clients send actions simultaneously, one will be processed first (whichever acquires the mutex first) and get a lower `seq` number.

### 7.7 Large State Sync

For a typical game with 2 players and approximately 120 cards total, the `STATE_SYNC` JSON would be roughly 30-50 KB. This is well within WebSocket message size limits and will transfer in under 1ms on localhost.

---

## 8. Development Setup

### 8.1 Running Alongside the Vite Client

The Vite dev server (Plan 1) runs on port 5173 (default). The Go server runs on a different port (e.g., 8080).

During development:
```
Terminal 1:  cd client && npm run dev          # Vite on :5173
Terminal 2:  cd server && go run . --port 8080 # Go server on :8080
```

The Vite client connects to `ws://localhost:8080/ws` for the WebSocket connection. Since the client and server are on different ports, this is a cross-origin request. The Go server should set appropriate CORS headers on the HTTP upgrade request. With `coder/websocket`, the `AcceptOptions` struct has an `OriginPatterns` field that can be set to `["*"]` for development.

### 8.2 Vite Proxy (Alternative)

Instead of CORS, Vite can proxy WebSocket connections to the Go server. In `vite.config.ts`:

```
server.proxy: { "/ws": { target: "ws://localhost:8080", ws: true } }
```

This way the client connects to `ws://localhost:5173/ws` and Vite forwards it to the Go server. This avoids CORS entirely and is cleaner for development. The production build would need its own proxy or the client would connect directly.

**Recommendation:** Use the Vite proxy approach for development. It is simpler and avoids CORS configuration.

### 8.3 Testing the Server

**Unit tests:** Table-driven tests for every reducer action. Each test case provides an initial state, an action, and the expected resulting state + undo action. This ensures deterministic behavior.

**Integration tests:** A Go test that starts the server, connects two WebSocket clients, sends actions from one, and verifies the other receives them. Go's `httptest` package makes this straightforward.

**Manual testing:** Open two browser tabs to `http://localhost:5173`. Each tab enters a different player name and joins. Actions from one tab should appear in the other.

### 8.4 Development Tooling

- `go vet` and `staticcheck` for linting
- `go test -race ./...` for race condition detection (critical since the server is concurrent)
- Consider `air` or `gow` for auto-reload during development (watches `.go` files, restarts server on change)

---

## 9. Sequence Diagrams

### 9.1 Normal Game Flow

```
Client A                    Server                     Client B
   |                          |                           |
   |--- WS connect --------→ |                           |
   |←-- WELCOME ------------ |                           |
   |←-- STATE_SYNC --------- |                           |
   |                          |                           |
   |                          | ←--- WS connect ---------|
   |                          | ---- WELCOME -----------→ |
   |                          | ---- STATE_SYNC --------→ |
   |←-- PLAYER_JOINED ------ | ---- PLAYER_JOINED -----→ |
   |                          |                           |
   |--- ACTION(MOVE_CARD) -→ |                           |
   |                          | [reduce, assign seq=1]   |
   |←-- ACTION_RESULT(seq1)  | ---- ACTION_RESULT(seq1)→ |
   |                          |                           |
   |                          | ←-- ACTION(FLIP_CARD) ---|
   |                          | [reduce, assign seq=2]   |
   |←-- ACTION_RESULT(seq2)  | ---- ACTION_RESULT(seq2)→ |
   |                          |                           |
   |--- UNDO(seq=1) -------→ |                           |
   |                          | [apply undo of seq1]     |
   |                          | [assign seq=3]           |
   |←-- ACTION_RESULT(seq3)  | ---- ACTION_RESULT(seq3)→ |
```

---

## 10. Implementation Order

The implementation should proceed in this order, each step producing a testable artifact:

1. **Types and state** (`state.go`, `protocol.go`): Define all Go structs for `GameState`, `Card`, `Player`, action/message types. Write JSON marshaling tests.

2. **Reducer** (`reducer.go`, `reducer_test.go`): Implement the reducer function and all action handlers. Test every action type with table-driven tests. This is the core logic and can be developed and tested without any networking code.

3. **Room** (`room.go`): Implement the `Room` struct that holds state, action log, and client list. Implement the broadcast method. Write the "process action" method that calls the reducer and broadcasts.

4. **Client connection handling** (`client.go`): Implement the per-client read/write goroutines. Handle connection, disconnection, and message parsing.

5. **HTTP server and WebSocket upgrade** (`main.go`): Wire everything together. Parse flags, create default room, handle the `/ws` endpoint with WebSocket upgrade.

6. **Integration test**: Write a Go test that starts the server and tests the full flow with two WebSocket clients.

7. **GitHub Actions workflow**: Add `.github/workflows/server-release.yml` for cross-compilation and release.

---

## 11. Open Questions for Integration

These should be resolved when integrating the three plans:

1. **Shared action type definitions**: How should the Go server and TypeScript client stay in sync on action types and payloads? Options: (a) a JSON Schema file in `shared/protocol.json` that both reference, (b) a TypeScript type file generated from Go types via a build step, (c) manual maintenance with integration tests. Recommendation: option (a) for the prototype, it is the simplest.

2. **Card instance creation**: When a player loads a deck (from the card database, Plan 3), who creates the card instances with UUIDs -- the client or the server? Recommendation: the client sends a `LOAD_DECK` action with card metadata, and the server generates the instance UUIDs. This keeps the server as the sole ID authority.

3. **Port configuration for production**: When a user downloads the Go binary and runs it, what port should it default to? And how does the client app (hosted on GitHub Pages) know where the server is? This is the "connect to server" flow from Plan 1 -- the text input + "Join Server" button. The user would enter `localhost:8080` or an IP address.

4. **FabricJS integration boundary**: The server knows nothing about FabricJS. The client translates between `GameState` (from the server) and FabricJS canvas objects. The card's `x`, `y`, `rotation` fields in the server state are abstract coordinates. The client maps these to FabricJS object properties (`left`, `top`, `angle`). This mapping lives entirely in the client code.

---

### Critical Files for Implementation

- `server/reducer.go` -- Core game logic: the reducer function that handles all action types and computes undo actions. This is the heart of the server.
- `server/state.go` -- Type definitions for GameState, Card, Player, and all action/message types. The contract between server and client.
- `server/room.go` -- Room management: client tracking, broadcasting, action log, mutex-guarded state access.
- `server/main.go` -- Entry point: HTTP server, WebSocket upgrade handler, flag parsing, wiring everything together.
- `.github/workflows/server-release.yml` -- GitHub Actions workflow for cross-compiling Go binaries and publishing them as GitHub Releases.

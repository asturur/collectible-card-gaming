# Plan 4: Table View — Deck Placement and Player Seating

## Overview

Once a player confirms their deck, they dispatch a `DECK_PLACED` action to the server. This places their deck face-down on the table (a fabricJS canvas). The table is a fixed 2000x2000px square canvas. Each player has a seat (N/S/E/W) and sees their own cards in front of them, with other players' cards rotated according to their seating position.

## Seating Model

The table supports up to 4 seats:
- **1st player** → North (top of the canvas from their own perspective)
- **2nd player** → South
- **3rd player** → East
- **4th player** → West

Each player sees the canvas rotated so that their own seat is at the bottom of their screen. This means:
- The North player sees the canvas as-is (0° rotation)
- The South player sees the canvas rotated 180°
- The East player sees the canvas rotated 90° counterclockwise
- The West player sees the canvas rotated 90° clockwise

The server assigns seats in join order. The seat determines the viewport rotation applied to the entire canvas on each client.

## Deck Placement

When a player confirms their deck and dispatches `DECK_PLACED`:
- The server receives the full deck data (card list with Scryfall IDs and counts)
- The server creates card instances for every card in the deck (each with a unique instanceId)
- All cards are placed in the player's `deck` zone, face-down
- The server assigns the deck a position on the canvas based on the player's seat:
  - North seat deck position: near the left edge of the top area (where the player's left hand would be)
  - South seat deck position: near the left edge of the bottom area
  - East/West accordingly
- The server broadcasts the state update to all clients
- Each client renders the deck as a stack of face-down cards (showing the classic MTG card back)

## The Canvas

- fabricJS canvas, fixed 2000x2000 pixels
- Responsiveness is NOT in scope for this plan — handled later
- The canvas is the "table" where all cards live
- Each client applies a viewport rotation based on their seat assignment so they always see their own cards at the bottom

## What to implement

### Server side
1. New action type: `DECK_PLACED` with payload containing the full deck card list
2. Server reducer handles `DECK_PLACED`:
   - Creates card instances (with instanceIds) for every card in the deck
   - Places all cards in the player's `deck` zone, face-down
   - Sets the deck stack position based on the player's seat
3. Seat assignment logic: server assigns seats (N/S/E/W) to players as they join
4. Add seat info to `Player` struct and to `WELCOME`/`STATE_SYNC` messages

### Client side
1. After confirming deck, dispatch `DECK_PLACED` action via WebSocket
2. Replace the placeholder GameView with a fabricJS canvas (2000x2000)
3. Render the game state on the canvas:
   - Face-down deck stacks at each player's assigned position
   - Apply viewport rotation based on own seat
4. Listen for state updates and re-render the canvas accordingly

### Card back image
- Use the standard MTG card back image (a well-known public image)
- Embed or reference it for face-down card rendering

## Out of scope (for later)
- Card interactions (draw, move, flip, rotate)
- Responsive canvas scaling
- Hand zone rendering
- Card detail view on hover/click

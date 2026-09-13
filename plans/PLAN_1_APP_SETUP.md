# Plan 1: Frontend App, Dev Environment, Deploy Pipeline, and Test Suite

## 1. TypeScript Decision

**Use TypeScript throughout.** Rationale:

- Fabric.js 7 ships with built-in TypeScript types (no `@types/fabric` needed). The shared state objects (card positions, game actions, WebSocket messages) crossing between client and server will benefit enormously from shared type definitions.
- Base UI, React 19, Tailwind, and Vite all have first-class TypeScript support.
- The monorepo can house a `shared/` package of TypeScript interfaces that both client and server import, ensuring the WebSocket protocol contract is type-checked at compile time. This is especially important given Plan 2's "action + payload + counter-action" design for the reducer-style state machine.

## 2. Monorepo Layout

Use **npm workspaces** (npm 11 supports them natively; no extra tooling needed). The root `package.json` declares workspaces; each workspace is a self-contained package with its own `package.json`, `tsconfig.json`, and scripts.

```
collectible-card-gaming/
  .github/
    workflows/
      deploy.yml              # GitHub Pages deploy on push to main
  client/                      # Vite + React app (workspace)
    public/
      favicon.svg
    src/
      components/              # UI components (React + Base UI + Tailwind)
        JoinScreen.tsx         # Server address input + Join button
        Layout.tsx             # App shell / chrome
      canvas/                  # fabricJS rendering layer
        GameCanvas.tsx         # React wrapper around fabric.Canvas
        cardObjects.ts         # fabric object factories for cards
      network/                 # WebSocket abstraction
        socket.ts              # WebSocket client (connect, send, receive)
        useSocket.ts           # React hook wrapping socket lifecycle
      state/                   # Game state management
        gameStore.ts           # Zustand or reducer-based store
        actions.ts             # Action creators matching server protocol
        types.ts               # Re-exports from shared/ for convenience
      App.tsx
      main.tsx
      index.css                # Tailwind entry: @import "tailwindcss"
    index.html
    package.json
    tsconfig.json
    tsconfig.app.json
    tsconfig.node.json
    vite.config.ts
  server/                      # Server app (workspace, Plan 2 scope)
    package.json               # Placeholder; Plan 2 populates this
    tsconfig.json
  shared/                      # Shared types (workspace)
    src/
      actions.ts               # Action/payload type definitions
      state.ts                 # Game state shape
      protocol.ts              # WebSocket message envelope types
    package.json
    tsconfig.json
  plans/
    END_GOAL.md
  package.json                 # Root: workspaces config + root scripts
  tsconfig.base.json           # Shared TS compiler options
  README.md
  LICENSE
  .gitignore
```

### Key structural decisions

- **`shared/`** exists from day one, even though the server is Plan 2's scope. Having the shared types package in place now means the client can import `@zaff/shared` for its WebSocket message types immediately, and the server will import the same package later. This eliminates protocol drift between client and server.
- **`canvas/`** is separate from `components/` because fabricJS operates on an imperative Canvas API and should not be mixed with React's declarative rendering. `GameCanvas.tsx` will mount a `<canvas>` element and manage the `fabric.Canvas` instance via a `useRef` + `useEffect` pattern, keeping fabricJS lifecycle outside React's reconciliation.
- **`network/`** is isolated so the WebSocket connection logic can be tested independently and swapped with a mock during tests.
- **`state/`** holds the client-side state store. The END_GOAL describes a "redux-like" action/reducer pattern on the server. The client store should mirror this: incoming WebSocket messages are dispatched as actions into a local reducer, so the client state is always a deterministic function of the action stream. Zustand with its middleware support is a good lightweight choice, but a plain `useReducer` works too for the initial version.

## 3. Root `package.json`

```jsonc
{
  "name": "zaff",
  "private": true,
  "workspaces": ["client", "server", "shared"],
  "scripts": {
    "dev": "npm run dev --workspace=client",
    "dev:all": "npm run dev --workspace=client & npm run dev --workspace=server",
    "build": "npm run build --workspace=shared && npm run build --workspace=client",
    "test": "npm run test --workspace=client",
    "lint": "npm run lint --workspace=client"
  },
  "engines": {
    "node": ">=20.19.0"
  }
}
```

The `build` script runs `shared` first (since client depends on it), then `client`. The `dev:all` script will be completed in Plan 2 when the server exists.

## 4. Vite Configuration

File: `client/vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: '/collectible-card-gaming/',  // GitHub Pages project path
  server: {
    port: 5173,
    proxy: {
      // Proxy WebSocket connections to local server during development
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  resolve: {
    // Ensure workspace package @zaff/shared resolves correctly
    conditions: ['import', 'module'],
  },
});
```

Important details:
- **`base`** is set to the repo name for GitHub Pages. The deployed site will live at `https://asturur.github.io/collectible-card-gaming/`.
- **`server.proxy`** forwards `/ws` to the local server during development so the client does not need to know the server address at dev time. This proxy is transparent -- in production the user types the real server address.
- The Tailwind Vite plugin replaces the old PostCSS-based setup. No `tailwind.config.js` needed in v4.

## 5. Tailwind CSS + Base UI Setup

### Tailwind v4 entry point

File: `client/src/index.css`

```css
@import "tailwindcss";

@theme {
  /* ZAFF brand colors -- can be refined later */
  --color-zaff-bg: #0f172a;
  --color-zaff-surface: #1e293b;
  --color-zaff-primary: #6366f1;
  --color-zaff-primary-hover: #818cf8;
  --color-zaff-text: #f8fafc;
  --color-zaff-muted: #94a3b8;
  --color-zaff-border: #334155;

  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
}
```

Tailwind v4 uses `@theme` for customization instead of `tailwind.config.js`. These CSS custom properties become available as Tailwind utilities (e.g., `bg-zaff-bg`, `text-zaff-primary`).

### Base UI integration

Base UI components are unstyled and accept `className` for Tailwind classes. The pattern is to create thin wrapper components that apply ZAFF's design tokens.

Example wrapper for the Input component (to be placed in `client/src/components/JoinScreen.tsx`):

```tsx
import { Input } from '@base-ui/react/input';

<Input.Root
  className="w-full rounded-lg border border-zaff-border bg-zaff-surface px-4 py-3
             text-zaff-text placeholder:text-zaff-muted
             focus:outline-none focus:ring-2 focus:ring-zaff-primary"
  placeholder="Enter server address"
/>
```

Base UI's data attributes (`data-focused`, `data-invalid`, etc.) can be targeted with Tailwind's arbitrary variant syntax for state-based styling: `data-[focused]:ring-2`.

## 6. Initial Landing Page Component

File: `client/src/components/JoinScreen.tsx`

This is a single full-screen component with:
- A centered card/panel on a dark background
- The ZAFF logo or title text
- A text input field for the WebSocket server address (e.g., `ws://192.168.1.5:8080`)
- A "Join Server" button
- Basic client-side validation: the input must not be empty; optionally validate that it looks like a URL
- On submit, the address is stored in the app state and the app transitions to the game view (which will be built later; for now it can show a placeholder "Connected to {address}" screen)

Component structure:

```
JoinScreen
  +-- <form> (prevents default, calls onJoin)
       +-- <h1> "ZAFF"
       +-- <p>  subtitle text
       +-- Input.Root (Base UI, styled with Tailwind)
       +-- Button (Base UI, styled with Tailwind)
```

The `onJoin(address: string)` callback is passed down from `App.tsx`. For now, `App.tsx` holds a simple state: `serverAddress: string | null`. When null, render `JoinScreen`; when set, render a placeholder `GameView` component. This keeps the join-flow logic at the app level where the WebSocket connection will later be established.

## 7. GitHub Actions Workflow for Auto-Deploy

File: `.github/workflows/deploy.yml`

The workflow is adapted from the official Vite documentation, modified for the monorepo structure (the build output is in `client/dist`, not `./dist`).

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: ['main']
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v7

      - name: Set up Node
        uses: actions/setup-node@v7
        with:
          node-version: 'lts/*'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build shared types
        run: npm run build --workspace=shared

      - name: Build client
        run: npm run build --workspace=client

      - name: Setup Pages
        uses: actions/configure-pages@v6

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v5
        with:
          path: './client/dist'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
```

Key points:
- `npm ci` at the root installs all workspace dependencies in one go.
- The `shared` workspace is built first since `client` depends on it.
- The artifact path is `./client/dist`, not the root `./dist`.
- The repo's GitHub Settings must have Pages source set to "GitHub Actions" (not "Deploy from a branch").

## 8. Test Suite Setup

### Framework: Vitest + React Testing Library

Vitest is the natural choice -- it shares Vite's configuration, runs in the same transform pipeline, and requires near-zero setup. Version 4.1.x is the latest stable that pairs with Vite 8.

Dependencies:
- `vitest` -- test runner
- `@testing-library/react` -- component testing
- `@testing-library/jest-dom` -- DOM assertion matchers (`.toBeInTheDocument()`, etc.)
- `@testing-library/user-event` -- realistic user interaction simulation
- `jsdom` -- browser environment for component tests

File: `client/vite.config.ts` (test section added)

```ts
export default defineConfig({
  // ... existing config ...
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
```

File: `client/src/test/setup.ts`

```ts
import '@testing-library/jest-dom/vitest';
```

### Initial tests to write

1. **`JoinScreen.test.tsx`** -- The landing page component:
   - Renders the input and button
   - Button is disabled (or form does not submit) when input is empty
   - Calls `onJoin` with the entered address on form submit
   - Shows validation feedback for invalid input

2. **`App.test.tsx`** -- App routing logic:
   - Initially renders JoinScreen
   - After joining, renders the game placeholder view

3. **`socket.test.ts`** -- WebSocket abstraction (unit test with mocked WebSocket):
   - Connects to the given address
   - Emits events on message receipt
   - Handles connection errors gracefully
   - Reconnects on disconnect (if implemented)

4. **`shared/actions.test.ts`** -- Shared type/utility tests:
   - Action creator functions produce correct shapes
   - Type guards for message discrimination work correctly

### Test scripts

In `client/package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

## 9. Development Workflow

### Running client only (Plan 1 scope)

```bash
npm run dev           # starts Vite dev server on port 5173
```

### Running client + server (once Plan 2 is done)

```bash
npm run dev:all       # starts both client and server concurrently
```

For a more robust concurrent setup, add `concurrently` as a root dev dependency:

```json
"dev:all": "concurrently \"npm run dev -w client\" \"npm run dev -w server\""
```

### Local development flow

1. `npm install` at root -- installs all workspaces.
2. `npm run dev` -- starts the client. The JoinScreen appears.
3. During development without a real server, the `network/socket.ts` module should export a `createMockSocket()` that simulates server messages. This lets the UI be developed and tested independently of the server.
4. Once the server exists (Plan 2), run `npm run dev:all`. The Vite proxy forwards `/ws` to the local server. Alternatively, type the local server address directly into the JoinScreen input.

### IDE setup

Add a root `tsconfig.base.json` with shared compiler options, and each workspace extends it:

```jsonc
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

## 10. Key Dependencies List

### Root (dev only)
| Package | Version | Purpose |
|---------|---------|---------|
| `concurrently` | `^9.x` | Run client + server dev commands in parallel |
| `typescript` | `^5.8` | Shared TypeScript compiler |

### `client/` workspace
| Package | Version | Purpose |
|---------|---------|---------|
| `react` | `^19.3.0` | UI library |
| `react-dom` | `^19.3.0` | React DOM renderer |
| `fabric` | `^7.4.0` | Canvas-based card rendering (built-in TS types) |
| `@base-ui/react` | `^1.8.0` | Headless UI components |
| `vite` | `^8.3.0` | Build tool and dev server |
| `@vitejs/plugin-react` | `^4.x` (latest for Vite 8) | React Fast Refresh + JSX transform |
| `tailwindcss` | `^4.3.3` | Utility-first CSS |
| `@tailwindcss/vite` | `^4.3.3` | Tailwind Vite plugin (replaces PostCSS) |
| `typescript` | `^5.8` | Type checking |
| `vitest` | `^4.1.0` | Test runner (matches Vite 8) |
| `@testing-library/react` | `^16.x` | Component test utilities |
| `@testing-library/jest-dom` | `^6.x` | DOM assertion matchers |
| `@testing-library/user-event` | `^14.x` | User interaction simulation |
| `jsdom` | `^26.x` | Browser environment for tests |

### `shared/` workspace
| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | `^5.8` | Type checking (no runtime deps) |

The `shared` package has zero runtime dependencies -- it exports only TypeScript types and pure utility functions. It is compiled to JS + `.d.ts` so both the client (via Vite) and the server (via Node/Go FFI/whatever Plan 2 decides) can consume it.

## 11. Preparing for WebSocket Integration

Even though the server is Plan 2's scope, the client should be structured from day one to make WebSocket integration clean.

### `client/src/network/socket.ts`

Define a `GameSocket` interface:

```ts
export interface GameSocket {
  connect(address: string): void;
  disconnect(): void;
  send(action: GameAction): void;
  onMessage(handler: (action: GameAction) => void): void;
  onStatusChange(handler: (status: ConnectionStatus) => void): void;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
```

Provide two implementations:
- `WebSocketGameSocket` -- real implementation using the browser WebSocket API
- `MockGameSocket` -- for development and testing, emits canned responses

### `client/src/network/useSocket.ts`

A React hook that:
- Takes the server address from app state
- Creates and manages the `GameSocket` lifecycle
- Dispatches incoming actions into the game state store
- Exposes `send()` and `connectionStatus` to components

### `client/src/state/gameStore.ts`

A state store (Zustand recommended for its simplicity and middleware support) with:
- `connectionStatus` -- tracks WebSocket state
- `serverAddress` -- the joined server
- `gameState` -- the shared game state (cards, positions, zones)
- `dispatch(action)` -- applies an action locally and sends it over the socket
- A reducer function that matches the server's reducer logic (from `@zaff/shared`)

This "optimistic update + server echo" pattern means the UI responds instantly to user actions while staying synchronized with other clients.

## 12. Sequencing / Implementation Order

1. **Initialize root `package.json`** with workspaces configuration and `.gitignore`.
2. **Create `shared/` package** with stub `package.json` and initial type definitions for `GameAction`, `GameState`, and `ConnectionStatus`.
3. **Scaffold `client/`** using `npm create vite@latest client -- --template react-ts` (then adjust to fit the monorepo).
4. **Configure Tailwind** -- install `tailwindcss` + `@tailwindcss/vite`, add `@import "tailwindcss"` to `index.css`, define `@theme` tokens.
5. **Install Base UI** -- `npm install @base-ui/react --workspace=client`.
6. **Build `JoinScreen`** component with Base UI Input and Button, styled with Tailwind.
7. **Wire up `App.tsx`** with the join flow (JoinScreen to placeholder GameView).
8. **Set up Vitest** -- install test deps, create `setup.ts`, write initial `JoinScreen.test.tsx`.
9. **Create `.github/workflows/deploy.yml`** -- the GitHub Actions deploy workflow.
10. **Configure GitHub repo** -- set Pages source to "GitHub Actions" in repo settings.
11. **Push to main** and verify the site deploys to `https://asturur.github.io/collectible-card-gaming/`.

## 13. Potential Challenges

- **`base` path in Vite**: Assets and routes must account for the `/collectible-card-gaming/` prefix on GitHub Pages. Use Vite's `import.meta.env.BASE_URL` for any dynamic asset references. If the app later uses client-side routing, a `HashRouter` avoids 404s on page refresh.
- **fabricJS in jsdom**: fabricJS depends on Canvas APIs that jsdom does not fully implement. Canvas-related tests will need either `jest-canvas-mock` / a canvas polyfill, or should be separated into integration tests that run in a real browser (Vitest's browser mode or Playwright).
- **Workspace dependency resolution**: Ensure `@zaff/shared` is referenced in `client/package.json` as `"@zaff/shared": "*"` (or `"workspace:*"` if using pnpm later). npm workspaces resolve this via symlinks.
- **Tailwind v4 is CSS-only config**: If the team is used to `tailwind.config.js`, the shift to `@theme` in CSS requires adjustment. The migration is straightforward but worth noting.

---

### Critical Files for Implementation
- `package.json` (root workspaces config -- does not exist yet, must be created)
- `client/vite.config.ts` (Vite + Tailwind plugin + proxy + base path)
- `client/src/components/JoinScreen.tsx` (the initial landing page)
- `.github/workflows/deploy.yml` (GitHub Pages auto-deploy)
- `shared/src/protocol.ts` (WebSocket message types shared between client and server)

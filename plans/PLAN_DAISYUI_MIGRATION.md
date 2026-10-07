# daisyUI migration assessment

Assessed on 2026-10-07. The first pass below is implemented; the broader migration
remains a proposal. Registro routing is also implemented, as described below.
The UI rules in `../AGENTS.md` are the source of truth for everyday edits.

## First pass implemented

Following the chosen scope, daisyUI 5.7.47 is installed as a client dev dependency
and unused Base UI is removed. Only button, input, select, textarea, fieldset,
and label styles are enabled, through the existing Tailwind Vite setup.

`ui/Button.tsx`, `ui/Field.tsx`, and the button composition in `ui/FilterTabs.tsx`
now use daisyUI. Existing prop contracts are preserved, with an added `text`
button variant. Registro's recovery action and ZAFF's disconnect action also
use the common button. Field hints/errors are associated with their controls.

The shared theme retains existing brand/domain colors through compatibility
aliases. Solid primary buttons use the existing light indigo with dark text for
contrast. Existing charts, histograms, deck/card views, custom life controls,
panels, navigation, and overlays keep their implementations. Existing kit
buttons/fields inside them receive the shared styles without a view rewrite.

`package-lock.json` is updated. The existing pnpm lock describes only root
tooling and has no client importer; it is left alone. Client installs and CI
continue to use npm. Further widget/overlay conversion is outside this pass.

Verification: the production build succeeds and all 50 tests in 11 files pass,
including shared field description/error coverage and existing deck interactions.
Browser checks at 390px and 1280px covered Registro login/recovery presentation,
ZAFF join validation, keyboard focus, and long button labels. Full-width buttons
can grow when labels wrap; existing custom button heights remain available.

## Follow-up implemented: sections are routes

React Router 7 replaces the two-path manual router. Registro's games, decks,
statistics, player roster, account menu, game details, and editors are pages
with explicit URLs. `ui/SectionPage.tsx` preserves the 560/680/900px content
limits, phone padding, and bottom navigation while using normal document scroll.
Sections no longer mount the shared `Modal` or lock background scrolling.

Persisted game/deck IDs are in editor URLs, so a refresh reopens the saved
record. Authentication retains the requested page. Shared game links now use
`/games/:gameId`; earlier `?partita=ID` links remain supported. Imported deck
input uses router history state. Unsaved form changes are not persisted across
refresh. The shared leave guard handles game-form navigation/Back/refresh and
blocks leaving during active writes; successful game saves return to the list.

True task dialogs, custom charts/card/deck rendering, and the life counter keep
their implementations. ZAFF still lives at `/zaff` with its existing internal
join/deck/game flow; restoring a live connection on refresh is separate work.
The existing generated `404.html` serves deep URLs on GitHub Pages.

Routing verification: the production build and all 80 tests in 12 files pass.
Coverage includes direct section URLs, fresh editor mounts, missing/forbidden
records, old shared links, login retention, browser history, save guards, and
preserving the opened game snapshot through realtime changes/deletion. Phone
(390px) and desktop (1280px) browser checks used local sample data for statistics,
game details/forms, saved deck refresh, and picker close/scroll cleanup. The
production build was also checked for deep-link login and Registro/ZAFF navigation.
No live database writes were used for these checks.

## Follow-up implemented: breadcrumbs and saved-deck pages

`ui/Breadcrumbs.tsx` replaces the single back link in `SectionPage` with daisyUI
breadcrumbs. Ancestors are real router links; the current page is nonlinked and
marked with `aria-current="page"`. Trails wrap and long names truncate on phones.

`/decks/:deckId` loads through `getSavedDeck`, subscribes to saved-deck changes,
and reuses `DeckViewContents` and the existing card/charts presentation. The saved
deck list and deck statistics link to this page, removing both deck-view modals.
Creation and successful edits open the saved detail; cancelling an edit returns
there. Ownership, confirmed deletion, write guards, and missing/error states remain.
Historical statistics rows without a saved deck show why their list is unavailable;
their exported chart remains static.

Verification: production build and all 93 tests in 13 files pass. Phone and desktop
checks covered breadcrumbs, long labels, deck refresh, list/stat links, editor
navigation, Back/Forward, chart close/scroll cleanup, and absence of page overflow.
Browser checks used local sample data; no live database writes were performed.

## Follow-up implemented: saved-deck statistics route

`/decks/:deckId/stats` replaces the saved-deck statistics modal. The detail page
links to it through the shared button-link component, and breadcrumbs return to
the named deck. Both read-only pages use `mtglog/useSavedDeck.ts` for the existing
service read/subscription lifecycle, including missing records and stale requests.
The page reuses `DeckStatsContents`, preserving card identities, main/side behavior,
charts, mana toggle, and token previews. The editor's preview remains local because
it analyzes unsaved draft cards.

Verification: production build and all 98 tests pass. Phone/desktop checks with
local sample data covered page layout, refresh, breadcrumb/history navigation,
the mana toggle, and no page overflow or deck-statistics dialog. Tests also cover
login retention, missing decks, deployment-base links, and stale responses while
switching deck IDs. No live database writes were performed.

## Follow-up implemented: player and matchup detail pages

`/stats/players/:playerName` and `/stats/matchups/A/vs/B` replace the remaining
statistics drill-down modals. Multiplayer formations append more `/vs/name`
segments. Every name is URI-encoded separately and decoded once; the matchup
lookup uses an order-independent JSON key so names containing delimiters remain
distinct. Matchups continue to aggregate only games with exactly that formation.

Both pages reuse Registro's shared game query/subscription, the existing charts,
and static image export presentations. Player-specific deck results retain their
original scope. Shared breadcrumbs lead back to each statistics list, while
loading, failed reads, missing players/formations, and invalid URLs are handled.

Verification: the production build and all 120 tests in 14 files passed after
the follow-up fixes. Phone/desktop checks with local sample data covered player
and exact multiplayer matchup pages, long names, refresh, Back, shared breadcrumb
navigation, and absence of statistics dialogs or horizontal page overflow.

## Follow-up implemented: compact, whole-word breadcrumbs

The shared page shell reduces top spacing, and the shared breadcrumb component
reduces its vertical padding and gap above the page panel. Trails fit a single
row using actual text measurements: Home remains intact, the earliest ancestor
loses whole words first, then later ancestors, and the current page last. A label
with no remaining words becomes `…`. Links retain their destinations, full
accessible names, and title hints; labels restore as the available width grows.
Resize and font-loading changes repeat the measurement through the shared kit.

Verification: production build and all 126 tests in 15 files pass. The focused
coverage checks priority, word boundaries, single-word labels, accessible names,
link destinations, and restoration on resize. Browser checks at 320px, 390px,
540px, and 1280px confirmed one-row fitting, compact spacing, full Home labels,
progressive restoration, and navigation through collapsed links using local
sample data. No shared database writes were performed.

## Follow-up implemented: close controls and badges

`ui/CloseButton.tsx` composes the shared Button with daisyUI's square modifier:
ghost styling on panels and a solid neutral background over card/token artwork.
The common modal, card picker, card viewer, and token viewer all reuse its icon,
accessible label, and title. The life-counter options' text close action also
uses Button. Existing overlay state, close callbacks, Escape, and scroll handling
remain in their existing components.

`ui/Badge.tsx` now uses daisyUI badge styles and sizes, enabled in the CSS plugin
allowlist. Deck-source labels map to success/info outlines; card quantities use
neutral or primary badges. JPG export labels share one badge helper instead of
duplicated custom SVGs. Registro and ZAFF both reuse these implementations.

Verification: production build and all 126 existing tests in 15 files pass.
Phone and desktop checks with local sample data covered shared and nested task
dialogs, token/card-picker close controls, source/JPG/quantity badge contrast,
ZAFF deck quantities, backdrop and Escape closing, and restored scrolling.
No database reads or writes were needed for these browser fixtures.

## Recommendation and expected result

Adopt daisyUI 5 through the existing shared React kit. For a two-person team with
limited web experience, this should reduce the number of styling decisions and
custom control implementations the team maintains. This is an engineering
judgment based on the repository and the library's documented approach.

daisyUI provides CSS component classes on normal HTML, rather than React
interaction primitives. Installation uses a Tailwind CSS plugin, compatible
with this project's Tailwind 4 setup. Base UI supplies unstyled React primitives
with keyboard and focus behavior. Those are different benefits:
[daisyUI installation](https://daisyui.com/docs/install/),
[daisyUI usage](https://daisyui.com/docs/use/),
[Base UI accessibility](https://base-ui.com/react/overview/accessibility).

The destination is:

```text
Registro screens                 ZAFF screens
          \                       /
           Shared React components/ui/
             |                 |
       daisyUI styles     Native HTML + React behavior
             \                 /
                One app theme

Feature logic -> existing services/hooks -> existing APIs
```

Contributors continue writing `<Button>`, `<TextField>`, and shared panels. They
learn the app's small prop vocabulary while the kit owns daisyUI classes,
accessibility, and visual defaults. Tailwind remains useful for layout. Domain
rendering such as the Fabric game table and mana icons remains custom.

Adopting standard daisyUI sizes and appearances matters: recreating every
current bespoke control with overrides would retain much of today's workload.
Keep the dark brand palette, fonts, imagery, and meaningful domain colors, while
allowing ordinary controls to take daisyUI's shapes and spacing.

## Baseline before the first pass

- `client/package.json` declares `@base-ui/react: ^1.8.0`, React 19, Tailwind 4,
  and `@tailwindcss/vite`. daisyUI is absent.
- There are **zero Base UI imports in application source**. The Base UI input
  in `PLAN_1_APP_SETUP.md` is historical example code. Removing the dependency
  therefore requires no application component API conversion today.
- `components/ui/` contains **eight React component modules plus `styles.ts`**.
  **21 reachable component modules outside the kit import it**. Both routes
  already have a useful common boundary for migration.
- Outside the kit there are **51 native button JSX sites, 16 input sites, and
  one textarea site**. These are source counts in modules reachable from
  `main.tsx`, excluding tests, not rendered counts or a count of defects. Some
  are intentional domain interactions, file inputs, or card-image targets.
- There are **21 shared `Modal` JSX sites**, plus bespoke full-screen pickers,
  viewers, and life-counter overlays. This is the main behavioral work.
- There is already API reuse across routes: `savedDecks.ts` and
  `playableDeck.ts` support Registro decks entering ZAFF. However, Registro's
  game/player queries and auth remain partly inside components; the precon
  importer in `DeckEditor.tsx` also fetches a separate catalog directly.

So this is mostly a **custom Tailwind UI to daisyUI migration**, with removal of
an unused Base UI dependency. It is not a conversion of an established Base UI
component tree.

## Component mapping and effort

Effort labels are relative; they include preserving behavior, not just classes.

| Existing area | daisyUI destination | Effort / consideration |
|---------------|---------------------|------------------------|
| `ui/Button.tsx` | `btn`, semantic colors, sizes, outline/soft styles | Low. Preserve button/link semantics and default `type="button"`. Current `ghost` is outlined; current `link` is a bordered secondary action. Map intent, not prop spelling. |
| `ui/Field.tsx` | `fieldset`, `input`, `select`, `textarea`, labels and feedback | Low–medium. Keep comfortable/compact usage, controlled values, labels, and browser autocomplete; connect hints/errors accessibly. |
| `ui/Badge.tsx` | `badge` with shared tone mapping (implemented) | Deck sources, JPG labels, and quantities in both routes now use the shared daisyUI styles. |
| `ui/CloseButton.tsx` | Shared square daisyUI button (implemented) | Panel and image contrast variants share one close icon/label; overlay lifecycle is unchanged. |
| `ui/FilterTabs.tsx` | Shared daisyUI buttons, optionally `join` | Low. They are filters with `aria-pressed`, not tab panels; do not add tab roles for appearance. |
| `ui/NumberStepper.tsx` | `join` + `btn` + numeric `input` | Low–medium. Keep string/empty values, step/min behavior, and large touch targets. There is no reason to change its value contract. |
| `ui/Panel.tsx`, `ui/Tile.tsx` | Shared `card` surfaces and action compositions | Medium. Retain login artwork and responsive geometry; isolate decorative SVGs from ordinary control styling. |
| `ui/SectionPage.tsx` / `ui/Modal.tsx` | Routed pages (implemented) and true task dialogs | Pages are separated. Remaining native-dialog work affects focus and overlay layering. |
| `mtglog/BottomNav.tsx` | Shared navigation primitive using `dock` styling | Medium. Preserve active section, central new-game action, safe areas, and route links. Routing is implemented; optional daisyUI dock styling is later work. |
| Winner switch in `GameForm.tsx` | Shared checkbox/toggle primitive | Low. Preserve real checkbox behavior and visible keyboard focus. Remove custom switch CSS only after conversion. |
| Remaining controls/status blocks | Shared icon buttons, fields, alerts, loading/empty states | Medium. Most work is in Registro; ZAFF's `GameView` disconnect/status bar also needs conversion. |
| Cards, mana, charts, life-counter play areas, Fabric canvas | Existing reusable domain rendering + kit controls | Selective cleanup. daisyUI does not provide these domain interactions. |

The class families and native dialog approach are documented in
[daisyUI buttons](https://daisyui.com/components/button/) and
[daisyUI modals](https://daisyui.com/components/modal/). The latter recommends
`<dialog>` opened with `showModal()` for blocking dialogs.

## Remaining dialog work

Registro's former section overlays are now React Router pages, using one shared
`SectionPage` presentation. Game details and deck editors are pages as well.
`BottomNav` remains available on all authenticated sections. Short tasks such
as choosing a player/format/card and existing custom deck views remain overlays.

Only true blocking tasks should migrate to native `<dialog>`/`showModal()`.
Native dialogs make the background inert and render in the browser's top layer,
which suits local tasks but would block page navigation if used for sections.

Likewise, `CardPicker.tsx` and the `CardViewer` in `DeckCards.tsx` currently use
fixed overlays at z-index 50/60. If their editor parent becomes a native dialog,
those overlays must render inside that dialog or open as another managed native
dialog; their current z-index alone will not put them above it. The full-screen
life counter opened from the game form needs the same review.

The current shared modal handles Escape and body scroll manually but does not
implement focus containment/return or wire its title as an accessible dialog
name. This is a pre-existing gap. Migration should establish one accessible
behavior in the shared wrapper, including cancel/close synchronization with
React, save-in-progress close guards, and cleanup when dialogs unmount.

## Theme strategy

Define one custom dark application theme in `client/src/index.css` using
`@plugin "daisyui/theme"`. daisyUI supports custom semantic colors and common
radius/size variables: [theme documentation](https://daisyui.com/docs/themes/).

Map current backgrounds/surfaces to the appropriate `base-*` roles, indigo to
`primary`, cyan to `accent`, and the existing gold/pink to intentional secondary
or domain roles. Specify readable content colors and status colors. Keep Inter
and Cinzel in the existing typography helpers.

During the transition, make remaining `zaff-*` colors aliases of that theme
where their meaning matches, so both kinds of caller share one palette. Remove
unneeded aliases after their consumers migrate. Do not independently maintain
two palettes or give Registro and ZAFF separate themes.

Preserve iOS safe-area and date/time fixes, artwork backgrounds, card ratios,
and meaningful chart/mana/seat palettes. Their geometry or semantic colors
should not be removed merely because they are custom CSS or rendering.

## Implementation sequence

Use small changes that each leave both routes usable. A planning estimate is
**3–6 experienced developer-days**, including verification, for standard control
conversion and overlay work. This is not measured delivery time; learning the
stack, visual revision, or adding browser test infrastructure can extend it.
The overlay work has the most uncertainty.

1. **Foundation and shared simple primitives (0.5–1 day).** Install daisyUI 5
   in the client workspace as a dev dependency, configure one theme through
   the existing Tailwind Vite pipeline, and remove unused Base UI. Update the
   npm lockfile used by CI; account for the tracked pnpm lockfile explicitly
   rather than leaving it misleading. Migrate buttons, fields, badges, and
   filters centrally. Keep current public props where their meaning remains
   clear. Verify Registro auth and ZAFF join/deck selection together.
2. **Remaining ordinary controls (1–2 days).** Add small shared primitives
   only where needed: icon buttons, toggle/checkbox, reusable status feedback,
   and navigation presentation. Convert touched raw controls and page-level
   appearance overrides in both routes, including the game header. Prefer
   native controls to new custom dropdown behavior. Keep card/domain views
   intact and use adapters if sharing their presentation across routes.
3. **Task dialogs (1–2 days).** Navigable sections already use routes. Migrate
   true dialogs through the shared kit, and handle card picker/viewer and
   life-counter layering. Verify nested close order,
   focus return, draft/save guards, mobile scroll, and bottom navigation.
4. **Cleanup and integration verification (0.5–1 day).** Remove obsolete custom
   control CSS/constants after their callers are gone. Review both routes and
   exported game/stat images. Record remaining domain exceptions, complete
   relevant interaction checks, and update `AGENTS.md` to describe daisyUI as
   installed. Avoid a lingering second general-purpose control system.

The experienced contributor should own shared wrappers/theme and overlays.
Once those APIs are stable, the less experienced contributor can convert
callers in focused screens using those components and existing services. This
gives both people a common implementation vocabulary and review boundary.

No database schema, Go server, WebSocket protocol, deck persistence format, or
data-provider change is required for the library migration. Service extraction
for repeated Registro operations is useful follow-up work; keep it distinct
from styling so behavior changes are reviewable.

## Agent instructions, skills, and enforcement

Keep mandatory UI and reuse rules in root `AGENTS.md`, applying equally to both
routes. Codex reads those instructions before work; skills load their full
instructions when selected:
[AGENTS.md documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md),
[skills documentation](https://learn.chatgpt.com/docs/build-skills).

For the current scope, a second skill repeating those rules would create two
copies to maintain. A future repo-local UI skill is useful when it carries an
actual repeatable workflow, such as launching a component gallery and checking
mobile/desktop screenshots. It should reference the root rules and add that
procedure, rather than copy the component policy or install a generic skill
that can override project conventions.

Instruction and review rules are not mechanical enforcement. The root lint
command currently forwards to a missing client lint script, and deployment CI
builds the app but does not enforce UI reuse. If stricter enforcement becomes a
task, add focused checks for alternative UI-library imports and newly introduced
standard raw controls/appearance overrides, with explicit domain exceptions.
An AST-aware check can distinguish real JSX controls from comments and image or
canvas interactions; a blanket regex ban on `<button>` would be misleading.

## Migration acceptance checks

- Both routes use the same theme and shared standard controls; Base UI is
  removed and daisyUI is configured in the existing client build.
- Run `npm run build` and relevant existing client tests. Add behavior coverage
  for changed dialog/form logic; do not test CSS class spelling as behavior.
- Check Registro login/recovery, main navigation, new/edit game forms, deck
  editing/import/card selection, stats, and image exports on phone and desktop.
- Check ZAFF join, both deck sources, preview/confirmation, error feedback,
  room status/disconnect, and unchanged game canvas interactions.
- Check keyboard focus and labels, error associations, topmost Escape,
  backdrop/close behavior, save guards, nested card previews, restored scrolling,
  page navigation, refresh, and Back/Forward with the bottom navigation. Real-browser
  verification is needed for native dialog/top-layer behavior; jsdom alone
  cannot establish it.
- Preserve shared services, saved-deck revision checks, async subscriptions,
  and game payloads. Changes to these require their own stated reason and checks.

The baseline assessment used source/dependency/documentation inspection. The
first pass changes shared control styles and field error/hint associations;
data services and custom domain rendering remain unchanged.

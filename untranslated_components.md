# Untranslated components

Review in order. Entries include partially translated files and files that may have no translatable text; remove each only after review is complete. Paths are relative to the repository root.

- `client/src/components/mtglog/ImageExport.tsx`
- `client/src/components/mtglog/ManaIcon.tsx`
- `client/src/components/mtglog/MatchupStats.tsx`
- `client/src/components/mtglog/PlayersRoster.tsx`
- `client/src/components/mtglog/RegistroPages.tsx`
- `client/src/components/mtglog/Standings.tsx`
- `client/src/components/mtglog/TrendsStats.tsx`
- `client/src/components/mtglog/faqContent.tsx`
- `client/src/components/ui/Badge.tsx`
- `client/src/components/ui/Breadcrumbs.tsx`
- `client/src/components/ui/Button.tsx`
- `client/src/components/ui/ChipRow.tsx`
- `client/src/components/ui/CloseButton.tsx`
- `client/src/components/ui/Field.tsx`
- `client/src/components/ui/Modal.tsx`
- `client/src/components/ui/NavTabs.tsx`
- `client/src/components/ui/NumberStepper.tsx`
- `client/src/components/ui/Panel.tsx`
- `client/src/components/ui/SectionPage.tsx`
- `client/src/components/ui/SpeedDial.tsx`
- `client/src/components/ui/Tile.tsx`

## Logic and service files

Text shown to the user also lives outside components: labels, assembled sentences,
error messages and locale-specific formatting (`'it-IT'` dates, numbers, month names).

- `client/src/components/mtglog/cardGroups.ts`
- `client/src/components/mtglog/deckFilters.ts`
- `client/src/components/mtglog/deckMath.ts`
- `client/src/components/mtglog/deckValue.ts`
- `client/src/components/mtglog/stats.ts`
- `client/src/components/mtglog/trends.ts`
- `client/src/components/mtglog/useSavedDeck.ts`
- `client/src/services/account.ts`
- `client/src/services/deckCards.ts`
- `client/src/services/deckExport.ts`
- `client/src/services/mtgjson.ts`
- `client/src/services/playableDeck.ts`
- `client/src/services/savedDecks.ts`
- `client/src/services/scryfallLookup.ts`

## Static files (one language only)

- `client/index.html` and `client/public/manifest.webmanifest`: the app name is the brand
  "MTG Tracker" in every language; the manifest `description` and `lang` stay Italian until
  the app offers a language choice.

# Untranslated components

Review in order. Entries include partially translated files and files that may have no translatable text; remove each only after review is complete. Paths are relative to the repository root.

- `client/src/canvas/GameCanvas.tsx`
- `client/src/components/DeckPicker.tsx`
- `client/src/components/DeckPreview.tsx`
- `client/src/components/GameCanvas.tsx`
- `client/src/components/GameView.tsx`
- `client/src/components/JoinScreen.tsx`
- `client/src/components/MtgLog.tsx`
- `client/src/components/ZaffApp.tsx`
- `client/src/components/mtglog/AccountPanel.tsx`
- `client/src/components/mtglog/AuthScreen.tsx`
- `client/src/components/mtglog/BottomNav.tsx`
- `client/src/components/mtglog/CardPicker.tsx`
- `client/src/components/mtglog/CardPrices.tsx`
- `client/src/components/mtglog/CardStats.tsx`
- `client/src/components/mtglog/ColorFilter.tsx`
- `client/src/components/mtglog/DeckCards.tsx`
- `client/src/components/mtglog/DeckDetailActions.tsx`
- `client/src/components/mtglog/DeckEditor.tsx`
- `client/src/components/mtglog/DeckList.tsx`
- `client/src/components/mtglog/DeckStats.tsx`
- `client/src/components/mtglog/DeckView.tsx`
- `client/src/components/mtglog/Faq.tsx`
- `client/src/components/mtglog/GameForm.tsx`
- `client/src/components/mtglog/GameList.tsx`
- `client/src/components/mtglog/GameStats.tsx`
- `client/src/components/mtglog/HomeOverview.tsx`
- `client/src/components/mtglog/ImageExport.tsx`
- `client/src/components/mtglog/LifeCounter.tsx`
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

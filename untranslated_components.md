# Untranslated components

Review in order. Entries include partially translated files and files that may have no translatable text; remove each only after review is complete. Paths are relative to the repository root.

- `client/src/components/mtglog/faqContent.tsx`

## Logic and service files

Text shown to the user also lives outside components: labels, assembled sentences,
error messages and locale-specific formatting (`'it-IT'` dates, numbers, month names).


## Static files (one language only)

- `client/index.html` and `client/public/manifest.webmanifest`: the app name is the brand
  "MTG Tracker" in every language; the manifest `description` and `lang` stay Italian until
  the app offers a language choice.

/** Node 22.18+; prepares data only. Applying the generated SQL requires privileged DB access. */
import { readFileSync, writeFileSync } from 'node:fs';
import { configureScryfallClient, resolveScryfallNames, cardIdentity } from '../client/src/services/scryfallLookup.ts';
import { normalizeEntries, serializeEntry } from '../client/src/services/deckCards.ts';

const input = process.argv[2];
const output = process.argv[3] ?? '.local/deck-card-backfill.json';
if (!input) throw new Error('Usage: node scripts/prepare-deck-backfill.mjs <fresh-snapshot.json> [output.json]');
const decks = JSON.parse(readFileSync(input, 'utf8'));
configureScryfallClient({ userAgent: 'ZAFF/1.0 (saved-deck migration)' });
const names = [...new Set(decks.flatMap(deck => deck.cards.map(c => c.name)))];
console.log(`Resolving ${names.length} names for ${decks.length} decks; no database writes.`);
const resolved = await resolveScryfallNames(names);
const missing = names.filter(name => !resolved.has(name.trim().toLowerCase()));
if (missing.length) throw new Error('Unresolved cards: ' + missing.join(', '));
const enriched = decks.map(deck => ({ ...deck, enriched: normalizeEntries(deck.cards).map(card =>
  serializeEntry({ ...card, ...cardIdentity(resolved.get(card.name.trim().toLowerCase())) })) }));
writeFileSync(output, JSON.stringify(enriched, null, 2) + '\n');
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const sql = enriched.map(deck => `select public.backfill_deck_cards(${quote(deck.id)},${deck.revision ?? 0},${quote(JSON.stringify(deck.cards))}::jsonb,${quote(JSON.stringify(deck.enriched))}::jsonb);`).join('\n');
writeFileSync(output.replace(/\.json$/, '.sql'), 'begin;\n' + sql + '\ncommit;\n');
console.log(`Prepared ${enriched.reduce((n, d) => n + d.enriched.length, 0)} groups; all names resolved. Saved ${output}.`);

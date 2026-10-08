# Migrazioni Supabase — Registro partite MTG

Questi file SQL, eseguiti nell'ordine numerico indicato dal prefisso, ricreano
da zero lo schema del database Supabase usato dal modulo "Registro partite MTG"
(tabelle `partite`, `mazzi`, `giocatori`, `gruppi`, relative RLS policy e colonne
di proprietà `created_by`).

Vanno eseguiti manualmente nello **SQL Editor** del progetto Supabase, in
ordine, su un progetto nuovo o per ricostruire lo schema in caso di necessità.

| File | Cosa fa |
|---|---|
| `001_crea_tabella_partite.sql` | Crea la tabella principale `partite` (partite giocate) |
| `002_aggiungi_gruppi.sql` | Aggiunge il concetto di gruppo di gioco |
| `003_aggiungi_mazzi.sql` | Crea la tabella `mazzi` (mazzi salvati) |
| `004_aggiungi_giocatori.sql` | Crea la rubrica condivisa `giocatori` |
| `005_aggiungi_gruppi_roster.sql` | Rubrica condivisa dei gruppi |
| `006_aggiungi_origine_mazzi.sql` | Colonna origine mazzo (Homebrew / Precon) |
| `007_aggiungi_account_personali.sql` | Passaggio da password condivisa ad account personali (Supabase Auth) |
| `008_aggiungi_proprieta_giocatori_gruppi.sql` | Colonna `created_by` su giocatori/gruppi per i permessi |
| `009_correggi_permessi_giocatori.sql` | Fix policy RLS permessi giocatori |
| `010_verifica_ripara_created_by.sql` | Migrazione idempotente di riparazione (`add column if not exists`) |
| `011_aggiungi_colori_mazzi.sql` | Colonna colori mazzo (pip mana) |
| `012_aggiungi_formato_mazzi.sql` | Colonna formato mazzo |
| `20261007192702_playable_saved_deck_cards.sql` | Carte normalizzate, identità Scryfall/Oracle, sincronizzazione JSON e salvataggio atomico |
| `20261008230500_aggiungi_stampa_carte_mazzi.sql` | Espansione e numero di collezione delle carte dei mazzi (da eseguire a mano nello SQL Editor) |

Nota: questi file sono stati scritti a mano durante lo sviluppo (non generati
dalla Supabase CLI), quindi non seguono il formato timestamp `YYYYMMDDHHMMSS_nome.sql`
richiesto da `supabase migration up`/CLI — sono pensati per essere eseguiti
manualmente in ordine nello SQL Editor. Se in futuro si vuole usare la Supabase
CLI per le migrazioni, andranno rinominati con quel formato.

## Mazzi giocabili — applicata il 7 ottobre 2026

La nuova migrazione usa il formato CLI. È già applicata al progetto **MTG match
tracker** (`iyhjfmjgkbhsloqslsbk`) nell'organizzazione **AleOgre**; il timestamp
del file corrisponde alla versione registrata nel database. Non rieseguirla su
quel progetto. I file numerati precedenti restano il percorso manuale per creare
lo schema iniziale; non sono stati rinominati o registrati retroattivamente.

`public."mazzi-cards"` contiene un gruppo per nome/sezione: `deck_id`, `name`,
`qty`, `section` (main/side), `position`, `scryfall_id`, `oracle_id`, `image_url`,
`type_line` e un `id` UUID. La FK elimina le carte quando si elimina il mazzo.
Una modifica alle copie conserva la riga e gli ID; togliere un gruppo dal mazzo
elimina la sua riga al salvataggio. Gli ID assegnati sono immutabili e non hanno
controlli di modifica nel registro.

Il backfill verificato contiene **13 mazzi, 545 gruppi e 1.018 copie**: tutte le
carte hanno entrambi gli ID e i dati per giocare. “Shrinking Storm” è un nome
alternativo verificato di Wrath of God; il nome importato resta nel mazzo e si
usa la prima stampa valida trovata, senza imporre l'illustrazione Secret Lair.

`mazzi.cards` resta durante questa fase. I trigger sincronizzano anche i vecchi
salvataggi diretti del JSON; un controllo differito impedisce discrepanze tra
JSON e righe. `save_deck` salva metadati, JSON e righe in una transazione,
controllando la revisione per evitare sovrascritture simultanee. Lettura pubblica
per ZAFF; scrittura solo per autenticati, sul proprio mazzo o sui mazzi legacy
senza proprietario. Un vecchio client che aggiunge carte crea righe ancora senza
ID: riaprire e salvare dall'editor aggiornato le risolve. ZAFF blocca i mazzi
incompleti prima della conferma.

### Prova locale

Sul branch `codex/playable-saved-decks-plan`, con le credenziali pubbliche del
progetto già in `client/.env.local`:

```bash
npm ci
npm run dev:all
```

Apri `http://localhost:5173/collectible-card-gaming/`. Accedi al registro e prova
creazione manuale, file ManaBox, incolla elenco, precon, ricerca immagini,
correzione nomi, copie −/+, formato/colori e salvataggio. Le modifiche locali
usano **il database AleOgre reale**, come prima. In ZAFF il menu **Saved deck
(Registro)** include tutti i mazzi, anche di altri utenti; MTGJSON rimane nel
menu accanto. Le copie del main e del side vengono caricate insieme, come già
succedeva con MTGJSON.

Per verificare il codice senza scrivere nel progetto live:

```bash
npm run test
npm run test:db  # Docker; PostgreSQL 17 temporaneo, rimosso dopo i test
npm run build
```

### Preparare o ripetere un backfill

Il backfill è un'operazione privilegiata fuori dal browser, separata dalla DDL.
`backfill_deck_cards` è accessibile solo al ruolo di servizio/amministratore;
nessuna chiave di servizio è necessaria o inclusa nel frontend. Conserva una
fotografia fresca delle righe `mazzi` (inclusa `revision`, dopo la migrazione)
sotto `.local/`, esclusa da Git. Lo script risolve solo nomi esatti, anche
localizzati, preserva i nomi originali e prepara JSON/SQL senza scrivere nel DB:

```bash
# Node 22.18+ per importare i moduli TypeScript condivisi
node scripts/prepare-deck-backfill.mjs .local/decks-snapshot.json
# Facoltativo: prova anche quel dataset nel PostgreSQL temporaneo
node scripts/test-deck-migration.mjs .local/deck-card-backfill.json
```

Applica `.local/deck-card-backfill.sql` solo al progetto verificato attraverso
il percorso amministrativo. L'SQL racchiude l'enrichment in una transazione;
ogni mazzo verifica revisione e contenuto della fotografia. Se il mazzo cambia,
la transazione viene annullata: aggiorna la fotografia prima di riprovare.
Ripetere non aggiunge duplicati né sostituisce ID già assegnati. Non applicare
i file di fixture/test al progetto live.

La rimozione di `mazzi.cards` e dei trigger temporanei è una migrazione futura:
prima occorre passare tutti i lettori del registro alle righe e sostituire il
percorso di scrittura compatibile. Il piano dettagliato è in
`plans/PLAN_PLAYABLE_SAVED_DECKS.md`.

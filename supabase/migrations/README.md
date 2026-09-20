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

Nota: questi file sono stati scritti a mano durante lo sviluppo (non generati
dalla Supabase CLI), quindi non seguono il formato timestamp `YYYYMMDDHHMMSS_nome.sql`
richiesto da `supabase migration up`/CLI — sono pensati per essere eseguiti
manualmente in ordine nello SQL Editor. Se in futuro si vuole usare la Supabase
CLI per le migrazioni, andranno rinominati con quel formato.

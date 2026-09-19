# Piano di porting: Registro Partite MTG → React (ZAFF client)

Porting completo, a piccoli step, dell'app single-file `registro-partite-mtg.html`
(HTML/CSS/JS vanilla + Supabase) in componenti React dentro `client/src`.

Il server Go/WebSocket di ZAFF non è coinvolto: questa feature è indipendente
dal gioco live, usa solo Supabase (stesso progetto/tabelle già in uso, nessun
dato perso).

File originale di riferimento: `../registro-partite-mtg.html` (2120 righe).

## Step

- [x] **Step 0 — Setup base**
  Aggiungere `@supabase/supabase-js` al client, creare `client/src/services/supabase.ts`
  (client + env vars), aggiungere link/pagina vuota "Registro Partite" raggiungibile
  dalla homepage ZAFF.
  Verifica: la pagina si apre e si connette a Supabase.
  Fatto: dipendenza aggiunta, `client/src/services/supabase.ts` creato,
  `client/.env.local` con credenziali (non committato), pagina `MtgLog.tsx`
  raggiungibile da un link in `JoinScreen.tsx`. Build, test e dev server verificati.

- [x] **Step 1 — Autenticazione**
  Form login/registrazione (email+password) + gestione sessione.
  Verifica: login/logout funzionano.
  Fatto: `client/src/components/mtglog/AuthScreen.tsx` (signin/signup, gestione
  errori/messaggi come nell'originale), `MtgLog.tsx` gestisce la sessione con
  `supabase.auth.getSession()` + `onAuthStateChange`, mostra login o schermata
  autenticata con logout. Build e test verificati.

- [ ] **Step 2 — Rubrica giocatori**
  Lista, aggiungi, rinomina (con propagazione ovunque), elimina.

- [ ] **Step 3 — Rubrica gruppi**
  Stesso pattern dei giocatori + tab filtro per gruppo.

- [ ] **Step 4 — Lista/visualizzazione mazzi**
  Solo lettura: lista mazzi salvati, dettaglio, badge Homebrew/Precon.

- [ ] **Step 5 — Editor mazzo (ricerca Scryfall)**
  Creazione/modifica manuale mazzo con autocomplete carte e rilevamento colori
  automatico dalle terre base.

- [ ] **Step 6 — Import mazzi**
  Import da file `.txt` esportato da ManaBox + import mazzi precostruiti Commander
  (JSON comunitario).

- [ ] **Step 7 — Form "Nuova Partita"**
  Giocatori dinamici, select mazzo/nome, punti vita, vincitore (switch), note.
  Solo UI, senza salvataggio.

- [ ] **Step 8 — Salvataggio partite + realtime**
  Collegare il form al DB (CRUD partite) + sincronizzazione multi-dispositivo
  (Supabase Realtime, `postgres_changes`).

- [ ] **Step 9 — Lista/dettaglio partite**
  Storico partite, filtro per gruppo, appellativi scherzosi random per vincitore/perdenti.

- [ ] **Step 10 — Export immagine partita**
  html2canvas per esportare il dettaglio partita come PNG + Web Share API su mobile.

- [ ] **Step 11 — Statistiche e classifica**
  Percentuale vittorie per mazzo, distinzione Homebrew/Precon, classifica giocatori
  con mini grafici a torta.

- [ ] **Step 12 — Modalità "Conta i punti vita"**
  Schermo intero, stepper +/- a 4 zone d'angolo, funzione High Roll (d20).

- [ ] **Step 13 — Rifiniture finali**
  Verifica permessi (`created_by` / RLS) su tutte le entità, gestione dati legacy
  senza proprietario, test finale di parità funzionale con l'originale.

## Note

- Ogni step è pensato per essere completato e verificato in una singola sessione.
- I dati Supabase esistenti (URL/anon key, tabelle partite/mazzi/giocatori/gruppi)
  restano invariati in ogni step: nessun rischio di perdita dati.
- Credenziali Supabase (URL + anon key) già presenti nel file originale, da
  spostare in variabili d'ambiente Vite (`.env.local`, non committato).

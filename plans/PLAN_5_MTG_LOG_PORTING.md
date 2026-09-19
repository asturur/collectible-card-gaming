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

- [x] **Step 2 — Rubrica giocatori**
  Lista, aggiungi, rinomina (con propagazione ovunque), elimina.
  Fatto: `client/src/components/mtglog/PlayersRoster.tsx`, raggiungibile da
  "Gestisci giocatori" nella home del registro. Costanti tabelle (`partite`,
  `giocatori`, `mazzi`, `gruppi`) e `canEdit()` centralizzate in `services/supabase.ts`.
  Rinomina inline (invece del prompt nativo dell'originale) con propagazione
  sulle partite salvate. Build e test verificati.

- [x] **Step 3 — Rubrica gruppi**
  Stesso pattern dei giocatori + tab filtro per gruppo.
  Fatto: `client/src/components/mtglog/GroupsRoster.tsx`, raggiungibile da
  "Gestisci gruppi" nella home del registro (stesso pattern di PlayersRoster).
  Nota: il tab filtro per gruppo sulla lista partite è rimandato allo Step 9,
  quando esisterà una lista partite da filtrare. Build e test verificati.

- [x] **Step 4 — Lista/visualizzazione mazzi**
  Solo lettura: lista mazzi salvati, dettaglio, badge Homebrew/Precon.
  Fatto: `client/src/components/mtglog/DeckList.tsx`, raggiungibile da "Mazzi
  salvati" nella home. Lista + vista dettaglio con elenco carte. Modifica/
  cancellazione/colori mazzo rimandati allo Step 5 (editor). Build e test
  verificati.

- [x] **Step 5 — Editor mazzo (ricerca Scryfall)**
  Creazione/modifica manuale mazzo con autocomplete carte e rilevamento colori
  automatico dalle terre base.
  Fatto: `client/src/components/mtglog/DeckEditor.tsx`, raggiungibile da
  "+ Crea nuovo mazzo" e "Modifica" (solo mazzi propri, via `canEdit()`) in
  `DeckList.tsx`. Nome/origine mazzo, pallini colore (toggle manuale +
  accensione automatica rilevando le terre base nei nomi carta aggiunti),
  ricerca carta con autocomplete Scryfall (debounce 250ms), aggiunta/rimozione
  carte dalla bozza, salvataggio (insert/update su `mazzi`). `DeckList.tsx`
  esteso con cancellazione mazzo. Import file ManaBox e mazzi precon Commander
  rimandati allo Step 6 come da piano. Build e test verificati.

- [x] **Step 6 — Import mazzi**
  Import da file `.txt` esportato da ManaBox + import mazzi precostruiti Commander
  (JSON comunitario).
  Fatto: `DeckList.tsx` ha il bottone "Importa mazzo (file ManaBox)" che legge
  il file, lo fa analizzare (`parseManaboxText`) e apre `DeckEditor` con la
  bozza precompilata (colori rilevati automaticamente). `DeckEditor.tsx` ha
  il bottone "Importa un mazzo precon Commander…" che cerca nell'archivio
  comunitario (con cache in `localStorage`, chiave `mtg:precon-cache`) e importa
  il mazzo scelto (comandante + carte, origine "precon", colori auto-rilevati).
  Build e test verificati.

- [x] **Step 7 — Form "Nuova Partita"**
  Giocatori dinamici, select mazzo/nome, punti vita, vincitore (switch), note.
  Solo UI, senza salvataggio.
  Fatto: `client/src/components/mtglog/GameForm.tsx`, raggiungibile da
  "▶ Nuova partita" nella home del registro. Gruppo/data/formato, righe
  giocatore dinamiche (+ Aggiungi/togli giocatore) con nome (datalist dalla
  rubrica), mazzo (select dai mazzi salvati o testo libero, colori
  precompilati dal mazzo scelto), descrizione, pallini colore, switch
  vincitore (un solo vincitore alla volta) e punti vita, più punti vita
  iniziali e appunti generali. Il bottone "Salva partita" mostra solo un
  messaggio: il salvataggio arriva nello Step 8. Build e test verificati.

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

# Diario dei lavori — Registro MTG (ottobre 2026)

Memoria di lavoro tra una sessione e l'altra: come lavoriamo, cosa è stato fatto,
scelte prese ed errori corretti. Le regole tecniche stanno in `AGENTS.md` (= `CLAUDE.md`);
qui c'è il "perché" e la cronologia. Va aggiornato a ogni blocco di lavoro.

## Come lavoriamo

- **Persone:** Alessandro (account GitHub `alessandrochieco`, non sviluppatore: spiegazioni
  semplici, passo passo, in italiano) e Andrea (`asturur`, proprietario del repository).
- **Cartella sul Mac:** `~/Progetti/collectible-card-gaming` (spostata fuori da Documenti:
  iCloud creava file doppioni "… 2.tsx" che rompevano il build). La vecchia copia è
  `Documents/ZabovArena/collectible-card-gaming-VECCHIA`, da cancellare.
- **Claude non può fare push** (GitHub risponde 403: la Claude GitHub App non è autorizzata
  sul repository di Andrea). Flusso: Claude fa il commit e manda una patch
  (`git format-patch origin/main..HEAD`); Alessandro dal terminale:
  ```bash
  cd ~/Progetti/collectible-card-gaming && git checkout main && git pull && git checkout -B claude/eager-maxwell-av6ioi && git am ~/Downloads/NOME.patch && npm ci && npm run build && npm run test && git push -u origin claude/eager-maxwell-av6ioi
  ```
  poi pull request e merge da
  `https://github.com/asturur/collectible-card-gaming/compare/main...claude/eager-maxwell-av6ioi`.
  Verifica: scritta viola "Merged", spunta verde in Actions (Deploy to GitHub Pages), prova sul telefono.
- **Prima di una nuova patch** la precedente deve avere fatto il merge (altrimenti il push
  viene rifiutato "non-fast-forward": è successo una volta, si risolve ripartendo da
  `origin/claude/eager-maxwell-av6ioi`).
- **Verifica obbligatoria prima del push:** `npm ci && npm run build && npm run test`
  (build prima dei test: in una cartella nuova `@zaff/shared` esiste solo dopo il build).
  GitHub pubblica ma non esegue i test.
- **Il Mac usa Node 24:** i test vanno provati anche con Node 24 (un test passava con Node 22
  e falliva con 24: il router di dati di React Router con jsdom → test riscritto senza).
- **Per provare prima di pubblicare:** dopo `git am`, `npm run dev`; Ctrl+C per fermarlo.
- **Stile delle risposte:** proposte con pro/contro e una raccomandazione prima delle modifiche
  grandi; screenshot su telefono e computer; controllo di coerenza con AGENTS.md ogni volta.
- **Database (Supabase, progetto "MTG match tracker"):** i comandi SQL si eseguono a mano
  nello SQL Editor; per i blocchi con trigger differiti non disattivare/riattivare un trigger
  nella stessa transazione (errore 55006 "pending trigger events": eseguire i passi separati).

## Interventi sul database (a mano)

- Mazzo "Black Vampire Aggro" assegnato all'account di Alessandro (trigger `deck_guard`
  spento e riacceso in tre esecuzioni separate). Nome giocatore "Alessandro" e i gruppi senza
  proprietario assegnati ad Alessandro.
- Giocatori e gruppi: tolte le regole "chiunque autenticato rinomina/cancella" della 007 e
  messe quelle della 008 ("solo il proprietario"), che non era mai stata applicata.
- `20261029120000_cancellazione_account.sql` eseguita (funzione `delete_my_account`).
- `npm audit fix` (senza `--force`): restano 3 segnalazioni di vitest, che richiedono la
  versione maggiore 5 → lavoro a parte. Non usare mai `npm audit fix --force`.

## Cronologia (pull request)

| PR | Cosa |
|----|------|
| #5 | Contapunti: totale dei tocchi ravvicinati (come Lotus), colori fluo con testo nero, punteggio al centro esatto, rotella all'incrocio dei riquadri (3 e 5 giocatori) |
| #6 | Contapunti: punteggio in proporzione alla scheda (`scoreSize`) |
| #7 | Contapunti: "Esci senza salvare" con conferma; `npm audit fix` |
| #8 | Statistiche carte: Maledette = vittorie mancate rispetto alla media (prima: 0 vittorie, sempre vuota) |
| #9 | Produzione di mana come ManaBox (conteggio pieno, quantità dal testo: Sol Ring = 2) |
| #10 | `ChipRow`: filtri e sotto-pagine in una riga scorrevole o selettore a larghezza uguale |
| #11 | Righe scorrevoli solo in orizzontale (`touch-pan-x`) |
| #12 | Pagina Account con cancellazione dell'account |
| #13 | Mazzi Salvati: pannello Filtri (colori, nome carta, parole chiave multiple "Tutte · Almeno una", testo); `Modal.footer` |

## Scelte prese (e perché)

- **Contapunti:** finestra di 4 s uguale per totale dei tocchi e cronologia; totale netto;
  stile A (colore pieno fluo, testo nero, `SEAT_COLORS` solo nel contapunti).
- **Esci senza salvare:** sempre con conferma; dopo la conferma nessuna seconda domanda.
- **Maledette:** vittorie mancate = presenze × media − vittorie, solo carte sotto la media.
- **Produzione di mana:** come ManaBox, tranne una differenza voluta: le fonti di "qualsiasi
  colore" contano solo i colori dei costi del mazzo (ManaBox conta tutti e 5). Alessandro: va
  bene così per ora.
- **Pulsanti dei filtri:** soluzione A (una riga che scorre; selettore a larghezza uguale con
  fino a 4 voci che ci stanno). Speed dial scartato per i filtri: serve per azioni/navigazione.
- **Cancellazione account:** l'utente sceglie se eliminare i suoi mazzi; le partite non si
  eliminano mai (coinvolgono altri giocatori). Ciò che resta diventa senza proprietario e
  modificabile da chiunque abbia un account (scelta A, non "sola lettura"). Conferma con
  la parola ELIMINA.
- **Filtri mazzi:** pannello B con tutto dentro (anche i colori); un chip per filtro in pagina;
  parole chiave da lista di caselle con ricerca; testo in inglese (Scryfall).
- **Conferme di sistema (`window.confirm`)** da trasformare in riquadri dell'app: proposto in
  due passi (1: componente comune + 3 cancellazioni + esci senza salvare; 2: uscita dalla
  pagina e conflitti di salvataggio). **Non ancora fatto.**

## Errori trovati e corretti (da non ripetere)

- `pkill -f "pattern"` uccide anche la shell che contiene il pattern: usare `[v]ite…`.
- Trigger SQL: `current_setting(…, true)` vale NULL se non impostato → avvolgere in `coalesce`
  (altrimenti un controllo di sicurezza non scatta). Trovato dai test `scripts/assert-*.sql`,
  ora eseguiti da `npm run test:db`.
- `beforeEach(() => mock.mockReset())` restituisce il mock e vitest lo chiama come pulizia:
  usare le graffe.
- `useLayoutEffect` + `offsetLeft`: la riga deve essere `relative` per misurare le voci.
- daisyUI `label` è in linea: le liste di caselle vanno in un contenitore `flex-col`.
- `sticky bottom-0` dentro il velo del `Modal` vale dentro il suo margine in fondo: il margine
  del livello 1 è alto quanto la barra di navigazione (anche su schermi larghi, dove prima la
  barra copriva la fine dei riquadri).
- I test in jsdom non calcolano il layout: per `ChipRow` si simulano le misure.

## Idee e prossimi passi discussi

- Conferme in stile app (vedi sopra).
- Scansione delle carte: scenario B consigliato (foto + intelligenza artificiale tramite una
  funzione Supabase), prototipo su 30–50 carte. Domande aperte: costo per foto accettabile?
  carte in inglese o italiano? Intanto si può importare da ManaBox (già supportato).
- Pubblicazione sugli store (Capacitor, Apple Developer 99 $/anno, Mac con Xcode): rimandata
  a quando l'app sarà matura. Ostacoli noti: funzioni native richieste da Apple, Fan Content
  Policy di Wizards (app gratuita, "non affiliata"), ZAFF dipende da un server su PC, privacy policy.
- Pulsante "Nessun filtro" del filtro colore: ancora con stile proprio (condiviso con Nuova
  Partita), da portare nel kit.
- Aggiornare vitest alla versione 5 (3 segnalazioni di sicurezza residue, solo strumenti di sviluppo).
- Possibile: test automatici anche su GitHub a ogni push (da decidere con Andrea).

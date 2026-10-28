import type { ReactNode } from 'react';
import { MIN_GAMES, SIGNATURE_MIN_GAMES, SIGNATURE_MIN_SHARE, TOP } from './cardStatsMath';
import { SHOWN as HOME_SHOWN } from './HomeOverview';
import { SHOWN_MONTHS } from './trends';
import { cx, SURFACE } from '../ui/styles';

/** Un argomento della FAQ: una statistica, spiegata. */
export interface FaqTopic {
  id: string;
  label: string;
  body: ReactNode;
}

/** Una sezione della FAQ, come le voci del menu Statistiche. */
export interface FaqSection {
  id: string;
  label: string;
  topics: FaqTopic[];
}

/*
 * I testi descrivono i calcoli di stats.ts, cardStatsMath.ts, trends.ts e delle
 * pagine statistiche: se cambia un calcolo, va cambiato anche qui. Le soglie
 * vengono dalle stesse costanti del codice, così restano sempre giuste.
 */

/* Mattoncini del testo: tutti gli argomenti seguono lo stesso schema. */

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zaff-muted">{title}</h3>
      <div className="space-y-2.5 text-[15px] leading-relaxed text-zaff-text">{children}</div>
    </section>
  );
}

function Formula({ children }: { children: ReactNode }) {
  return <p className={cx(SURFACE, 'px-3 py-2.5 text-center font-semibold')}>{children}</p>;
}

function Example({ children }: { children: ReactNode }) {
  return <div className={cx(SURFACE, 'space-y-2 border-l-4 border-l-zaff-primary px-3 py-2.5')}>{children}</div>;
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-1.5 pl-5">{children}</ol>;
}

function Bullets({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}

const GREEN = <b className="text-success">verde</b>;
const RED = <b className="text-error">rossa</b>;
const SIGNATURE_SHARE_PCT = Math.round(SIGNATURE_MIN_SHARE * 100);

/* Pezzi ripetuti in più argomenti di Carte. */

/** Come si passa dalle partite alle "presenze" di una carta. */
function CardPresences() {
  return (
    <>
      <li>
        Si prendono le partite scelte con i filtri <b>Formato</b> e <b>Periodo</b> (solo quelle con un
        vincitore, come in tutte le statistiche).
      </li>
      <li>
        Per ogni giocatore di ogni partita si cerca il suo mazzo tra i mazzi salvati. Se il mazzo non è
        salvato (scritto a mano, o cancellato), quel giocatore non conta per le carte.
      </li>
      <li>
        Dal mazzo si leggono le carte del <b>Main Deck</b>: il Sideboard e le terre non contano (per le
        carte a due facce decide la faccia davanti). Più stampe della stessa carta valgono come una
        carta sola.
      </li>
      <li>
        Ogni volta che una carta è in un mazzo giocato conta come una <b>presenza</b>. Se quel
        giocatore ha vinto la partita, è anche una <b>vittoria</b>. Il numero di copie qui non conta:
        quattro copie nella stessa partita sono una presenza sola.
      </li>
    </>
  );
}

function CurrentLists() {
  return (
    <li>
      Contano le liste <b>attuali</b> dei mazzi: le partite salvano quale mazzo è stato usato, non le
      sue carte. Se oggi togli una carta da un mazzo, sparisce anche dalle sue partite passate; se la
      aggiungi, conta anche per le partite in cui non c&apos;era.
    </li>
  );
}

function GroupAverage() {
  return (
    <Block title="La media del gruppo">
      <p>
        Sopra l&apos;elenco c&apos;è la <b>media del gruppo</b>: tutte le vittorie divise per tutte le
        presenze dei giocatori con un mazzo salvato, nelle stesse partite del filtro. È il punto di
        riferimento, perché il &quot;normale&quot; dipende da quanti giocano: in una partita a quattro
        vince uno solo, quindi la media sta intorno al 25%; in due, intorno al 50%.
      </p>
      <p>
        La percentuale di una carta è {GREEN} se è pari o sopra la media, {RED} se è sotto.
      </p>
    </Block>
  );
}

const common: FaqTopic = {
  id: 'rules',
  label: 'Regole comuni',
  body: (
    <>
      <Block title="Quali partite contano">
        <p>
          Tutte le statistiche usano solo le partite salvate <b>con un vincitore</b>. Una partita senza
          vincitore (interrotta, o salvata a metà) resta nel registro: si vede in Partite, nelle
          &quot;Ultime partite&quot; della Home e nei contatori &quot;Partite totali&quot; e
          &quot;Questo mese&quot;. Però non entra in nessuna percentuale, classifica, torta, serie o
          grafico, compresa la mini-classifica della Home.
        </p>
        <p>
          Le statistiche usano le partite di tutti i giocatori del registro, non solo le tue. Solo
          Statistiche Carte ha i filtri per formato e periodo.
        </p>
      </Block>

      <Block title="Presenze, vittorie e sconfitte">
        <p>
          Ogni giocatore di una partita ha una <b>presenza</b>. Una partita ha un solo vincitore: per
          lui è una <b>vittoria</b>, per tutti gli altri una <b>sconfitta</b>.
        </p>
        <Formula>% di vittoria = vittorie ÷ presenze × 100</Formula>
        <p>
          Le percentuali sono arrotondate all&apos;intero più vicino (37,5% diventa 38%). Per questo
          due valori uguali a schermo possono essere leggermente diversi nel calcolo.
        </p>
      </Block>

      <Block title="Giocatori e mazzi">
        <Bullets>
          <li>
            Un giocatore è riconosciuto dal nome. Rinominarlo in Gestisci Giocatori aggiorna anche le
            partite già salvate, quindi le sue statistiche restano unite.
          </li>
          <li>
            Il mazzo di una partita è riconosciuto prima dal mazzo salvato scelto (resta valido anche
            se rinomini il mazzo), poi dal nome per le partite più vecchie. Un mazzo scritto a mano,
            senza mazzo salvato, conta con il nome scritto.
          </li>
          <li>
            Le statistiche sulle carte leggono le liste dei mazzi salvati come sono <b>oggi</b>: le
            partite non salvano le carte usate.
          </li>
        </Bullets>
      </Block>

      <Block title="Periodo (Statistiche Carte)">
        <Bullets>
          <li>
            <b>Ultimi 30 giorni</b>: partite con data da 30 giorni fa a oggi.
          </li>
          <li>
            <b>Quest&apos;anno</b>: partite dal 1° gennaio dell&apos;anno in corso.
          </li>
          <li>
            <b>Sempre</b>: tutte le partite.
          </li>
        </Bullets>
      </Block>

      <Block title="Aggiornamento e immagini">
        <p>
          I dati si rileggono dopo il salvataggio di una partita, toccando il tasto Home e quando si
          torna nell&apos;app dopo averla lasciata in secondo piano. Le immagini esportate mostrano lo
          stesso calcolo della pagina. La ricerca filtra solo l&apos;elenco a schermo: l&apos;immagine
          contiene sempre l&apos;elenco completo.
        </p>
      </Block>
    </>
  ),
};

const decks: FaqTopic = {
  id: 'ranking',
  label: 'Statistiche Mazzi',
  body: (
    <>
      <Block title="Cosa mostra">
        <p>
          Ogni mazzo usato nelle partite, con quante volte è stato giocato, quante ha vinto e la
          percentuale di vittoria. Il calcolo riguarda il mazzo, chiunque l&apos;abbia giocato: se lo
          hanno usato in due, i loro risultati si sommano.
        </p>
      </Block>

      <Block title="Come si calcola">
        <Steps>
          <li>
            Per ogni giocatore di ogni partita si guarda il mazzo indicato. Se non è indicato, quella
            presenza non conta per nessun mazzo.
          </li>
          <li>
            <b>Partite</b> = presenze del mazzo; <b>vittorie</b> = partite vinte da chi lo giocava.
          </li>
        </Steps>
        <Formula>% di vittoria = vittorie ÷ partite × 100</Formula>
        <p>
          La barra sotto ogni mazzo va da 0% a 100%: il colore in punta passa dal rosso al giallo al
          verde man mano che la percentuale sale.
        </p>
      </Block>

      <Block title="Ordinamento">
        <Bullets>
          <li>
            <b>Partite giocate</b>: dal mazzo più giocato; a parità, percentuale più alta; poi in ordine
            alfabetico.
          </li>
          <li>
            <b>% di vittoria</b>: in classifica solo i mazzi con almeno <b>{MIN_GAMES} partite</b>,
            dalla percentuale più alta (a parità, più partite). I mazzi con meno partite compaiono in
            fondo, separati, in ordine di partite giocate.
          </li>
        </Bullets>
      </Block>

      <Block title="Esempio">
        <Example>
          <p>
            Il mazzo &quot;Elfi&quot; è stato giocato 6 volte e ha vinto 2 partite: 2 ÷ 6 = 33%.
            &quot;Draghi&quot; ha giocato una partita sola e l&apos;ha vinta: 100%.
          </p>
          <p>
            Ordinando per % di vittoria, Elfi è in classifica; Draghi va in fondo tra i mazzi con meno
            di {MIN_GAMES} partite, perché una sola partita vinta non basta a dire che è il mazzo
            migliore.
          </p>
        </Example>
      </Block>

      <Block title="Da tenere presente">
        <Bullets>
          <li>
            La percentuale non tiene conto di quanti giocavano: vincere il 30% delle partite a quattro
            è un ottimo risultato, il 30% delle partite a due no.
          </li>
          <li>
            Le etichette Homebrew e Precon vengono dal mazzo salvato. Un mazzo non salvato o cancellato
            compare con il nome scritto nella partita, senza lista carte.
          </li>
        </Bullets>
      </Block>
    </>
  ),
};

const playersStandings: FaqTopic = {
  id: 'standings',
  label: 'Classifica',
  body: (
    <>
      <Block title="Cosa mostra">
        <p>
          L&apos;elenco dei giocatori di Statistiche Giocatori, con una piccola torta per ciascuno: la
          parte dorata è la percentuale di partite vinte, quella grigia le perse.
        </p>
      </Block>

      <Block title="Come si calcola">
        <Formula>% di vittoria = partite vinte ÷ partite giocate × 100</Formula>
        <p>
          L&apos;elenco è in ordine di <b>partite giocate</b>, dalla più alta; a parità, percentuale di
          vittoria più alta; poi in ordine alfabetico. Toccando un nome si apre il suo dettaglio.
        </p>
      </Block>

      <Block title="La classifica della Home">
        <p>
          La mini-classifica della Home mostra i primi {HOME_SHOWN} giocatori, ma in un altro ordine:
          prima chi ha <b>più vittorie</b> (a parità, più partite giocate). Per questo le stesse persone
          possono comparire in ordine diverso nelle due pagine: la Home premia chi vince di più in
          assoluto, Statistiche Giocatori parte da chi gioca di più.
        </p>
      </Block>

      <Block title="Esempio">
        <Example>
          <p>
            Anna ha giocato 20 partite e ne ha vinte 6 (30%); Marco ne ha giocate 8 e vinte 4 (50%).
            In Statistiche Giocatori Anna è sopra, perché ha giocato di più. Nella Home Anna è prima,
            perché ha più vittorie (6 contro 4).
          </p>
        </Example>
      </Block>
    </>
  ),
};

const playersPie: FaqTopic = {
  id: 'pie',
  label: 'Torta del gruppo',
  body: (
    <>
      <Block title="Cosa mostra">
        <p>
          In cima a Statistiche Giocatori: come si dividono tra i giocatori tutte le vittorie
          registrate. Non dice chi vince più spesso, ma chi ha vinto più partite in totale.
        </p>
      </Block>

      <Block title="Come si calcola">
        <Formula>fetta = vittorie del giocatore ÷ vittorie totali × 100</Formula>
        <p>
          Le vittorie totali sono le partite con un vincitore. Compaiono solo i giocatori con almeno una
          vittoria.
        </p>
      </Block>

      <Block title="Esempio">
        <Example>
          <p>
            Su 40 partite, Anna ne ha vinte 10: la sua fetta è 10 ÷ 40 = 25%. Chi gioca spesso tende ad
            avere una fetta più grande anche con una percentuale di vittoria normale.
          </p>
        </Example>
      </Block>
    </>
  ),
};

const playersDetail: FaqTopic = {
  id: 'detail',
  label: 'Dettaglio giocatore',
  body: (
    <>
      <Block title="Cosa mostra">
        <p>
          Aprendo un giocatore: la sua percentuale di vittoria con la torta (dorato = vinte, grigio =
          perse), partite giocate e vinte, e i <b>mazzi usati</b>.
        </p>
      </Block>

      <Block title="Come si calcola">
        <Formula>% di vittoria = partite vinte ÷ partite giocate × 100</Formula>
        <p>
          Per ogni mazzo contano solo le partite di <b>quel giocatore</b>: se un mazzo l&apos;hanno
          usato anche altri, qui si vede solo come è andato a lui (in Statistiche Mazzi invece si
          sommano tutti). Le partite in cui non ha indicato il mazzo sono raccolte in &quot;Mazzo non
          indicato&quot;.
        </p>
        <p>
          I mazzi sono in ordine di partite giocate; a parità, percentuale più alta. Qui non c&apos;è
          un minimo di partite: anche un mazzo usato una volta compare con la sua percentuale.
        </p>
      </Block>

      <Block title="Esempio">
        <Example>
          <p>
            Marco ha giocato &quot;Elfi&quot; 5 volte vincendo 2 partite (40%). Anna ha giocato lo
            stesso mazzo 3 volte senza vincere. Nel dettaglio di Marco gli Elfi sono al 40%; in
            Statistiche Mazzi sono a 2 vittorie su 8 partite, 25%.
          </p>
        </Example>
      </Block>
    </>
  ),
};

const cardsPlayed: FaqTopic = {
  id: 'played',
  label: 'Più giocate',
  body: (
    <>
      <Block title="Cosa mostra">
        <p>
          Le {TOP} carte di cui sono state giocate più copie in tutto, nelle partite del filtro. Non
          guarda chi ha vinto.
        </p>
      </Block>

      <Block title="Come si calcola">
        <Steps>
          <CardPresences />
          <li>
            Per questa classifica conta anche il numero di copie: ogni presenza aggiunge le copie che il
            mazzo contiene.
          </li>
        </Steps>
        <Formula>copie = somma, partita per partita, delle copie nel mazzo</Formula>
        <p>
          In ordine dalla carta con più copie; a parità, più presenze; poi in ordine alfabetico. Sotto
          il nome: &quot;X copie in Y partite&quot;.
        </p>
      </Block>

      <Block title="Esempio">
        <Example>
          <p>
            Un mazzo con 4 copie di Fulminare è stato giocato 3 volte: 4 × 3 = 12 copie in 3 partite.
            In Commander ogni carta è in copia singola, quindi copie e partite coincidono quasi sempre.
          </p>
        </Example>
      </Block>

      <Block title="Da tenere presente">
        <Bullets>
          <CurrentLists />
          <li>
            Una carta può essere tra le più giocate solo perché è in un mazzo usato molto spesso.
          </li>
        </Bullets>
      </Block>
    </>
  ),
};

const cardsWinners: FaqTopic = {
  id: 'winners',
  label: 'Più vincenti',
  body: (
    <>
      <Block title="Cosa mostra">
        <p>
          Le {TOP} carte che vincono più spesso: per ogni carta, quante volte ha vinto il giocatore
          che l&apos;aveva nel mazzo, rispetto a tutte le volte che l&apos;ha giocata.
        </p>
      </Block>

      <Block title="Come si calcola">
        <Steps>
          <CardPresences />
          <li>
            Entrano in classifica solo le carte con almeno <b>{MIN_GAMES} presenze</b>: con meno
            partite la percentuale dipende troppo dal caso.
          </li>
        </Steps>
        <Formula>% di vittoria = vittorie ÷ presenze × 100</Formula>
        <p>
          In ordine dalla percentuale più alta; a parità viene prima la carta con più presenze, poi in
          ordine alfabetico.
        </p>
      </Block>

      <GroupAverage />

      <Block title="Esempio">
        <Example>
          <p>
            Sol Ring era nel mazzo di chi giocava in 8 partite, e 3 di queste le ha vinte quel
            giocatore: 3 ÷ 8 = 0,375, cioè <b>38%</b>. Se la media del gruppo è 27%, Sol Ring è in
            verde: chi lo gioca vince più del normale.
          </p>
          <p>
            Una carta giocata 4 volte e vinta 4 volte avrebbe il 100%, ma non compare: ha meno di{' '}
            {MIN_GAMES} presenze.
          </p>
        </Example>
      </Block>

      <Block title="Da tenere presente">
        <Bullets>
          <CurrentLists />
          <li>
            Una carta in un mazzo forte &quot;vince&quot; perché vince il mazzo: le carte dello stesso
            mazzo tendono ad avere percentuali simili. La statistica dice con che frequenza la carta era
            dalla parte del vincitore, non quanto ha contato per la vittoria.
          </li>
          <li>
            {MIN_GAMES} presenze sono il minimo, non una garanzia: più presenze ha una carta, più la sua
            percentuale è affidabile.
          </li>
        </Bullets>
      </Block>
    </>
  ),
};

const cardsLosers: FaqTopic = {
  id: 'losers',
  label: 'Meno vincenti',
  body: (
    <>
      <Block title="Cosa mostra">
        <p>
          Il contrario di Più vincenti: le {TOP} carte con la percentuale di vittoria più bassa, tra
          quelle giocate almeno {MIN_GAMES} volte.
        </p>
      </Block>

      <Block title="Come si calcola">
        <Steps>
          <CardPresences />
          <li>
            Entrano in classifica solo le carte con almeno <b>{MIN_GAMES} presenze</b>.
          </li>
        </Steps>
        <Formula>% di vittoria = vittorie ÷ presenze × 100</Formula>
        <p>
          In ordine dalla percentuale più bassa; a parità viene prima la carta con più presenze (una
          carta che perde da più partite è un segnale più forte), poi in ordine alfabetico.
        </p>
      </Block>

      <GroupAverage />

      <Block title="Esempio">
        <Example>
          <p>
            Una carta presente in 10 partite, vinte 1: 1 ÷ 10 = <b>10%</b>, in rosso se la media del
            gruppo è 27%. Una carta mai vincente compare qui con lo 0%; in Maledette passa avanti chi,
            giocata più spesso, ha mancato più vittorie.
          </p>
        </Example>
      </Block>

      <Block title="Da tenere presente">
        <Bullets>
          <CurrentLists />
          <li>
            Una carta in un mazzo che perde spesso finisce qui anche se da sola non ha colpe: conta il
            risultato della partita, non la carta.
          </li>
        </Bullets>
      </Block>
    </>
  ),
};

const cardsStaples: FaqTopic = {
  id: 'staples',
  label: 'Di base',
  body: (
    <>
      <Block title="Cosa mostra">
        <p>
          Le carte &quot;di base&quot; del gruppo: le {TOP} carte presenti nel maggior numero di mazzi
          diversi.
        </p>
      </Block>

      <Block title="Come si calcola">
        <Steps>
          <CardPresences />
          <li>
            Per ogni carta si contano i <b>mazzi diversi</b> che la contengono, tra i mazzi giocati nelle
            partite del filtro. Servono almeno 2 mazzi.
          </li>
        </Steps>
        <p>
          In ordine dal maggior numero di mazzi; a parità, più presenze; poi in ordine alfabetico.
          Sotto il nome: &quot;in X mazzi · Y partite&quot;.
        </p>
      </Block>

      <Block title="Esempio">
        <Example>
          <p>
            Sol Ring è in 7 mazzi diversi, giocati in tutto 30 volte: &quot;in 7 mazzi · 30
            partite&quot;. Una carta in un solo mazzo, anche se giocato moltissimo, qui non compare.
          </p>
        </Example>
      </Block>

      <Block title="Da tenere presente">
        <Bullets>
          <CurrentLists />
          <li>
            Contano solo i mazzi giocati nel periodo e nel formato scelti: un mazzo salvato ma mai
            usato non aggiunge niente.
          </li>
        </Bullets>
      </Block>
    </>
  ),
};

const cardsSignature: FaqTopic = {
  id: 'signature',
  label: 'Firme',
  body: (
    <>
      <Block title="Cosa mostra">
        <p>
          Per ogni giocatore, la sua carta-firma: quella che usa spesso e che gli altri usano poco. Non
          è la carta che gioca di più (Sol Ring lo giocano tutti, quindi non caratterizza nessuno).
        </p>
      </Block>

      <Block title="Come si calcola">
        <Steps>
          <CardPresences />
          <li>
            Si considerano i giocatori con almeno <b>{SIGNATURE_MIN_GAMES} partite</b> giocate con un
            mazzo salvato.
          </li>
          <li>
            Per ogni carta del giocatore si calcolano due quote: quanto la usa lui e quanto la usano
            gli altri.
          </li>
          <li>
            Possono essere firme solo le carte presenti in almeno <b>{SIGNATURE_SHARE_PCT}%</b> delle
            sue partite.
          </li>
          <li>Vince la carta con la differenza più grande; a parità, in ordine alfabetico.</li>
        </Steps>
        <Formula>quota sua = sue partite con la carta ÷ sue partite</Formula>
        <Formula>quota altri = presenze della carta negli altri ÷ presenze degli altri</Formula>
        <Formula>firma = la carta con (quota sua − quota altri) più alta</Formula>
        <p>
          Le &quot;presenze degli altri&quot; sono tutte le presenze, con mazzo salvato, degli altri
          giocatori nelle partite del filtro.
        </p>
      </Block>

      <Block title="Esempio">
        <Example>
          <p>
            Marco ha giocato 10 partite: Rhystic Study c&apos;era in 8 (quota sua 80%). Negli altri
            giocatori c&apos;era in 6 presenze su 60 (quota altri 10%). Differenza: 80% − 10% = 70%.
          </p>
          <p>
            Sol Ring era in tutte e 10 le sue partite (100%), ma anche nel 90% di quelle degli altri:
            differenza 10%. La firma di Marco è Rhystic Study. Sotto il nome si legge &quot;in 8 delle
            sue 10 partite · negli altri 10%&quot;.
          </p>
        </Example>
      </Block>

      <Block title="Da tenere presente">
        <Bullets>
          <CurrentLists />
          <li>
            Un giocatore senza nessuna carta presente in almeno {SIGNATURE_SHARE_PCT}% delle sue
            partite (per esempio perché cambia mazzo ogni volta) non ha una firma.
          </li>
        </Bullets>
      </Block>
    </>
  ),
};

const cardsColors: FaqTopic = {
  id: 'colors',
  label: 'Colori',
  body: (
    <>
      <Block title="Cosa mostra">
        <p>
          La percentuale di vittoria dei mazzi di ciascun colore: Bianco, Blu, Nero, Rosso, Verde.
        </p>
      </Block>

      <Block title="Come si calcola">
        <Steps>
          <li>
            Si prendono le partite del filtro. A differenza delle altre statistiche sulle carte, qui
            non serve un mazzo salvato: contano i <b>colori segnati nella partita</b> per ogni
            giocatore.
          </li>
          <li>
            Ogni giocatore conta una presenza per <b>ogni colore</b> del suo mazzo: un mazzo
            bianco-blu conta sia per il Bianco sia per il Blu. Se vince, è una vittoria per entrambi.
          </li>
          <li>I mazzi incolori, o senza colori segnati, non contano.</li>
        </Steps>
        <Formula>% del colore = vittorie con quel colore ÷ presenze con quel colore × 100</Formula>
        <p>In ordine dalla percentuale più alta; a parità, più presenze.</p>
      </Block>

      <Block title="La media del gruppo">
        <p>
          La media di riferimento conta <b>ogni giocatore una volta sola</b>, anche se il mazzo ha più
          colori: vittorie ÷ presenze dei giocatori con almeno un colore segnato, nelle partite del
          filtro. Un colore è {GREEN} se è pari o sopra la media, {RED} se è sotto.
        </p>
      </Block>

      <Block title="Esempio">
        <Example>
          <p>
            In una partita a quattro vince un mazzo bianco-blu. Gli altri tre sono rosso, verde e nero.
            Il Bianco e il Blu fanno una vittoria su una presenza; Rosso, Verde e Nero una sconfitta
            ciascuno. La media del gruppo è 1 vittoria su 4 giocatori: 25%.
          </p>
        </Example>
      </Block>

      <Block title="Da tenere presente">
        <Bullets>
          <li>
            I mazzi multicolore spingono più colori insieme: se i mazzi a cinque colori vincono molto,
            tutti i colori salgono.
          </li>
          <li>
            Le partite contate qui possono essere più di quelle delle altre classifiche di Carte, che
            richiedono un mazzo salvato.
          </li>
        </Bullets>
      </Block>
    </>
  ),
};

const cardsCursed: FaqTopic = {
  id: 'cursed',
  label: 'Maledette',
  body: (
    <>
      <Block title="Cosa mostra">
        <p>
          Le carte che hanno <b>mancato più vittorie</b> rispetto alla media del gruppo: giocate
          spesso, ma con chi le aveva nel mazzo che vinceva meno del normale.
        </p>
      </Block>

      <Block title="Come si calcola">
        <Steps>
          <CardPresences />
          <li>
            Restano le carte con almeno <b>{MIN_GAMES} presenze</b> e una percentuale di vittoria
            sotto la media del gruppo.
          </li>
          <li>
            Per ognuna si calcolano le vittorie che avrebbe avuto vincendo come la media, e si
            tolgono quelle avute davvero.
          </li>
        </Steps>
        <Formula>vittorie mancate = presenze × media del gruppo − vittorie</Formula>
        <p>
          In ordine dalla carta con più vittorie mancate (la più &quot;maledetta&quot;); a parità
          viene prima quella con più presenze, poi in ordine alfabetico; al massimo {TOP}.
        </p>
      </Block>

      <GroupAverage />

      <Block title="Esempio">
        <Example>
          <p>
            Con la media del gruppo al 27%: una carta presente in 30 partite e vinta 3 volte ne
            avrebbe attese 30 × 27% = 8,1, quindi ha mancato <b>5,1 vittorie</b>. Una carta presente
            in 5 partite e mai vincente ne ha mancate 1,4: in Meno vincenti viene prima lei (0%), qui
            invece viene prima quella da 30 partite, perché ha deluso molte più volte.
          </p>
        </Example>
      </Block>

      <Block title="Da tenere presente">
        <Bullets>
          <CurrentLists />
          <li>È un elenco per divertimento: la carta non ha colpe, conta il risultato della partita.</li>
        </Bullets>
      </Block>
    </>
  ),
};

const matchups: FaqTopic = {
  id: 'matchups',
  label: 'Statistiche per Sfida',
  body: (
    <>
      <Block title="Cosa mostra">
        <p>
          Le partite raggruppate per <b>formazione</b>: l&apos;insieme esatto dei giocatori che
          hanno partecipato. Per ogni formazione, quante partite si sono giocate e come si dividono le
          vittorie.
        </p>
      </Block>

      <Block title="Come si calcola">
        <Steps>
          <li>
            Ogni partita appartiene alla formazione dei suoi giocatori (almeno 2). L&apos;ordine non
            conta: &quot;Anna vs Marco&quot; e &quot;Marco vs Anna&quot; sono la stessa sfida.
          </li>
          <li>
            Formazioni diverse sono sfide diverse: Anna, Marco e Luca insieme sono un&apos;altra sfida
            rispetto ad Anna e Marco da soli.
          </li>
          <li>
            Per ogni giocatore della sfida: vittorie, sconfitte (partite della sfida meno le sue
            vittorie) e percentuale.
          </li>
        </Steps>
        <Formula>% nella sfida = vittorie ÷ partite della sfida × 100</Formula>
        <Formula>fetta della torta = vittorie ÷ vittorie totali della sfida × 100</Formula>
        <p>
          L&apos;elenco è in ordine di partite giocate, dalla sfida più frequente; a parità, in ordine
          alfabetico.
        </p>
      </Block>

      <Block title="Esempio">
        <Example>
          <p>
            Anna e Marco hanno giocato 12 partite a due: Anna ne ha vinte 7 (58%), Marco 5 (42%).
            Le partite a tre con Luca non rientrano in questa sfida: hanno una sfida propria.
          </p>
        </Example>
      </Block>
    </>
  ),
};

const trendsMonthly: FaqTopic = {
  id: 'monthly',
  label: 'Partite per mese',
  body: (
    <>
      <Block title="Cosa mostra">
        <p>
          Quante partite si sono giocate ogni mese, negli ultimi {SHOWN_MONTHS} mesi. In cima alla
          pagina, una riga riassume il mese in corso.
        </p>
      </Block>

      <Block title="Come si calcola">
        <Steps>
          <li>Ogni partita conta nel mese della sua data.</li>
          <li>
            I mesi vanno dal primo con partite fino a quello in corso; i mesi senza partite restano a
            zero. Il grafico mostra gli ultimi {SHOWN_MONTHS}.
          </li>
          <li>
            Le colonne sono in proporzione al mese con più partite tra quelli mostrati; il numero sopra
            ogni colonna è il conteggio esatto.
          </li>
        </Steps>
        <p>
          La riga in cima dice le partite del mese in corso e chi ne ha vinte di più (a pari vittorie,
          tutti i primi).
        </p>
      </Block>

      <Block title="Esempio">
        <Example>
          <p>
            &quot;Ottobre 2026: 9 partite, più vittorie: Anna e Marco (3).&quot; Anna e Marco hanno
            vinto 3 partite ciascuno a ottobre, nessuno ne ha vinte di più.
          </p>
        </Example>
      </Block>

      <Block title="Da tenere presente">
        <Bullets>
          <li>
            Contano solo le partite con un vincitore: il contatore &quot;Questo mese&quot; della Home,
            che conta tutte le partite salvate, può essere più alto.
          </li>
        </Bullets>
      </Block>
    </>
  ),
};

const trendsWins: FaqTopic = {
  id: 'wins',
  label: 'Vittorie per mese',
  body: (
    <>
      <Block title="Cosa mostra">
        <p>
          Per ogni giocatore, un piccolo grafico con le vittorie mese per mese, negli stessi{' '}
          {SHOWN_MONTHS} mesi di Partite per mese.
        </p>
      </Block>

      <Block title="Come si calcola">
        <p>
          Ogni vittoria conta nel mese della partita. Tutti i grafici usano la <b>stessa scala</b>: la
          colonna più alta è il mese migliore di qualunque giocatore. Così le altezze si possono
          confrontare tra un giocatore e l&apos;altro.
        </p>
        <p>I giocatori sono in ordine di vittorie totali, dalla più alta; a parità, più partite.</p>
      </Block>

      <Block title="Esempio">
        <Example>
          <p>
            Se il mese migliore in assoluto è di Anna con 5 vittorie, una colonna di Marco da 2
            vittorie è alta poco meno della metà di quella di Anna.
          </p>
        </Example>
      </Block>
    </>
  ),
};

const trendsStreaks: FaqTopic = {
  id: 'streaks',
  label: 'Serie di vittorie',
  body: (
    <>
      <Block title="Cosa mostra">
        <p>
          Per ogni giocatore, le vittorie consecutive: la serie <b>in corso</b> e il <b>record</b>, la
          serie più lunga di sempre.
        </p>
      </Block>

      <Block title="Come si calcola">
        <Steps>
          <li>
            Le partite sono messe in ordine di tempo: data, poi orario di inizio. Per ogni giocatore
            contano solo le partite a cui ha partecipato.
          </li>
          <li>Ogni vittoria allunga la serie di 1; ogni sconfitta la riporta a 0.</li>
          <li>Il record è la serie più lunga raggiunta.</li>
        </Steps>
        <p>In ordine dal record più alto; a parità, la serie in corso più lunga; poi alfabetico.</p>
      </Block>

      <Block title="Esempio">
        <Example>
          <p>
            Anna, in ordine: vinta, vinta, persa, vinta, vinta, vinta. Record 3, in corso 3. Se perde la
            prossima: record 3, in corso 0.
          </p>
        </Example>
      </Block>

      <Block title="Da tenere presente">
        <Bullets>
          <li>
            Una partita senza vincitore non interrompe la serie: non conta proprio.
          </li>
          <li>
            Le partite salvate senza orario (le più vecchie) giocate nello stesso giorno hanno un
            ordine non garantito: in quel caso la serie può cambiare di poco.
          </li>
        </Bullets>
      </Block>
    </>
  ),
};

const trendsFavorite: FaqTopic = {
  id: 'favorite',
  label: 'Mazzo preferito',
  body: (
    <>
      <Block title="Cosa mostra">
        <p>Per ogni giocatore, il mazzo che ha usato più volte, con partite e vittorie.</p>
      </Block>

      <Block title="Come si calcola">
        <p>
          Si contano le partite di ogni giocatore con ciascun mazzo. Il preferito è quello con più
          partite; a parità, quello con più vittorie; poi in ordine alfabetico. Le partite senza mazzo
          indicato non contano.
        </p>
        <p>L&apos;elenco è in ordine di partite con il mazzo preferito, dalla più alta.</p>
      </Block>

      <Block title="Esempio">
        <Example>
          <p>
            Marco ha giocato &quot;Elfi&quot; 6 volte (2 vinte) e &quot;Draghi&quot; 6 volte (3
            vinte): a pari partite vince Draghi, con più vittorie.
          </p>
        </Example>
      </Block>
    </>
  ),
};

/** Le sezioni seguono il menu Statistiche; gli argomenti di Carte seguono i filtri della sua pagina. */
export const FAQ_SECTIONS: FaqSection[] = [
  { id: 'common', label: 'Regole comuni', topics: [common] },
  { id: 'decks', label: 'Mazzi', topics: [decks] },
  { id: 'players', label: 'Giocatori', topics: [playersStandings, playersPie, playersDetail] },
  {
    id: 'cards',
    label: 'Carte',
    topics: [cardsPlayed, cardsWinners, cardsLosers, cardsStaples, cardsSignature, cardsColors, cardsCursed],
  },
  { id: 'matchups', label: 'Sfide', topics: [matchups] },
  { id: 'trends', label: 'Andamento', topics: [trendsMonthly, trendsWins, trendsStreaks, trendsFavorite] },
];

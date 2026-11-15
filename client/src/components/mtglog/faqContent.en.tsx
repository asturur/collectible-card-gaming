import { MIN_GAMES, SIGNATURE_MIN_GAMES, SIGNATURE_MIN_SHARE, TOP } from './cardStatsMath';
import { SHOWN as HOME_SHOWN } from './HomeOverview';
import { SHOWN_MONTHS } from './trends';
import { Block, Bullets, Example, Formula, Steps, type FaqSection, type FaqTopic } from './faqParts';

/*
 * English copy of the FAQ (faqContent.tsx is the Italian original): same sections, same
 * topic ids, same code constants. When an Italian text changes, change it here too
 * (a test checks that both copies have the same sections and topics).
 */

const GREEN = <b className="text-success">green</b>;
const RED = <b className="text-error">red</b>;
const SIGNATURE_SHARE_PCT = Math.round(SIGNATURE_MIN_SHARE * 100);

/* Pieces repeated in several Cards topics. */

/** How games become a card's "appearances". */
function CardPresences() {
  return (
    <>
      <li>
        Take the games chosen with the <b>Format</b> and <b>Period</b> filters (only those with a winner,
        as in every statistic).
      </li>
      <li>
        For each player in each game, look up their deck among the saved decks. If the deck isn&apos;t
        saved (typed by hand, or deleted), that player doesn&apos;t count for cards.
      </li>
      <li>
        From the deck, read the <b>Main Deck</b> cards: the Sideboard and lands don&apos;t count (for
        double-faced cards the front face decides). Different printings of the same card count as one card.
      </li>
      <li>
        Every time a card is in a played deck it counts as one <b>appearance</b>. If that player won the
        game, it is also a <b>win</b>. The number of copies doesn&apos;t matter here: four copies in the same
        game are a single appearance.
      </li>
    </>
  );
}

function CurrentLists() {
  return (
    <li>
      The <b>current</b> deck lists count: games store which deck was used, not its cards. If you remove
      a card from a deck today, it also disappears from its past games; if you add one, it also counts for
      games where it wasn&apos;t there.
    </li>
  );
}

function GroupAverage() {
  return (
    <Block title="The group average">
      <p>
        Above the list there is the <b>group average</b>: all wins divided by all appearances of players
        with a saved deck, in the same filtered games. It is the reference point, because &quot;normal&quot;
        depends on how many people play: in a four-player game only one wins, so the average is around 25%;
        with two players, around 50%.
      </p>
      <p>
        A card&apos;s percentage is {GREEN} if it is at or above the average, {RED} if it is below.
      </p>
    </Block>
  );
}

const common: FaqTopic = {
  id: 'rules',
  label: 'Common rules',
  body: (
    <>
      <Block title="Which games count">
        <p>
          All statistics use only games saved <b>with a winner</b>. A game without a winner (interrupted,
          or saved halfway) stays in the log: you see it in Games, in the Home &quot;Latest games&quot; and
          in the &quot;Total games&quot; and &quot;This month&quot; counters. But it doesn&apos;t enter any
          percentage, ranking, pie chart, streak or chart, including the Home mini standings.
        </p>
        <p>
          Statistics use the games of every player in the log, not just yours. Only Card Stats has format
          and period filters.
        </p>
      </Block>

      <Block title="Appearances, wins and losses">
        <p>
          Every player in a game has one <b>appearance</b>. A game has a single winner: for them it is a{' '}
          <b>win</b>, for everyone else a <b>loss</b>.
        </p>
        <Formula>Win % = wins ÷ appearances × 100</Formula>
        <p>
          Percentages are rounded to the nearest whole number (37.5% becomes 38%). That is why two values
          that look equal on screen can be slightly different in the calculation.
        </p>
      </Block>

      <Block title="Players and decks">
        <Bullets>
          <li>
            A player is recognized by name. Renaming them in Manage Players also updates saved games, so
            their statistics stay together.
          </li>
          <li>
            A game&apos;s deck is recognized first by the saved deck chosen (it stays valid even if you
            rename the deck), then by name for older games. A deck typed by hand, without a saved deck,
            counts under the name typed.
          </li>
          <li>
            Card statistics read the saved deck lists as they are <b>today</b>: games don&apos;t store the
            cards used.
          </li>
        </Bullets>
      </Block>

      <Block title="Period (Card Stats)">
        <Bullets>
          <li>
            <b>Last 30 days</b>: games dated from 30 days ago to today.
          </li>
          <li>
            <b>This year</b>: games from January 1st of the current year.
          </li>
          <li>
            <b>All time</b>: every game.
          </li>
        </Bullets>
      </Block>

      <Block title="Updates and images">
        <p>
          Data is read again after saving a game, when you tap the Home button and when you come back to the
          app after leaving it in the background. Exported images show the same calculation as the page.
          Search filters only the list on screen: the image always contains the full list.
        </p>
      </Block>
    </>
  ),
};

const decks: FaqTopic = {
  id: 'ranking',
  label: 'Deck Stats',
  body: (
    <>
      <Block title="What it shows">
        <p>
          Every deck used in games, with how many times it was played, how many it won and its win rate.
          The calculation is about the deck, whoever played it: if two people used it, their results add up.
        </p>
      </Block>

      <Block title="How it is calculated">
        <Steps>
          <li>
            For each player in each game, look at the deck set. If none is set, that appearance doesn&apos;t
            count for any deck.
          </li>
          <li>
            <b>Games</b> = the deck&apos;s appearances; <b>wins</b> = games won by whoever played it.
          </li>
        </Steps>
        <Formula>Win % = wins ÷ games × 100</Formula>
        <p>
          The bar under each deck goes from 0% to 100%: the color at its tip moves from red to yellow to green
          as the percentage rises.
        </p>
      </Block>

      <Block title="Sorting">
        <Bullets>
          <li>
            <b>Games played</b>: from the most played deck; on a tie, higher percentage; then alphabetical.
          </li>
          <li>
            <b>Win %</b>: only decks with at least <b>{MIN_GAMES} games</b> are ranked, from the highest
            percentage (on a tie, more games). Decks with fewer games appear at the bottom, apart, sorted by
            games played.
          </li>
        </Bullets>
      </Block>

      <Block title="Example">
        <Example>
          <p>
            The &quot;Elves&quot; deck was played 6 times and won 2 games: 2 ÷ 6 = 33%. &quot;Dragons&quot;
            played a single game and won it: 100%.
          </p>
          <p>
            Sorting by Win %, Elves is ranked; Dragons goes to the bottom among decks with fewer than{' '}
            {MIN_GAMES} games, because one game won isn&apos;t enough to say it is the best deck.
          </p>
        </Example>
      </Block>

      <Block title="Keep in mind">
        <Bullets>
          <li>
            The percentage doesn&apos;t consider how many people were playing: winning 30% of four-player games
            is a great result, 30% of two-player games isn&apos;t.
          </li>
          <li>
            The Homebrew and Precon labels come from the saved deck. A deck that isn&apos;t saved or was deleted
            appears with the name written in the game, without a card list.
          </li>
        </Bullets>
      </Block>
    </>
  ),
};

const playersStandings: FaqTopic = {
  id: 'standings',
  label: 'Standings',
  body: (
    <>
      <Block title="What it shows">
        <p>
          The list of players in Player Stats, with a small pie for each one: the gold part is the percentage
          of games won, the gray part the games lost.
        </p>
      </Block>

      <Block title="How it is calculated">
        <Formula>Win % = games won ÷ games played × 100</Formula>
        <p>
          The list is sorted by <b>games played</b>, highest first; on a tie, higher win rate; then
          alphabetical. Tapping a name opens their details.
        </p>
      </Block>

      <Block title="The Home standings">
        <p>
          The Home mini standings show the top {HOME_SHOWN} players, but in a different order: whoever has the{' '}
          <b>most wins</b> comes first (on a tie, more games played). That is why the same people can appear in
          a different order on the two pages: Home rewards whoever wins the most overall, Player Stats starts
          from whoever plays the most.
        </p>
      </Block>

      <Block title="Example">
        <Example>
          <p>
            Anna played 20 games and won 6 (30%); Marco played 8 and won 4 (50%). In Player Stats Anna is
            above, because she played more. On Home Anna is first, because she has more wins (6 against 4).
          </p>
        </Example>
      </Block>
    </>
  ),
};

const playersPie: FaqTopic = {
  id: 'pie',
  label: 'Group pie',
  body: (
    <>
      <Block title="What it shows">
        <p>
          At the top of Player Stats: how all recorded wins are split among the players. It doesn&apos;t say who
          wins most often, but who has won the most games in total.
        </p>
      </Block>

      <Block title="How it is calculated">
        <Formula>slice = player&apos;s wins ÷ total wins × 100</Formula>
        <p>Total wins are the games with a winner. Only players with at least one win appear.</p>
      </Block>

      <Block title="Example">
        <Example>
          <p>
            Out of 40 games, Anna won 10: her slice is 10 ÷ 40 = 25%. Whoever plays often tends to have a
            bigger slice even with a normal win rate.
          </p>
        </Example>
      </Block>
    </>
  ),
};

const playersDetail: FaqTopic = {
  id: 'detail',
  label: 'Player details',
  body: (
    <>
      <Block title="What it shows">
        <p>
          Opening a player: their win rate with the pie (gold = won, gray = lost), games played and won, and
          the <b>decks used</b>.
        </p>
      </Block>

      <Block title="How it is calculated">
        <Formula>Win % = games won ÷ games played × 100</Formula>
        <p>
          For each deck only <b>that player&apos;s</b> games count: if others used the deck too, here you only
          see how it went for them (in Deck Stats everyone adds up). Games where they didn&apos;t set a deck are
          collected under &quot;No deck set&quot;.
        </p>
        <p>
          Decks are sorted by games played; on a tie, higher percentage. There is no minimum number of games
          here: even a deck used once appears with its percentage.
        </p>
      </Block>

      <Block title="Example">
        <Example>
          <p>
            Marco played &quot;Elves&quot; 5 times winning 2 games (40%). Anna played the same deck 3 times
            without winning. In Marco&apos;s details Elves is at 40%; in Deck Stats it is at 2 wins out of 8
            games, 25%.
          </p>
        </Example>
      </Block>
    </>
  ),
};

const cardsPlayed: FaqTopic = {
  id: 'played',
  label: 'Most played',
  body: (
    <>
      <Block title="What it shows">
        <p>The {TOP} cards with the most copies played in total, in the filtered games. It ignores who won.</p>
      </Block>

      <Block title="How it is calculated">
        <Steps>
          <CardPresences />
          <li>For this ranking the number of copies also counts: each appearance adds the copies in the deck.</li>
        </Steps>
        <Formula>copies = sum, game by game, of the copies in the deck</Formula>
        <p>
          From the card with the most copies; on a tie, more appearances; then alphabetical. Under the name:
          &quot;X copies in Y games&quot;.
        </p>
      </Block>

      <Block title="Example">
        <Example>
          <p>
            A deck with 4 copies of Lightning Bolt was played 3 times: 4 × 3 = 12 copies in 3 games. In
            Commander every card is a single copy, so copies and games almost always match.
          </p>
        </Example>
      </Block>

      <Block title="Keep in mind">
        <Bullets>
          <CurrentLists />
          <li>A card can be among the most played just because it is in a deck used very often.</li>
        </Bullets>
      </Block>
    </>
  ),
};

const cardsWinners: FaqTopic = {
  id: 'winners',
  label: 'Winners',
  body: (
    <>
      <Block title="What it shows">
        <p>
          The {TOP} cards that win most often: for each card, how many times the player who had it in their deck
          won, compared with all the times they played it.
        </p>
      </Block>

      <Block title="How it is calculated">
        <Steps>
          <CardPresences />
          <li>
            Only cards with at least <b>{MIN_GAMES} appearances</b> are ranked: with fewer games the percentage
            depends too much on luck.
          </li>
        </Steps>
        <Formula>Win % = wins ÷ appearances × 100</Formula>
        <p>From the highest percentage; on a tie, the card with more appearances comes first, then alphabetical.</p>
      </Block>

      <GroupAverage />

      <Block title="Example">
        <Example>
          <p>
            Sol Ring was in the player&apos;s deck in 8 games, and that player won 3 of them: 3 ÷ 8 = 0.375,
            that is <b>38%</b>. If the group average is 27%, Sol Ring is green: whoever plays it wins more than
            usual.
          </p>
          <p>
            A card played 4 times and won 4 times would have 100%, but it doesn&apos;t appear: it has fewer than{' '}
            {MIN_GAMES} appearances.
          </p>
        </Example>
      </Block>

      <Block title="Keep in mind">
        <Bullets>
          <CurrentLists />
          <li>
            A card in a strong deck &quot;wins&quot; because the deck wins: cards in the same deck tend to have
            similar percentages. The statistic says how often the card was on the winner&apos;s side, not how
            much it mattered for the win.
          </li>
          <li>
            {MIN_GAMES} appearances are the minimum, not a guarantee: the more appearances a card has, the more
            reliable its percentage.
          </li>
        </Bullets>
      </Block>
    </>
  ),
};

const cardsLosers: FaqTopic = {
  id: 'losers',
  label: 'Losers',
  body: (
    <>
      <Block title="What it shows">
        <p>
          The opposite of Winners: the {TOP} cards with the lowest win rate, among those played at least{' '}
          {MIN_GAMES} times.
        </p>
      </Block>

      <Block title="How it is calculated">
        <Steps>
          <CardPresences />
          <li>
            Only cards with at least <b>{MIN_GAMES} appearances</b> are ranked.
          </li>
        </Steps>
        <Formula>Win % = wins ÷ appearances × 100</Formula>
        <p>
          From the lowest percentage; on a tie, the card with more appearances comes first (a card that loses
          over more games is a stronger signal), then alphabetical.
        </p>
      </Block>

      <GroupAverage />

      <Block title="Example">
        <Example>
          <p>
            A card in 10 games, won 1: 1 ÷ 10 = <b>10%</b>, red if the group average is 27%. A card that never
            wins appears here at 0%; in Cursed, the card that missed more wins by being played more often comes
            first.
          </p>
        </Example>
      </Block>

      <Block title="Keep in mind">
        <Bullets>
          <CurrentLists />
          <li>
            A card in a deck that often loses ends up here even if it isn&apos;t to blame: the result of the game
            counts, not the card.
          </li>
        </Bullets>
      </Block>
    </>
  ),
};

const cardsStaples: FaqTopic = {
  id: 'staples',
  label: 'Staples',
  body: (
    <>
      <Block title="What it shows">
        <p>The group&apos;s &quot;staples&quot;: the {TOP} cards found in the most different decks.</p>
      </Block>

      <Block title="How it is calculated">
        <Steps>
          <CardPresences />
          <li>
            For each card, count the <b>different decks</b> that contain it, among the decks played in the
            filtered games. At least 2 decks are needed.
          </li>
        </Steps>
        <p>
          From the most decks; on a tie, more appearances; then alphabetical. Under the name: &quot;in X decks ·
          Y games&quot;.
        </p>
      </Block>

      <Block title="Example">
        <Example>
          <p>
            Sol Ring is in 7 different decks, played 30 times in total: &quot;in 7 decks · 30 games&quot;. A card
            in a single deck, even if played very often, doesn&apos;t appear here.
          </p>
        </Example>
      </Block>

      <Block title="Keep in mind">
        <Bullets>
          <CurrentLists />
          <li>Only decks played in the chosen period and format count: a deck saved but never used adds nothing.</li>
        </Bullets>
      </Block>
    </>
  ),
};

const cardsSignature: FaqTopic = {
  id: 'signature',
  label: 'Signatures',
  body: (
    <>
      <Block title="What it shows">
        <p>
          For each player, their signature card: the one they use often and the others use little. It isn&apos;t
          the card they play the most (everyone plays Sol Ring, so it doesn&apos;t characterize anyone).
        </p>
      </Block>

      <Block title="How it is calculated">
        <Steps>
          <CardPresences />
          <li>
            Players with at least <b>{SIGNATURE_MIN_GAMES} games</b> played with a saved deck are considered.
          </li>
          <li>For each of the player&apos;s cards, two shares are calculated: how much they use it and how much the others do.</li>
          <li>
            Only cards in at least <b>{SIGNATURE_SHARE_PCT}%</b> of their games can be signatures.
          </li>
          <li>The card with the biggest difference wins; on a tie, alphabetical.</li>
        </Steps>
        <Formula>their share = their games with the card ÷ their games</Formula>
        <Formula>others&apos; share = card appearances among others ÷ others&apos; appearances</Formula>
        <Formula>signature = the card with the highest (their share − others&apos; share)</Formula>
        <p>
          &quot;Others&apos; appearances&quot; are all the appearances, with a saved deck, of the other players in
          the filtered games.
        </p>
      </Block>

      <Block title="Example">
        <Example>
          <p>
            Marco played 10 games: Rhystic Study was in 8 (his share 80%). Among the other players it was in 6
            appearances out of 60 (others&apos; share 10%). Difference: 80% − 10% = 70%.
          </p>
          <p>
            Sol Ring was in all 10 of his games (100%), but also in 90% of the others&apos;: difference 10%.
            Marco&apos;s signature is Rhystic Study. Under the name you read &quot;in 8 of their 10 games · others
            10%&quot;.
          </p>
        </Example>
      </Block>

      <Block title="Keep in mind">
        <Bullets>
          <CurrentLists />
          <li>
            A player with no card in at least {SIGNATURE_SHARE_PCT}% of their games (for example because they
            change deck every time) has no signature.
          </li>
        </Bullets>
      </Block>
    </>
  ),
};

const cardsColors: FaqTopic = {
  id: 'colors',
  label: 'Colors',
  body: (
    <>
      <Block title="What it shows">
        <p>The win rate of the decks of each color: White, Blue, Black, Red, Green.</p>
      </Block>

      <Block title="How it is calculated">
        <Steps>
          <li>
            Take the filtered games. Unlike the other card statistics, no saved deck is needed here: the{' '}
            <b>colors set in the game</b> for each player count.
          </li>
          <li>
            Each player counts one appearance for <b>each color</b> of their deck: a white-blue deck counts for
            both White and Blue. If it wins, it is a win for both.
          </li>
          <li>Colorless decks, or decks without colors set, don&apos;t count.</li>
        </Steps>
        <Formula>color % = wins with that color ÷ appearances with that color × 100</Formula>
        <p>From the highest percentage; on a tie, more appearances.</p>
      </Block>

      <Block title="The group average">
        <p>
          The reference average counts <b>each player only once</b>, even if the deck has several colors:
          wins ÷ appearances of players with at least one color set, in the filtered games. A color is {GREEN} if
          it is at or above the average, {RED} if it is below.
        </p>
      </Block>

      <Block title="Example">
        <Example>
          <p>
            In a four-player game a white-blue deck wins. The other three are red, green and black. White and
            Blue get one win out of one appearance; Red, Green and Black one loss each. The group average is 1 win
            out of 4 players: 25%.
          </p>
        </Example>
      </Block>

      <Block title="Keep in mind">
        <Bullets>
          <li>
            Multicolor decks push several colors together: if five-color decks win a lot, every color goes up.
          </li>
          <li>The games counted here can be more than in the other Cards rankings, which need a saved deck.</li>
        </Bullets>
      </Block>
    </>
  ),
};

const cardsCursed: FaqTopic = {
  id: 'cursed',
  label: 'Cursed',
  body: (
    <>
      <Block title="What it shows">
        <p>
          The cards that <b>missed the most wins</b> compared with the group average: played often, but with
          whoever had them in their deck winning less than usual.
        </p>
      </Block>

      <Block title="How it is calculated">
        <Steps>
          <CardPresences />
          <li>
            The cards left are those with at least <b>{MIN_GAMES} appearances</b> and a win rate below the group
            average.
          </li>
          <li>For each one, calculate the wins it would have had winning like the average, and subtract the actual wins.</li>
        </Steps>
        <Formula>missed wins = appearances × group average − wins</Formula>
        <p>
          From the card with the most missed wins (the most &quot;cursed&quot;); on a tie, the one with more
          appearances comes first, then alphabetical; at most {TOP}.
        </p>
      </Block>

      <GroupAverage />

      <Block title="Example">
        <Example>
          <p>
            With the group average at 27%: a card in 30 games that won 3 times would have expected 30 × 27% = 8.1,
            so it missed <b>5.1 wins</b>. A card in 5 games that never won missed 1.4: in Losers it comes first
            (0%), here instead the 30-game card comes first, because it let people down many more times.
          </p>
        </Example>
      </Block>

      <Block title="Keep in mind">
        <Bullets>
          <CurrentLists />
          <li>It is a list for fun: the card isn&apos;t to blame, the result of the game counts.</li>
        </Bullets>
      </Block>
    </>
  ),
};

const matchups: FaqTopic = {
  id: 'matchups',
  label: 'Matchup Stats',
  body: (
    <>
      <Block title="What it shows">
        <p>
          Games grouped by <b>lineup</b>: the exact set of players who took part. For each lineup, how many games
          were played and how the wins are split.
        </p>
      </Block>

      <Block title="How it is calculated">
        <Steps>
          <li>
            Each game belongs to the lineup of its players (at least 2). Order doesn&apos;t matter: &quot;Anna vs
            Marco&quot; and &quot;Marco vs Anna&quot; are the same matchup.
          </li>
          <li>
            Different lineups are different matchups: Anna, Marco and Luca together are another matchup from Anna
            and Marco alone.
          </li>
          <li>For each player in the matchup: wins, losses (matchup games minus their wins) and percentage.</li>
        </Steps>
        <Formula>matchup % = wins ÷ matchup games × 100</Formula>
        <Formula>pie slice = wins ÷ total matchup wins × 100</Formula>
        <p>The list is sorted by games played, from the most frequent matchup; on a tie, alphabetical.</p>
      </Block>

      <Block title="Example">
        <Example>
          <p>
            Anna and Marco played 12 two-player games: Anna won 7 (58%), Marco 5 (42%). The three-player games
            with Luca aren&apos;t part of this matchup: they have their own.
          </p>
        </Example>
      </Block>
    </>
  ),
};

const trendsMonthly: FaqTopic = {
  id: 'monthly',
  label: 'Games per month',
  body: (
    <>
      <Block title="What it shows">
        <p>
          How many games were played each month, over the last {SHOWN_MONTHS} months. At the top of the page, a
          line sums up the current month.
        </p>
      </Block>

      <Block title="How it is calculated">
        <Steps>
          <li>Each game counts in the month of its date.</li>
          <li>
            Months go from the first one with games up to the current one; months without games stay at zero.
            The chart shows the last {SHOWN_MONTHS}.
          </li>
          <li>Columns are proportional to the month with the most games among those shown; the number above each column is the exact count.</li>
        </Steps>
        <p>The line at the top says the games of the current month and who won the most (on a tie, all the leaders).</p>
      </Block>

      <Block title="Example">
        <Example>
          <p>
            &quot;November 2026: 9 games, most wins: Anna and Marco (3).&quot; Anna and Marco won 3 games each in
            November, nobody won more.
          </p>
        </Example>
      </Block>

      <Block title="Keep in mind">
        <Bullets>
          <li>
            Only games with a winner count: the Home &quot;This month&quot; counter, which counts every saved game,
            can be higher.
          </li>
        </Bullets>
      </Block>
    </>
  ),
};

const trendsWins: FaqTopic = {
  id: 'wins',
  label: 'Wins per month',
  body: (
    <>
      <Block title="What it shows">
        <p>
          For each player, a small chart with their wins month by month, over the same {SHOWN_MONTHS} months as
          Games per month.
        </p>
      </Block>

      <Block title="How it is calculated">
        <p>
          Each win counts in the month of the game. All charts use the <b>same scale</b>: the tallest column is
          the best month of any player. So heights can be compared from one player to another.
        </p>
        <p>Players are sorted by total wins, highest first; on a tie, more games.</p>
      </Block>

      <Block title="Example">
        <Example>
          <p>
            If the best month overall is Anna&apos;s with 5 wins, a Marco column with 2 wins is a little less than
            half as tall as Anna&apos;s.
          </p>
        </Example>
      </Block>
    </>
  ),
};

const trendsStreaks: FaqTopic = {
  id: 'streaks',
  label: 'Win streaks',
  body: (
    <>
      <Block title="What it shows">
        <p>
          For each player, their consecutive wins: the <b>current</b> streak and the <b>best</b>, the longest
          streak ever.
        </p>
      </Block>

      <Block title="How it is calculated">
        <Steps>
          <li>Games are put in time order: date, then start time. For each player only the games they took part in count.</li>
          <li>Every win adds 1 to the streak; every loss resets it to 0.</li>
          <li>The best is the longest streak reached.</li>
        </Steps>
        <p>From the highest best; on a tie, the longest current streak; then alphabetical.</p>
      </Block>

      <Block title="Example">
        <Example>
          <p>
            Anna, in order: won, won, lost, won, won, won. Best 3, current 3. If she loses the next one: best 3,
            current 0.
          </p>
        </Example>
      </Block>

      <Block title="Keep in mind">
        <Bullets>
          <li>A game without a winner doesn&apos;t break the streak: it simply doesn&apos;t count.</li>
          <li>
            Games saved without a time (the oldest ones) played on the same day have no guaranteed order: in that
            case the streak can change slightly.
          </li>
        </Bullets>
      </Block>
    </>
  ),
};

const trendsFavorite: FaqTopic = {
  id: 'favorite',
  label: 'Favorite deck',
  body: (
    <>
      <Block title="What it shows">
        <p>For each player, the deck they used the most, with games and wins.</p>
      </Block>

      <Block title="How it is calculated">
        <p>
          Count each player&apos;s games with each deck. The favorite is the one with the most games; on a tie,
          the one with more wins; then alphabetical. Games without a deck set don&apos;t count.
        </p>
        <p>The list is sorted by games with the favorite deck, highest first; on a tie, alphabetical.</p>
      </Block>

      <Block title="Example">
        <Example>
          <p>
            Marco played &quot;Elves&quot; 6 times (2 won) and &quot;Dragons&quot; 6 times (3 won): with equal games
            Dragons wins, with more wins.
          </p>
        </Example>
      </Block>
    </>
  ),
};

const deckCost: FaqTopic = {
  id: 'cost',
  label: 'Mana costs',
  body: (
    <>
      <Block title="What it shows">
        <p>
          In a saved deck&apos;s stats: how much mana of each color the deck&apos;s cards ask for to be cast. It
          tells which colors the deck uses most; compare it with the &quot;Mana production&quot; pie below.
        </p>
      </Block>

      <Block title="How it is calculated">
        <Steps>
          <li>Only <b>Main Deck</b> cards count: not the Sideboard. Lands have no cost, so they add nothing.</li>
          <li>
            The <b>colored symbols</b> in each card&apos;s cost are counted, per copy: {'{G}{G}'} is 2 green, and 4
            copies are 8.
          </li>
          <li>
            A hybrid symbol like {'{W/U}'} is worth <b>half</b> white and half blue. A symbol like {'{2/W}'} or{' '}
            {'{G/P}'} (Phyrexian) is worth 1 of its color.
          </li>
          <li>The {'{C}'} symbol (true colorless, as on Eldrazi cards) counts as colorless.</li>
          <li>
            <b>Generic</b> mana ({'{1}'}, {'{2}'}…) doesn&apos;t count, because any color can pay it. X never counts.
          </li>
        </Steps>
        <Formula>symbols of a color = sum, card by card, of copies × symbols of that color</Formula>
      </Block>

      <Block title="The &quot;Count colorless mana&quot; switch">
        <p>
          Off (as it is when you open the page), the pie shows only colors. On, as in ManaBox, generic mana
          ({'{1}'}, {'{2}'}…) goes into the gray <b>Colorless</b> slice, together with {'{C}'} symbols: so you see
          how much of the costs can be paid with any mana.
        </p>
      </Block>

      <Block title="Example">
        <Example>
          <p>
            4 Llanowar Elves ({'{G}'}), 2 Kitchen Finks ({'{1}{G/W}{G/W}'}) and 1 Murderous Rider ({'{1}{B}{B}'}):
          </p>
          <Bullets>
            <li>
              <b>Green</b> = 4 × 1 + 2 × (½ + ½) = <b>6</b>
            </li>
            <li>
              <b>White</b> = 2 × (½ + ½) = <b>2</b>
            </li>
            <li>
              <b>Black</b> = 1 × 2 = <b>2</b>
            </li>
            <li>
              With the switch on, <b>Colorless</b> = 2 × 1 + 1 × 1 = <b>3</b>
            </li>
          </Bullets>
        </Example>
      </Block>

      <Block title="Keep in mind">
        <Bullets>
          <li>Cards not recognized by Scryfall (with the &quot;?&quot;) don&apos;t count until they are recognized.</li>
          <li>
            It counts how many symbols the whole deck needs, not how early: a {'{G}'} card and a {'{5}{G}'} card
            weigh the same on green.
          </li>
        </Bullets>
      </Block>
    </>
  ),
};

const deckProduction: FaqTopic = {
  id: 'production',
  label: 'Mana production',
  body: (
    <>
      <Block title="What it shows">
        <p>
          How much mana of each color the deck&apos;s cards can produce: lands, artifacts like Sol Ring, creatures
          like Llanowar Elves. It helps you see whether the mana sources match the colors the deck has to pay:
          compare it with the &quot;Mana costs&quot; pie above.
        </p>
      </Block>

      <Block title="How it is calculated (as in ManaBox)">
        <Steps>
          <li>Only <b>Main Deck</b> cards count: not the Sideboard.</li>
          <li>
            Every card that produces mana counts <b>for every color it can make</b>: a white-blue dual land is
            worth 1 white <b>and</b> 1 blue.
          </li>
          <li>
            It also counts <b>how much mana it adds at once</b>, read from the card text: Sol Ring (&quot;Add{' '}
            {'{C}{C}'}&quot;) is worth 2 colorless.
          </li>
          <li>Copies multiply: 10 Forests are worth 10 green.</li>
          <li>
            Sources of <b>any color</b> (Command Tower, Arcane Signet) count only the colors in the deck&apos;s
            costs: in a black-green deck they are worth 1 black and 1 green, not 5 colors.
          </li>
        </Steps>
        <Formula>mana of a color = sum, card by card, of copies × mana it adds of that color</Formula>
      </Block>

      <Block title="Example">
        <Example>
          <p>
            A black-green deck with 10 Swamps, 10 Forests, 1 Overgrown Tomb, 1 Command Tower, 1 Llanowar Elves and
            1 Sol Ring:
          </p>
          <Bullets>
            <li>
              <b>Black</b> = 10 + 1 + 1 = <b>12</b>
            </li>
            <li>
              <b>Green</b> = 10 + 1 + 1 + 1 = <b>13</b>
            </li>
            <li>
              <b>Colorless</b> = <b>2</b> (Sol Ring)
            </li>
          </Bullets>
        </Example>
      </Block>

      <Block title="Keep in mind">
        <Bullets>
          <li>The total can be higher than the number of cards, because a source of several colors counts for each.</li>
          <li>Intended difference from ManaBox: ManaBox counts Command Tower and similar cards for all 5 colors.</li>
          <li>Cards not recognized by Scryfall (with the &quot;?&quot;) don&apos;t count until they are recognized.</li>
          <li>It is a count of sources: it doesn&apos;t say how often you will draw them.</li>
        </Bullets>
      </Block>
    </>
  ),
};

/** Same sections and topic order as the Italian FAQ_SECTIONS. */
export const FAQ_SECTIONS_EN: FaqSection[] = [
  { id: 'common', label: 'Common rules', topics: [common] },
  { id: 'decks', label: 'Decks', topics: [decks] },
  { id: 'players', label: 'Players', topics: [playersStandings, playersPie, playersDetail] },
  {
    id: 'cards',
    label: 'Cards',
    topics: [cardsPlayed, cardsWinners, cardsLosers, cardsStaples, cardsSignature, cardsColors, cardsCursed],
  },
  { id: 'matchups', label: 'Matchups', topics: [matchups] },
  { id: 'trends', label: 'Trends', topics: [trendsMonthly, trendsWins, trendsStreaks, trendsFavorite] },
  { id: 'deck', label: 'Deck charts', topics: [deckCost, deckProduction] },
];

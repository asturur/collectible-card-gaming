import { useEffect, useState } from 'react';
import JoinScreen from './components/JoinScreen';
import DeckPicker from './components/DeckPicker';
import DeckPreview from './components/DeckPreview';
import GameView from './components/GameView';
import MtgLog from './components/MtgLog';
import { useRoute } from './router';
import type { MtgJsonDeck } from './services/mtgjson';

/** Schermate interne alla piattaforma di gioco ZAFF (tutte sotto /zaff). */
type ZaffScreen = 'join' | 'pickDeck' | 'previewDeck' | 'game';

interface Connection {
  address: string;
  playerName: string;
}

export default function App() {
  const [route, navigate] = useRoute();
  const [screen, setScreen] = useState<ZaffScreen>('join');
  const [connection, setConnection] = useState<Connection | null>(null);
  const [selectedDeck, setSelectedDeck] = useState<MtgJsonDeck | null>(null);

  useEffect(() => {
    document.title = route === 'zaff' ? 'ZAFF — Collectible Card Gaming' : 'Registro partite di Magic';
  }, [route]);

  function handleJoin(address: string, playerName: string) {
    setConnection({ address, playerName });
    setScreen('pickDeck');
  }

  function handleDeckSelected(deck: MtgJsonDeck) {
    setSelectedDeck(deck);
    setScreen('previewDeck');
  }

  function handleGoBackToPicker() {
    setSelectedDeck(null);
    setScreen('pickDeck');
  }

  function handleConfirmDeck() {
    setScreen('game');
  }

  function handleDisconnect() {
    setConnection(null);
    setSelectedDeck(null);
    setScreen('join');
  }

  /** Uscendo da ZAFF si chiude la partita in corso: tornando si riparte dal join. */
  function goHome() {
    handleDisconnect();
    navigate('home');
  }

  if (route === 'home') {
    return <MtgLog onOpenZaff={() => navigate('zaff')} />;
  }

  switch (screen) {
    case 'join':
      return <JoinScreen onJoin={handleJoin} onOpenMtgLog={goHome} />;

    case 'pickDeck':
      return <DeckPicker onDeckSelected={handleDeckSelected} />;

    case 'previewDeck':
      return selectedDeck ? (
        <DeckPreview
          deck={selectedDeck}
          onGoBack={handleGoBackToPicker}
          onConfirm={handleConfirmDeck}
        />
      ) : null;

    case 'game':
      return connection ? (
        <GameView
          address={connection.address}
          playerName={connection.playerName}
          selectedDeck={selectedDeck}
          onDisconnect={handleDisconnect}
        />
      ) : null;
  }
}

import { useState } from 'react';
import JoinScreen from './components/JoinScreen';
import DeckPicker from './components/DeckPicker';
import DeckPreview from './components/DeckPreview';
import GameView from './components/GameView';
import type { MtgJsonDeck } from './services/mtgjson';

type AppScreen = 'join' | 'pickDeck' | 'previewDeck' | 'game';

interface Connection {
  address: string;
  playerName: string;
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('join');
  const [connection, setConnection] = useState<Connection | null>(null);
  const [selectedDeck, setSelectedDeck] = useState<MtgJsonDeck | null>(null);

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

  switch (screen) {
    case 'join':
      return <JoinScreen onJoin={handleJoin} />;

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

import { useState } from 'react';
import JoinScreen from './components/JoinScreen';
import GameView from './components/GameView';

interface Connection {
  address: string;
  playerName: string;
}

export default function App() {
  const [connection, setConnection] = useState<Connection | null>(null);

  if (!connection) {
    return (
      <JoinScreen
        onJoin={(address, playerName) => setConnection({ address, playerName })}
      />
    );
  }

  return (
    <GameView
      address={connection.address}
      playerName={connection.playerName}
      onDisconnect={() => setConnection(null)}
    />
  );
}

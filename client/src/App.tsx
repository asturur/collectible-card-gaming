import { useState } from 'react';
import JoinScreen from './components/JoinScreen';

function GameView({ address }: { address: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zaff-bg px-4 text-zaff-text">
      <h2 className="mb-4 text-2xl font-bold">Game View</h2>
      <p className="text-zaff-muted">
        Connected to <span className="text-zaff-primary">{address}</span>
      </p>
    </div>
  );
}

export default function App() {
  const [serverAddress, setServerAddress] = useState<string | null>(null);

  if (!serverAddress) {
    return <JoinScreen onJoin={setServerAddress} />;
  }

  return <GameView address={serverAddress} />;
}

import { useMemo } from 'react';
import { useSocket } from '../network/useSocket';
import type { MtgJsonDeck } from '../services/mtgjson';

interface GameViewProps {
  address: string;
  playerName: string;
  selectedDeck: MtgJsonDeck | null;
  onDisconnect: () => void;
}

export default function GameView({ address, playerName, selectedDeck, onDisconnect }: GameViewProps) {
  const { status, playerId, gameState, disconnect } = useSocket(address, playerName);

  const connectedPlayers = useMemo(() => {
    return Object.entries(gameState.players)
      .filter(([, p]) => p.connected)
      .map(([id, p]) => ({ id, name: p.name }));
  }, [gameState.players]);

  const playerCount = connectedPlayers.length;

  function handleDisconnect() {
    disconnect();
    onDisconnect();
  }

  const statusDot =
    status === 'connected'
      ? 'bg-green-500'
      : status === 'connecting'
        ? 'bg-yellow-500'
        : 'bg-red-500';

  const statusText =
    status === 'connected'
      ? 'Connected'
      : status === 'connecting'
        ? 'Connecting...'
        : status === 'error'
          ? 'Error'
          : 'Disconnected';

  return (
    <div className="flex min-h-screen flex-col bg-zaff-bg text-zaff-text">
      {/* Status bar */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-zaff-border bg-zaff-surface px-4 py-2">
        {/* Left: connection status */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${statusDot}`}
            aria-label={statusText}
          />
          <span className="text-sm text-zaff-muted">{statusText}</span>
        </div>

        {/* Center: player count */}
        <div className="text-sm font-medium">
          {playerCount} {playerCount === 1 ? 'player' : 'players'} in room
        </div>

        {/* Right: player names + disconnect */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-zaff-muted">
            {connectedPlayers.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ', '}
                <span className={p.id === playerId ? 'font-bold text-zaff-text' : ''}>
                  {p.name}
                </span>
              </span>
            ))}
          </span>
          <button
            onClick={handleDisconnect}
            className="rounded-md border border-zaff-border px-3 py-1 text-sm text-zaff-muted transition-colors hover:bg-zaff-border hover:text-zaff-text"
          >
            Disconnect
          </button>
        </div>
      </header>

      {/* Main content area (future canvas space) */}
      <main className="flex-1 pt-12">
        {selectedDeck && (
          <p className="px-4 pt-4 text-sm text-zaff-muted">
            Deck loaded: {selectedDeck.name} ({selectedDeck.type})
          </p>
        )}
      </main>
    </div>
  );
}

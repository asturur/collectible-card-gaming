import { useEffect, useMemo, useRef } from 'react';
import { ActionTypes } from '@zaff/shared';
import { useSocket } from '../network/useSocket';
import { expandPlayableDeck, type PlayableDeck } from '../services/playableDeck';
import GameCanvas from './GameCanvas';
import Button from './ui/Button';

interface GameViewProps {
  address: string;
  playerName: string;
  selectedDeck: PlayableDeck | null;
  onDisconnect: () => void;
}

export default function GameView({ address, playerName, selectedDeck, onDisconnect }: GameViewProps) {
  const { status, playerId, gameState, sendAction, disconnect } = useSocket(address, playerName);
  const deckSentRef = useRef(false);

  // Dispatch LOAD_DECK once when connected with a selected deck
  useEffect(() => {
    if (status !== 'connected' || !selectedDeck || deckSentRef.current) return;
    const cards = expandPlayableDeck(selectedDeck);
    deckSentRef.current = true;

    sendAction({
      type: ActionTypes.LOAD_DECK,
      payload: { cards },
    });
  }, [status, selectedDeck, sendAction]);

  const connectedPlayers = useMemo(() => {
    return Object.entries(gameState.players)
      .filter(([, p]) => p.connected)
      .map(([id, p]) => ({ id, name: p.name }));
  }, [gameState.players]);

  // Collect all cards from the game state as a flat array
  const allCards = useMemo(() => Object.values(gameState.cards), [gameState.cards]);

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
    <div className="relative h-screen w-screen overflow-hidden bg-zaff-bg text-zaff-text">
      {/* Status bar */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-10 items-center justify-between border-b border-zaff-border bg-zaff-surface px-4">
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
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
          >
            Disconnect
          </Button>
        </div>
      </header>

      {/* FabricJS canvas fills everything below the header */}
      {playerId && (
        <GameCanvas
          cards={allCards}
          players={gameState.players}
          playerId={playerId}
          sendAction={sendAction}
        />
      )}
    </div>
  );
}

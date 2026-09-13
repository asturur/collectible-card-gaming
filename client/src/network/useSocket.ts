import { useEffect, useRef, useState, useCallback } from 'react';
import type { ConnectionStatus, GameState, Action, ServerMessage } from '@zaff/shared';
import { initialGameState } from '@zaff/shared';
import { WebSocketGameSocket } from './socket';

/**
 * React hook for managing the game socket lifecycle.
 * Connects to the Go game server and handles all message types.
 */
export function useSocket(serverAddress: string | null, playerName: string) {
  const socketRef = useRef<WebSocketGameSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>(initialGameState());

  useEffect(() => {
    if (!serverAddress) return;

    const socket = new WebSocketGameSocket();
    socketRef.current = socket;

    socket.onStatusChange(setStatus);

    socket.onMessage((message: ServerMessage) => {
      switch (message.msg) {
        case 'WELCOME':
          if (message.playerId) {
            setPlayerId(message.playerId);
          }
          break;

        case 'STATE_SYNC':
          if (message.state) {
            setGameState(message.state);
          }
          break;

        case 'PLAYER_JOINED':
          if (message.playerId && message.playerName) {
            const joinedId = message.playerId;
            const joinedName = message.playerName;
            setGameState((prev) => ({
              ...prev,
              players: {
                ...prev.players,
                [joinedId]: {
                  name: joinedName,
                  seat: prev.players[joinedId]?.seat ?? '',
                  life: prev.players[joinedId]?.life ?? 20,
                  connected: true,
                },
              },
            }));
          }
          break;

        case 'PLAYER_LEFT':
          if (message.playerId) {
            const leftId = message.playerId;
            setGameState((prev) => {
              const player = prev.players[leftId];
              if (!player) return prev;
              return {
                ...prev,
                players: {
                  ...prev.players,
                  [leftId]: { ...player, connected: false },
                },
              };
            });
          }
          break;

        case 'ACTION_RESULT':
          if (message.state) {
            setGameState(message.state);
          }
          break;

        case 'ERROR':
          console.error('Server error:', message.error);
          break;

        case 'PONG':
          // Heartbeat response, nothing to do
          break;
      }
    });

    socket.connect(serverAddress, playerName);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [serverAddress, playerName]);

  const sendAction = useCallback((action: Action) => {
    socketRef.current?.sendAction(action);
  }, []);

  const sendUndo = useCallback((seq: number) => {
    socketRef.current?.sendUndo(seq);
  }, []);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
  }, []);

  return {
    status,
    playerId,
    gameState,
    sendAction,
    sendUndo,
    disconnect,
  };
}

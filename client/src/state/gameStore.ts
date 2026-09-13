import type { GameState, ConnectionStatus, GameAction } from '@zaff/shared';
import { initialGameState } from '@zaff/shared';

/**
 * Client-side game state store.
 * Stub for Plan 1 -- will be expanded with Zustand or useReducer in Plan 2.
 */

export interface GameStore {
  serverAddress: string | null;
  connectionStatus: ConnectionStatus;
  gameState: GameState;
  dispatch: (action: GameAction) => void;
}

/**
 * Creates an initial game store state.
 */
export function createInitialStore(): Omit<GameStore, 'dispatch'> {
  return {
    serverAddress: null,
    connectionStatus: 'disconnected',
    gameState: initialGameState,
  };
}

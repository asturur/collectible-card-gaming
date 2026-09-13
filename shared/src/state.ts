/**
 * Game state shape shared between client and server.
 */

export interface Card {
  id: string;
  name: string;
  imageUrl?: string;
  position: { x: number; y: number };
  zone: string;
  ownerId: string;
  faceUp: boolean;
}

export interface Player {
  id: string;
  name: string;
  connected: boolean;
}

export interface GameState {
  players: Player[];
  cards: Card[];
  turnPlayerId: string | null;
  phase: 'waiting' | 'playing' | 'finished';
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Initial empty game state.
 */
export const initialGameState: GameState = {
  players: [],
  cards: [],
  turnPlayerId: null,
  phase: 'waiting',
};

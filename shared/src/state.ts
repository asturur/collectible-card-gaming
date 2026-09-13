/**
 * Game state shape shared between client and server.
 * Matches the Go server's state.go types exactly.
 */

export interface Player {
  name: string;
  life: number;
  connected: boolean;
}

export interface Card {
  instanceId: string;
  cardId: string;
  imageUrl: string;
  ownerId: string;
  zone: string;
  zoneIndex: number;
  x: number;
  y: number;
  rotation: number;
  faceDown: boolean;
  counters: Record<string, number>;
}

export interface GameState {
  players: Record<string, Player>;
  cards: Record<string, Card>;
  zones: Record<string, string[]>;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Creates an initial empty game state with empty maps.
 */
export function initialGameState(): GameState {
  return { players: {}, cards: {}, zones: {} };
}

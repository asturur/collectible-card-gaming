/**
 * WebSocket message envelope types matching the Go server's protocol.go.
 * All messages between client and server use these envelopes.
 */

import type { Action, SequencedAction } from './actions.js';
import type { GameState } from './state.js';

/**
 * Messages sent from client to server.
 */
export type ClientMessage =
  | { msg: 'ACTION'; action: Action }
  | { msg: 'UNDO'; seq: number }
  | { msg: 'PING' };

/**
 * Messages sent from server to client.
 */
export interface ServerMessage {
  msg: 'WELCOME' | 'STATE_SYNC' | 'ACTION_RESULT' | 'PLAYER_JOINED' | 'PLAYER_LEFT' | 'ERROR' | 'PONG';
  playerId?: string;
  playerName?: string;
  state?: GameState;
  log?: SequencedAction[];
  action?: SequencedAction;
  error?: string;
  refSeq?: number;
}

/**
 * WebSocket message envelope types.
 * All messages between client and server are wrapped in these envelopes.
 */

import type { GameAction } from './actions.js';
import type { GameState } from './state.js';

/**
 * Message sent from client to server.
 */
export interface ClientMessage {
  type: 'action';
  action: GameAction;
  sequence: number;
}

/**
 * Messages sent from server to client.
 */
export type ServerMessage =
  | ServerActionMessage
  | ServerStateMessage
  | ServerErrorMessage;

export interface ServerActionMessage {
  type: 'action';
  action: GameAction;
  sequence: number;
}

export interface ServerStateMessage {
  type: 'state';
  state: GameState;
}

export interface ServerErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

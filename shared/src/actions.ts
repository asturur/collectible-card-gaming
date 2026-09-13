/**
 * Game actions that can be dispatched by players.
 * These flow over WebSocket between client and server.
 */

export interface BaseAction {
  type: string;
  playerId: string;
  timestamp: number;
}

export interface JoinGameAction extends BaseAction {
  type: 'JOIN_GAME';
  payload: {
    playerName: string;
  };
}

export interface LeaveGameAction extends BaseAction {
  type: 'LEAVE_GAME';
}

export interface DrawCardAction extends BaseAction {
  type: 'DRAW_CARD';
}

export interface PlayCardAction extends BaseAction {
  type: 'PLAY_CARD';
  payload: {
    cardId: string;
    position: { x: number; y: number };
    zone: string;
  };
}

export interface MoveCardAction extends BaseAction {
  type: 'MOVE_CARD';
  payload: {
    cardId: string;
    position: { x: number; y: number };
    zone: string;
  };
}

/**
 * Union of all game actions.
 * Extend this as new actions are added.
 */
export type GameAction =
  | JoinGameAction
  | LeaveGameAction
  | DrawCardAction
  | PlayCardAction
  | MoveCardAction;

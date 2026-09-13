/**
 * Game action types matching the Go server's protocol.go constants.
 */

export const ActionTypes = {
  ADD_CARD: 'ADD_CARD',
  REMOVE_CARD: 'REMOVE_CARD',
  MOVE_CARD: 'MOVE_CARD',
  SET_CARD_POSITION: 'SET_CARD_POSITION',
  ROTATE_CARD: 'ROTATE_CARD',
  FLIP_CARD: 'FLIP_CARD',
  SHUFFLE_ZONE: 'SHUFFLE_ZONE',
  SET_ZONE_ORDER: 'SET_ZONE_ORDER',
  DRAW_CARD: 'DRAW_CARD',
  SET_COUNTER: 'SET_COUNTER',
  SET_PLAYER_LIFE: 'SET_PLAYER_LIFE',
  LOAD_DECK: 'LOAD_DECK',
  CLEAR_PLAYER_CARDS: 'CLEAR_PLAYER_CARDS',
} as const;

export interface Action {
  type: string;
  payload: Record<string, unknown>;
}

export interface SequencedAction extends Action {
  seq: number;
  playerId: string;
  timestamp: number;
  undo: Action;
}

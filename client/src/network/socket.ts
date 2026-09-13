import type { GameAction, ConnectionStatus } from '@zaff/shared';

/**
 * Interface for the game socket abstraction.
 * Implementations handle the actual WebSocket connection.
 */
export interface GameSocket {
  connect(address: string): void;
  disconnect(): void;
  send(action: GameAction): void;
  onMessage(handler: (action: GameAction) => void): void;
  onStatusChange(handler: (status: ConnectionStatus) => void): void;
}

/**
 * Mock implementation for development and testing.
 * Does not open a real WebSocket connection.
 */
export class MockGameSocket implements GameSocket {
  private messageHandlers: Array<(action: GameAction) => void> = [];
  private statusHandlers: Array<(status: ConnectionStatus) => void> = [];
  private _status: ConnectionStatus = 'disconnected';

  get status(): ConnectionStatus {
    return this._status;
  }

  connect(_address: string): void {
    this.setStatus('connecting');
    // Simulate async connection
    setTimeout(() => this.setStatus('connected'), 100);
  }

  disconnect(): void {
    this.setStatus('disconnected');
  }

  send(_action: GameAction): void {
    // Mock: no-op, could log or echo for testing
  }

  onMessage(handler: (action: GameAction) => void): void {
    this.messageHandlers.push(handler);
  }

  onStatusChange(handler: (status: ConnectionStatus) => void): void {
    this.statusHandlers.push(handler);
  }

  /** Simulate receiving a message (for tests). */
  simulateMessage(action: GameAction): void {
    this.messageHandlers.forEach((h) => h(action));
  }

  private setStatus(status: ConnectionStatus): void {
    this._status = status;
    this.statusHandlers.forEach((h) => h(status));
  }
}

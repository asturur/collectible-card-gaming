import type { Action, ServerMessage, ConnectionStatus, ClientMessage } from '@zaff/shared';

export type ServerMessageHandler = (message: ServerMessage) => void;
export type StatusChangeHandler = (status: ConnectionStatus) => void;

/**
 * Interface for the game socket abstraction.
 * Implementations handle the actual WebSocket connection.
 */
export interface GameSocket {
  connect(address: string, playerName: string): void;
  disconnect(): void;
  sendAction(action: Action): void;
  sendUndo(seq: number): void;
  sendPing(): void;
  onMessage(handler: ServerMessageHandler): void;
  onStatusChange(handler: StatusChangeHandler): void;
}

/**
 * Real WebSocket implementation that connects to the Go game server.
 */
export class WebSocketGameSocket implements GameSocket {
  private ws: WebSocket | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private messageHandlers: ServerMessageHandler[] = [];
  private statusHandlers: StatusChangeHandler[] = [];
  private _status: ConnectionStatus = 'disconnected';

  get status(): ConnectionStatus {
    return this._status;
  }

  connect(address: string, playerName: string): void {
    this.setStatus('connecting');

    // Auto-detect protocol: use wss:// for HTTPS origins (e.g. Cloudflare tunnels)
    const protocol = address.startsWith('https://') || address.startsWith('wss://')
      ? 'wss'
      : 'ws';
    const host = address
      .replace(/^https?:\/\//, '')
      .replace(/^wss?:\/\//, '')
      .replace(/\/+$/, '');
    const url = `${protocol}://${host}/ws?name=${encodeURIComponent(playerName)}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.setStatus('connected');
      // Send application-level pings every 15s to keep connection alive
      // through proxies, NATs, and Cloudflare tunnels
      this.pingInterval = setInterval(() => this.sendPing(), 15_000);
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data as string) as ServerMessage;
        this.messageHandlers.forEach((h) => h(message));
      } catch {
        // Ignore unparseable messages
      }
    };

    this.ws.onclose = () => {
      this.clearPing();
      this.setStatus('disconnected');
      this.ws = null;
    };

    this.ws.onerror = () => {
      this.setStatus('error');
    };
  }

  disconnect(): void {
    this.clearPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  sendAction(action: Action): void {
    this.send({ msg: 'ACTION', action });
  }

  sendUndo(seq: number): void {
    this.send({ msg: 'UNDO', seq });
  }

  sendPing(): void {
    this.send({ msg: 'PING' });
  }

  onMessage(handler: ServerMessageHandler): void {
    this.messageHandlers.push(handler);
  }

  onStatusChange(handler: StatusChangeHandler): void {
    this.statusHandlers.push(handler);
  }

  private send(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private clearPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this._status = status;
    this.statusHandlers.forEach((h) => h(status));
  }
}

/**
 * Mock implementation for development and testing.
 * Does not open a real WebSocket connection.
 */
export class MockGameSocket implements GameSocket {
  private messageHandlers: ServerMessageHandler[] = [];
  private statusHandlers: StatusChangeHandler[] = [];
  private _status: ConnectionStatus = 'disconnected';

  get status(): ConnectionStatus {
    return this._status;
  }

  connect(_address: string, _playerName: string): void {
    this.setStatus('connecting');
    // Simulate async connection
    setTimeout(() => this.setStatus('connected'), 100);
  }

  disconnect(): void {
    this.setStatus('disconnected');
  }

  sendAction(_action: Action): void {
    // Mock: no-op
  }

  sendUndo(_seq: number): void {
    // Mock: no-op
  }

  sendPing(): void {
    // Mock: no-op
  }

  onMessage(handler: ServerMessageHandler): void {
    this.messageHandlers.push(handler);
  }

  onStatusChange(handler: StatusChangeHandler): void {
    this.statusHandlers.push(handler);
  }

  /** Simulate receiving a server message (for tests). */
  simulateMessage(message: ServerMessage): void {
    this.messageHandlers.forEach((h) => h(message));
  }

  private setStatus(status: ConnectionStatus): void {
    this._status = status;
    this.statusHandlers.forEach((h) => h(status));
  }
}

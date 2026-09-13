import { useEffect, useRef, useState } from 'react';
import type { ConnectionStatus } from '@zaff/shared';
import { type GameSocket, MockGameSocket } from './socket';

/**
 * React hook for managing the game socket lifecycle.
 * Currently uses MockGameSocket; will be swapped for a real implementation in Plan 2.
 */
export function useSocket(serverAddress: string | null) {
  const socketRef = useRef<GameSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  useEffect(() => {
    if (!serverAddress) return;

    const socket = new MockGameSocket();
    socketRef.current = socket;

    socket.onStatusChange(setStatus);
    socket.connect(serverAddress);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [serverAddress]);

  return {
    socket: socketRef.current,
    status,
  };
}

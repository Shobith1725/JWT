import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useShieldStore } from '../store/useShieldStore';
import type { AttackEvent, BlockedIpRow, StatsSummary } from '../types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '';

export function useShieldSocket(apiBase: string): void {
  const setSocketConnected = useShieldStore((s) => s.setSocketConnected);

  useEffect(() => {
    // WebSocket disabled for stability - dashboard will fetch data via HTTP only
    setSocketConnected(false);
  }, [setSocketConnected]);
}

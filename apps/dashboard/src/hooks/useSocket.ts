import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useShieldStore } from '../store/useShieldStore';
import type { AttackEvent, StatsSummary } from '../types';

export function useShieldSocket(apiBase: string, activeApiKey: string): void {
  const setSocketConnected = useShieldStore((s) => s.setSocketConnected);
  const setSummary = useShieldStore((s) => s.setSummary);
  const prependEvent = useShieldStore((s) => s.prependEvent);
  const socketRef = useRef<Socket | null>(null);
  const apiKeyRef = useRef(activeApiKey);

  // Keep ref in sync so the socket callback always has the latest value
  useEffect(() => {
    apiKeyRef.current = activeApiKey;
  }, [activeApiKey]);

  useEffect(() => {
    // Avoid duplicate connections in StrictMode
    if (socketRef.current) return;

    const url = apiBase || window.location.origin;

    const socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('subscribe_stats');
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('connect_error', () => {
      setSocketConnected(false);
    });

    socket.on('stats_update', (data: StatsSummary) => {
      // Skip global stats when enterprise API key is active —
      // tenant-specific stats come from HTTP polling instead
      if (apiKeyRef.current) return;
      setSummary(data);
    });

    socket.on('attack_event', (data: AttackEvent) => {
      // In enterprise mode, ignore global events (tenant events come from polling)
      if (apiKeyRef.current) return;
      prependEvent(data);
    });

    socket.on('valid_event', (data: AttackEvent) => {
      if (apiKeyRef.current) return;
      prependEvent(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [apiBase, setSocketConnected, setSummary, prependEvent]);
}

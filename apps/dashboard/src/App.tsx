import { useCallback, useEffect, useState } from 'react';
import { useShieldStore } from './store/useShieldStore';
import { useShieldSocket } from './hooks/useSocket';
import { StatsCards } from './components/StatsCards';
import { LiveFeed } from './components/LiveFeed';
import { AttackBreakdown } from './components/AttackBreakdown';
import { IPBlocklist } from './components/IPBlocklist';
import { TokenInspector } from './components/TokenInspector';
import { EventLog } from './components/EventLog';
import type { AttackEvent, BlockedIpRow, StatsSummary } from './types';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

type View = 'overview' | 'ip' | 'inspector' | 'events';

const NAV_ITEMS: { id: View; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '◈' },
  { id: 'ip', label: 'IP Monitor', icon: '⊛' },
  { id: 'inspector', label: 'Token Inspector', icon: '⬡' },
  { id: 'events', label: 'Event Log', icon: '☰' },
];

export default function App() {
  const [view, setView] = useState<View>('overview');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [activeApiKey, setActiveApiKey] = useState(() => {
    // Load API key from localStorage on mount
    return localStorage.getItem('shield-api-key') ?? '';
  });

  const summary = useShieldStore((s) => s.summary);
  const events = useShieldStore((s) => s.events);
  const blockedIps = useShieldStore((s) => s.blockedIps);
  const socketConnected = useShieldStore((s) => s.socketConnected);
  const setSummary = useShieldStore((s) => s.setSummary);
  const setEvents = useShieldStore((s) => s.setEvents);
  const setBlockedIps = useShieldStore((s) => s.setBlockedIps);

  useShieldSocket(API_BASE);

  const buildHeaders = useCallback((): HeadersInit => {
    return activeApiKey ? { 'X-Shield-Key': activeApiKey } : {};
  }, [activeApiKey]);

  const refreshStatic = useCallback(async () => {
    const headers = buildHeaders();
    const [sRes, eRes, bRes] = await Promise.all([
      fetch(`${API_BASE}/api/stats/summary`, { headers }),
      fetch(`${API_BASE}/api/stats/events?limit=100`, { headers }),
      fetch(`${API_BASE}/api/stats/blocked-ips`, { headers }),
    ]);
    const s = (await sRes.json()) as StatsSummary;
    const e = (await eRes.json()) as AttackEvent[];
    const b = (await bRes.json()) as BlockedIpRow[];
    setSummary(s);
    setEvents(e);
    setBlockedIps(b);
  }, [setSummary, setEvents, setBlockedIps, buildHeaders]);

  const handleConnect = useCallback(() => {
    const key = apiKeyInput.trim();
    setActiveApiKey(key);
    localStorage.setItem('shield-api-key', key);
  }, [apiKeyInput]);

  const handleDisconnect = useCallback(() => {
    setActiveApiKey('');
    setApiKeyInput('');
    localStorage.removeItem('shield-api-key');
  }, []);

  useEffect(() => {
    void refreshStatic();
  }, [activeApiKey]); // Only re-fetch when activeApiKey changes, not when refreshStatic changes

  return (
    <div className="relative min-h-screen text-slate-100" style={{ background: '#060918' }}>
      {/* Animated background effects */}
      <div className="cyber-grid" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Header */}
      <header
        className="relative z-10 border-b border-white/[0.04]"
        style={{ background: 'rgba(6, 9, 24, 0.7)', backdropFilter: 'blur(20px)' }}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="relative flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.15), rgba(168, 85, 247, 0.15))',
                border: '1px solid rgba(0, 240, 255, 0.2)',
                boxShadow: '0 0 25px rgba(0, 240, 255, 0.1)',
              }}
            >
              <span className="text-lg" style={{ filter: 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.5))' }}>
                🛡️
              </span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white" style={{ letterSpacing: '0.05em' }}>
                JWT <span className="text-glow-cyan" style={{ color: 'var(--neon-cyan)' }}>SHIELD</span>
              </h1>
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
                Real-time Threat Intelligence
              </p>
            </div>
          </div>

          {/* Nav + controls */}
          <div className="flex flex-wrap items-center gap-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`nav-btn ${view === item.id ? 'nav-btn-active' : ''}`}
              >
                <span className="mr-1.5 opacity-60">{item.icon}</span>
                {item.label}
              </button>
            ))}

            <div className="ml-3 h-5 w-px bg-white/10" />

            {/* Enterprise API key */}
            {activeApiKey ? (
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-3 py-1.5 text-[11px] font-medium"
                  style={{
                    background: 'rgba(168, 85, 247, 0.08)',
                    color: '#c084fc',
                    border: '1px solid rgba(168, 85, 247, 0.2)',
                  }}
                >
                  ⬡ Enterprise
                </span>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-white/5"
                  style={{ color: '#64748b', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Enterprise API key…"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                  className="rounded-lg px-3 py-1.5 text-[11px] outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#e2e8f0',
                    width: '200px',
                  }}
                />
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={!apiKeyInput.trim()}
                  className="rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-40"
                  style={{
                    background: 'rgba(0, 240, 255, 0.1)',
                    border: '1px solid rgba(0, 240, 255, 0.2)',
                    color: 'var(--neon-cyan)',
                  }}
                >
                  Connect
                </button>
              </div>
            )}

            <div className="h-5 w-px bg-white/10" />

            <span
              className={`rounded-full px-3 py-1.5 text-[11px] font-medium ${
                socketConnected ? 'live-indicator' : 'live-indicator offline-indicator'
              }`}
              style={{
                background: socketConnected ? 'rgba(34, 255, 136, 0.08)' : 'rgba(255, 51, 102, 0.08)',
                color: socketConnected ? '#44ffaa' : '#ff6b8a',
                border: `1px solid ${socketConnected ? 'rgba(34, 255, 136, 0.15)' : 'rgba(255, 51, 102, 0.15)'}`,
              }}
            >
              {socketConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto max-w-7xl space-y-6 px-6 py-8">
        {view === 'overview' && (
          <div className="fade-in space-y-6">
            <StatsCards summary={summary} />
            <div className="grid gap-6 lg:grid-cols-2">
              <LiveFeed events={events} />
              <AttackBreakdown summary={summary} />
            </div>
          </div>
        )}
        {view === 'ip' && (
          <div className="fade-in">
            <IPBlocklist
              rows={blockedIps}
              apiBase={API_BASE}
              onUnblock={() => void refreshStatic()}
              extraHeaders={buildHeaders()}
            />
          </div>
        )}
        {view === 'inspector' && (
          <div className="fade-in">
            <TokenInspector apiBase={API_BASE} />
          </div>
        )}
        {view === 'events' && (
          <div className="fade-in">
            <EventLog events={events} />
          </div>
        )}
      </main>
    </div>
  );
}

import { attackColor } from './attackColors';
import type { AttackEvent } from '../types';

function eventColor(e: AttackEvent): string {
  if (e.event_type === 'JWT_REQUEST_VALID' || !e.blocked) return '#22ff88';
  return attackColor(String(e.attack_vector));
}

function eventLabel(e: AttackEvent): string {
  if (e.event_type === 'JWT_REQUEST_VALID' || !e.blocked) return 'VALID';
  return String(e.attack_vector);
}

export function LiveFeed({ events }: { events: AttackEvent[] }) {
  return (
    <div className="glass-card relative overflow-hidden">
      <div className="scanline" />
      <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-sm">📡</span>
          <h2 className="text-sm font-semibold text-white">Live Threat Feed</h2>
        </div>
        <span className="live-indicator rounded-full px-2.5 py-1 text-[10px] font-medium"
          style={{ background: 'rgba(34, 255, 136, 0.08)', color: '#44ffaa', border: '1px solid rgba(34, 255, 136, 0.12)' }}>
          LIVE
        </span>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-600">
            <span className="mb-2 text-3xl opacity-30">🛡️</span>
            <p className="text-xs">No events detected yet</p>
          </div>
        ) : (
          events.map((e, idx) => {
            const color = eventColor(e);
            const label = eventLabel(e);
            const isValid = e.event_type === 'JWT_REQUEST_VALID' || !e.blocked;

            return (
              <div
                key={`${e.timestamp}-${idx}`}
                className="slide-in flex gap-3 border-b border-white/[0.02] px-5 py-3 transition-colors hover:bg-white/[0.02]"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className="relative mt-1.5">
                  <span
                    className="pulse-dot block h-2 w-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-500">
                      {new Date(e.timestamp).toLocaleTimeString('en-IN', { hour12: false })}
                    </span>
                    <span
                      className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{
                        backgroundColor: `${color}15`,
                        color: color,
                        border: `1px solid ${color}25`,
                      }}
                    >
                      {isValid ? '✓' : '✕'} {label}
                    </span>
                    {isValid && e.subject && (
                      <span className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: 'rgba(34, 255, 136, 0.08)', color: '#88ffcc', border: '1px solid rgba(34, 255, 136, 0.12)' }}>
                        👤 {e.subject}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    <span className="font-mono text-slate-500">
                      {e.source_ip}
                    </span>
                    <span className="mx-1.5 text-slate-700">›</span>
                    <span className="text-slate-500">{e.detail ?? (isValid ? 'authenticated' : 'blocked')}</span>
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

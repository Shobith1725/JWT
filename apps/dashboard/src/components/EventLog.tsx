import { useMemo, useState } from 'react';
import { attackColor } from './attackColors';
import type { AttackEvent, AttackVector } from '../types';

const VECTORS: (AttackVector | 'all' | 'valid')[] = [
  'all',
  'valid',
  'none_exploit',
  'algorithm_downgrade',
  'kid_injection',
  'key_confusion',
  'replay_attack',
  'token_theft',
  'malformed',
  'invalid_signature',
  'invalid_claims',
];

function eventColorForRow(e: AttackEvent): string {
  if (e.event_type === 'JWT_REQUEST_VALID' || !e.blocked) return '#22ff88';
  return attackColor(String(e.attack_vector));
}

export function EventLog({ events }: { events: AttackEvent[] }) {
  const [vector, setVector] = useState<(typeof VECTORS)[number]>('all');
  const [ip, setIp] = useState('');

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (vector === 'valid') {
        if (e.event_type !== 'JWT_REQUEST_VALID' && e.blocked !== false) return false;
      } else if (vector !== 'all') {
        if (e.attack_vector !== vector) return false;
        if (e.event_type === 'JWT_REQUEST_VALID') return false;
      }
      if (ip.trim() && !e.source_ip.includes(ip.trim())) return false;
      return true;
    });
  }, [events, vector, ip]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">☰</span>
        <h2 className="text-lg font-bold text-white">Event Log</h2>
        <span className="ml-2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
          style={{ background: 'rgba(0, 240, 255, 0.08)', color: '#00f0ff', border: '1px solid rgba(0, 240, 255, 0.15)' }}>
          {filtered.length} events
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={vector}
          onChange={(e) => setVector(e.target.value as (typeof VECTORS)[number])}
          className="input-cyber text-sm"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          {VECTORS.map((v) => (
            <option key={v} value={v}>
              {v === 'all' ? '🔍 All events' : v === 'valid' ? '✅ Valid requests' : `🚫 ${v}`}
            </option>
          ))}
        </select>
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="🔎 Filter by IP..."
          className="input-cyber text-sm"
          style={{ fontFamily: 'Inter, sans-serif', minWidth: 180 }}
        />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
              <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Time</th>
              <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Status</th>
              <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Source IP</th>
              <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Detail</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center text-slate-600">
                    <span className="mb-2 text-3xl opacity-30">📭</span>
                    <p className="text-xs">No events match filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((e, i) => {
                const isValid = e.event_type === 'JWT_REQUEST_VALID' || !e.blocked;
                const color = eventColorForRow(e);
                const label = isValid ? 'VALID' : String(e.attack_vector);

                return (
                  <tr key={`${e.timestamp}-${i}`} className="table-row-hover border-t border-white/[0.03]">
                    <td className="px-5 py-3 font-mono text-[11px] text-slate-500">
                      {new Date(e.timestamp).toLocaleTimeString('en-IN', { hour12: false })}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
                        style={{
                          backgroundColor: `${color}12`,
                          color: color,
                          border: `1px solid ${color}25`,
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                        {isValid ? '✓' : '✕'} {label}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs font-medium text-slate-300">{e.source_ip}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {e.detail ?? (isValid ? 'authenticated' : '—')}
                      {isValid && e.subject && (
                        <span className="ml-2 text-[10px] font-medium" style={{ color: '#88ffcc' }}>
                          👤 {e.subject}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import type { StatsSummary } from '../types';

const ICONS = ['⚡', '✅', '🚫', '📊', '⏱'];
const GLOWS = ['stat-glow-cyan', 'stat-glow-green', 'stat-glow-red', 'stat-glow-orange', 'stat-glow-purple'];
const COLORS = ['#00f0ff', '#22ff88', '#ff3366', '#ff8800', '#a855f7'];

export function StatsCards({ summary }: { summary: StatsSummary | null }) {
  if (!summary) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="glass-card shimmer h-28" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Total Requests', value: summary.total_requests.toLocaleString(), sub: 'Incoming traffic' },
    { label: 'Valid Accepted', value: (summary.total_valid ?? 0).toLocaleString(), sub: 'Tokens authenticated' },
    { label: 'Threats Blocked', value: summary.total_blocked.toLocaleString(), sub: 'Attacks neutralized' },
    { label: 'Block Rate', value: `${summary.block_rate_percent}%`, sub: 'Protection efficiency' },
    {
      label: 'Uptime',
      value: `${Math.floor(summary.uptime_seconds / 3600)}h ${Math.floor((summary.uptime_seconds % 3600) / 60)}m`,
      sub: 'Shield active',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
      {cards.map((c, i) => (
        <div
          key={c.label}
          className={`glass-card ${GLOWS[i]} p-5 transition-all duration-300`}
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: COLORS[i], opacity: 0.8 }}>
              {c.label}
            </p>
            <span className="text-lg" style={{ filter: `drop-shadow(0 0 8px ${COLORS[i]})` }}>
              {ICONS[i]}
            </span>
          </div>
          <p className="text-3xl font-bold text-white" style={{ textShadow: `0 0 30px ${COLORS[i]}30` }}>
            {c.value}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

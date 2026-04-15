import type { BlockedIpRow } from '../types';

export function IPBlocklist({
  rows,
  apiBase,
  onUnblock,
  extraHeaders = {},
}: {
  rows: BlockedIpRow[];
  apiBase: string;
  onUnblock?: () => void;
  extraHeaders?: HeadersInit;
}) {
  const unblock = async (ip: string) => {
    await fetch(`${apiBase}/api/stats/unblock-ip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(extraHeaders as Record<string, string>) },
      body: JSON.stringify({ ip }),
    });
    onUnblock?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">⊛</span>
        <h2 className="text-lg font-bold text-white">IP Threat Monitor</h2>
        <span className="ml-2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
          style={{
            background: rows.length > 0 ? 'rgba(255, 51, 102, 0.1)' : 'rgba(34, 255, 136, 0.1)',
            color: rows.length > 0 ? '#ff6b8a' : '#44ffaa',
            border: `1px solid ${rows.length > 0 ? 'rgba(255, 51, 102, 0.2)' : 'rgba(34, 255, 136, 0.2)'}`,
          }}>
          {rows.length} blocked
        </span>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
              <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">IP Address</th>
              <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Reason</th>
              <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Status</th>
              <th className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Expires</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center text-slate-600">
                    <span className="mb-2 text-3xl opacity-30">✓</span>
                    <p className="text-xs">No blocked IPs — all clear</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.ip} className="table-row-hover border-t border-white/[0.03]"
                  style={{ animationDelay: `${i * 50}ms` }}>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-sm font-medium text-white">{r.ip}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs text-slate-400">{r.reason}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    {r.permanent ? (
                      <span className="badge-danger rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide">
                        ⛔ Permanent
                      </span>
                    ) : (
                      <span className="badge-warning rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide">
                        ⏳ Temporary
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-500">
                    {r.expiresAt ? new Date(r.expiresAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => void unblock(r.ip)}
                      className="btn-ghost"
                    >
                      Unblock
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

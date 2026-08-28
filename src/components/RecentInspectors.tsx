'use client';

import { dbService } from '@/lib/db';

export function RecentInspectors({ vehicleId }: { vehicleId: string }) {
  const depth = dbService.getAppSettings().recentInspectorsDepth;
  const rows = dbService.getRecentInspectors(vehicleId, depth);

  if (rows.length === 0) {
    return <p className="text-xs text-ink-muted">No completed inspections yet.</p>;
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
        Recent inspectors (last {depth})
      </div>
      <ul className="space-y-1">
        {rows.map(row => (
          <li
            key={row.inspectionId}
            className="flex justify-between gap-2 text-xs text-ink"
          >
            <span className="font-semibold">{row.userName}</span>
            <span className="text-right text-ink-muted">
              {new Date(row.submittedAt).toLocaleString()} · {row.status.replace('_', ' ')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

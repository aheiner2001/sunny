'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { dbService } from '@/lib/db';
import type { PreviousUserFlag } from '@/types';

export default function PreviousUserFlagGate({
  employeeId,
  children,
}: {
  employeeId: string | null | undefined;
  children: React.ReactNode;
}) {
  const [openFlags, setOpenFlags] = useState<PreviousUserFlag[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    if (!employeeId) {
      setOpenFlags([]);
      return;
    }
    setOpenFlags(dbService.getOpenPreviousUserFlagsForEmployee(employeeId));
  }, [employeeId]);

  useEffect(() => {
    refresh();
    window.addEventListener('sunny_db_update', refresh);
    return () => window.removeEventListener('sunny_db_update', refresh);
  }, [refresh]);

  const acknowledge = async () => {
    if (!employeeId || busy) return;
    setBusy(true);
    setError('');
    try {
      await dbService.acknowledgePreviousUserFlags(employeeId);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not acknowledge flags. Retry.');
    } finally {
      setBusy(false);
    }
  };

  if (!employeeId || openFlags.length === 0) return <>{children}</>;

  return (
    <div className="page max-w-xl mx-auto space-y-4" role="dialog" aria-labelledby="previous-user-flag-title">
      <div className="card card-pad space-y-4 border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30">
        <div className="flex items-start gap-3">
          <span className="icon-tile bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 id="previous-user-flag-title" className="card-title text-lg">
              Previous-use feedback
            </h1>
            <p className="text-sm text-ink-muted m-0">
              Before you continue, review what you were flagged for. Acknowledge to proceed with this scan.
            </p>
          </div>
        </div>

        <ul className="space-y-3 m-0 p-0 list-none">
          {openFlags.map(flag => (
            <li key={flag.id} className="rounded-xl border border-line bg-surface p-3 space-y-1">
              <p className="text-sm font-semibold m-0">{flag.questionText}</p>
              <p className="text-xs text-ink-muted m-0">
                Last time you used truck {flag.vehicleNumber}, you were flagged for not completing this.
              </p>
              {flag.message ? (
                <p className="text-xs m-0 pt-1 border-t border-line text-ink">
                  <span className="font-semibold">Measures: </span>
                  {flag.message}
                </p>
              ) : null}
            </li>
          ))}
        </ul>

        {error ? (
          <p className="text-sm text-[var(--critical)] m-0" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={busy}
          aria-busy={busy}
          onClick={() => void acknowledge()}
        >
          {busy ? 'Saving…' : 'Acknowledge'}
        </button>
      </div>
    </div>
  );
}

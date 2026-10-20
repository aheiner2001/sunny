'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import { dbService } from '@/lib/db';
import { timesheetStore } from '@/lib/timesheets/timesheetStore';
import {
  buildHistoricalEstimates,
  isMissingReturnManualEndEligible,
  type HistoricalEstimate,
} from '@/lib/timesheets/historicalRecovery';
import {
  recoverHistoricalEstimate,
  recoverHistoricalEstimateWithManualEnd,
} from '@/lib/timesheets/historicalRecoveryService';
import { DEFAULT_TIMEZONE } from '@/lib/timesheets/timeCalculations';

export default function HistoricalHoursRecovery({ actor, weekStartUtc, weekEndUtc }: {
  actor: { id: string; name: string }; weekStartUtc: string; weekEndUtc: string;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<HistoricalEstimate[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [manualEnds, setManualEnds] = useState<Record<string, string>>({});
  const refresh = useCallback(() => {
    try {
      const estimates = buildHistoricalEstimates(dbService.getInspections(), timesheetStore.getAllShifts(),
        timesheetStore.getAllCorrectionRequests(), dbService.getMissedReturns());
      setRows(estimates.filter(row => {
        const day = DateTime.fromISO(row.date, { zone: DEFAULT_TIMEZONE }).toMillis();
        return day >= Date.parse(weekStartUtc) && day <= Date.parse(weekEndUtc);
      }));
    } catch { setMessage('Could not read inspection history. Refresh the page and try again.'); }
  }, [weekStartUtc, weekEndUtc]);
  useEffect(() => {
    if (!open) return;
    refresh();
    window.addEventListener('sunny_db_update', refresh);
    window.addEventListener('sunny_timesheet_update', refresh);
    return () => {
      window.removeEventListener('sunny_db_update', refresh);
      window.removeEventListener('sunny_timesheet_update', refresh);
    };
  }, [open, refresh]);
  const add = async (row: HistoricalEstimate) => {
    if (!row.inspectionId || saving) return;
    setSaving(row.id);
    setMessage('');
    try {
      await recoverHistoricalEstimate(row.inspectionId, actor);
      setMessage(`Added ${row.employeeName}’s estimated hours as pending. Use Edit to verify times and unpaid breaks before approving.`);
      refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Estimate was not saved. Please retry.'); }
    finally { setSaving(null); }
  };
  const addWithManualEnd = async (row: HistoricalEstimate) => {
    if (!row.inspectionId || saving) return;
    const endAtUtc = DateTime.fromISO(manualEnds[row.id] || '', { zone: DEFAULT_TIMEZONE }).toUTC().toISO();
    if (!endAtUtc) {
      setMessage('Enter a valid end time.');
      return;
    }
    setSaving(row.id);
    setMessage('');
    try {
      await recoverHistoricalEstimateWithManualEnd(row.inspectionId, endAtUtc, actor);
      setMessage(`Added ${row.employeeName}’s estimated hours as pending. Use Edit to verify times and unpaid breaks before approving.`);
      refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Estimate was not saved. Please retry.'); }
    finally { setSaving(null); }
  };
  const time = (value: string | null) => value ? DateTime.fromISO(value).setZone(DEFAULT_TIMEZONE).toFormat('h:mm a') : 'Missing';
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
      <button type="button" className="btn btn-secondary btn-sm" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        Recover historical hours
      </button>
      {open && <>
        <h3 className="font-semibold">Estimated hours from inspection history</h3>
        <p className="text-sm text-slate-500">For the selected week, using loaded inspection records. Estimates need manager review and exclude unpaid breaks.
          A submission time may miss time spent inspecting. Missing, overnight, or ambiguous records need manual review; use Request Missing Hours for those.</p>
        {message && <p role="status" className="text-sm font-medium">{message}</p>}
        {rows.length === 0 ? <p className="text-sm">No inspection history found for this week. Select an earlier week to look further back.</p> :
          <div className="overflow-x-auto"><table className="w-full text-sm text-left">
            <caption className="sr-only">Historical estimates requiring manager review</caption>
            <thead><tr><th className="p-2">Employee / vehicle</th><th className="p-2">Date</th>
              <th className="p-2">Inspection</th><th className="p-2">Return submitted</th><th className="p-2">Before breaks</th><th className="p-2">Review</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="p-2">{row.employeeName}<span className="block text-xs text-slate-500">Vehicle {row.vehicleNumber}</span></td>
              <td className="p-2 whitespace-nowrap">{row.date}</td>
              <td className="p-2">{time(row.startAtUtc)}<span className="block text-xs text-slate-500">{row.startBasis}</span></td>
              <td className="p-2">{time(row.endAtUtc)}</td>
              <td className="p-2 whitespace-nowrap">{row.elapsedSeconds === null ? 'Not estimated' :
                `${Math.floor(row.elapsedSeconds / 3600)}h ${Math.floor(row.elapsedSeconds % 3600 / 60)}m`}</td>
              <td className="p-2 max-w-sm"><p className="text-xs mb-2">{row.reason}</p>
                {row.state === 'ready' && <button type="button" className="btn btn-secondary btn-sm" disabled={saving !== null}
                  aria-label={`Add ${row.employeeName} for review`} onClick={() => void add(row)}>
                  {saving === row.id ? 'Saving…' : 'Add for review'}
                </button>}
                {isMissingReturnManualEndEligible(row) && <>
                  <input type="datetime-local" aria-label={`End time for ${row.employeeName}`}
                    className="input input-bordered input-sm mb-2 block" value={manualEnds[row.id] || ''}
                    onChange={event => setManualEnds(values => ({ ...values, [row.id]: event.target.value }))} />
                  <button type="button" className="btn btn-secondary btn-sm"
                    disabled={saving !== null || !manualEnds[row.id]} onClick={() => void addWithManualEnd(row)}>
                    {saving === row.id ? 'Saving…' : 'Add with end time'}
                  </button>
                </>}
              </td>
            </tr>)}</tbody>
          </table></div>}
      </>}
    </section>
  );
}

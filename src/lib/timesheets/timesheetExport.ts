import { DateTime } from 'luxon';
import { calculateNetSeconds, DEFAULT_TIMEZONE, formatSecondsToHours } from './timeCalculations';
import type { ShiftRecord } from './types';

const HEADERS = [
  'Employee',
  'Date',
  'Start',
  'End',
  'Break Minutes',
  'Net Hours',
  'Status',
  'Source',
  'Shift ID',
] as const;

function csvCell(value: string | number): string {
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function localParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const dt = DateTime.fromISO(iso, { zone: DEFAULT_TIMEZONE });
  if (!dt.isValid) return { date: '', time: '' };
  return { date: dt.toFormat('yyyy-LL-dd'), time: dt.toFormat('HH:mm') };
}

export function shiftsToCsv(shifts: ShiftRecord[]): string {
  const rows = shifts.map(shift => {
    const start = localParts(shift.startAtUtc);
    const end = localParts(shift.endAtUtc);
    const net =
      shift.endAtUtc != null
        ? formatSecondsToHours(
            calculateNetSeconds(shift.startAtUtc, shift.endAtUtc, shift.unpaidBreakSeconds),
          )
        : 'In Progress';
    const source = shift.recovery ? 'Estimated from inspections' : shift.startSource;
    return [
      shift.employeeName,
      start.date,
      start.time,
      shift.endAtUtc ? end.time : 'In Progress',
      Math.round(shift.unpaidBreakSeconds / 60),
      net,
      shift.status,
      source,
      shift.id,
    ].map(csvCell).join(',');
  });
  return [HEADERS.map(csvCell).join(','), ...rows].join('\n');
}

export function downloadTimesheetCsv(shifts: ShiftRecord[], filename: string): void {
  const blob = new Blob([shiftsToCsv(shifts)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

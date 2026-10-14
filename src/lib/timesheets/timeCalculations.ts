import { DateTime } from 'luxon';
import type { ShiftRecord } from './types';

export const DEFAULT_TIMEZONE = 'America/Denver';

export function calculateNetSeconds(startUtc: string, endUtc: string, unpaidBreakSeconds = 0): number {
  const start = DateTime.fromISO(startUtc, { zone: 'utc' });
  const end = DateTime.fromISO(endUtc, { zone: 'utc' });
  if (!start.isValid || !end.isValid) return 0;
  const elapsedSeconds = Math.max(0, Math.floor(end.diff(start, 'seconds').seconds));
  return Math.max(0, elapsedSeconds - Math.max(0, unpaidBreakSeconds));
}

export function validateShiftInterval(
  startUtc: string,
  endUtc: string,
  unpaidBreakSeconds = 0
): { valid: boolean; error?: string } {
  const start = DateTime.fromISO(startUtc, { zone: 'utc' });
  const end = DateTime.fromISO(endUtc, { zone: 'utc' });

  if (!start.isValid || !end.isValid) {
    return { valid: false, error: 'Invalid start or end timestamp.' };
  }
  if (end <= start) {
    return { valid: false, error: 'Shift end time must be strictly after start time.' };
  }
  const elapsed = Math.floor(end.diff(start, 'seconds').seconds);
  if (unpaidBreakSeconds < 0) {
    return { valid: false, error: 'Unpaid break duration cannot be negative.' };
  }
  if (unpaidBreakSeconds > 0 && unpaidBreakSeconds >= elapsed) {
    return { valid: false, error: 'Unpaid break cannot meet or exceed total elapsed shift duration.' };
  }
  return { valid: true };
}

export function hasShiftOverlap(
  existingShifts: ShiftRecord[],
  candidate: { startAtUtc: string; endAtUtc: string; id?: string }
): boolean {
  const candStart = DateTime.fromISO(candidate.startAtUtc, { zone: 'utc' }).toMillis();
  const candEnd = DateTime.fromISO(candidate.endAtUtc, { zone: 'utc' }).toMillis();

  for (const s of existingShifts) {
    if (candidate.id && s.id === candidate.id) continue;
    if (!s.endAtUtc) continue;
    const sStart = DateTime.fromISO(s.startAtUtc, { zone: 'utc' }).toMillis();
    const sEnd = DateTime.fromISO(s.endAtUtc, { zone: 'utc' }).toMillis();

    // Overlap condition: startA < endB && startB < endA
    if (candStart < sEnd && sStart < candEnd) {
      return true;
    }
  }
  return false;
}

export function splitShiftAtWeekBoundary(
  shift: ShiftRecord,
  boundaryUtc: string
): { weekAShift: ShiftRecord; weekBShift: ShiftRecord } | null {
  if (!shift.endAtUtc) return null;
  const start = DateTime.fromISO(shift.startAtUtc, { zone: 'utc' });
  const end = DateTime.fromISO(shift.endAtUtc, { zone: 'utc' });
  const boundary = DateTime.fromISO(boundaryUtc, { zone: 'utc' });

  if (!start.isValid || !end.isValid || !boundary.isValid) return null;
  if (start >= boundary || end <= boundary) return null;

  const totalElapsed = end.diff(start, 'seconds').seconds;
  const elapsedA = boundary.diff(start, 'seconds').seconds;
  if (totalElapsed <= 0) return null;

  const breakA = Math.round(shift.unpaidBreakSeconds * (elapsedA / totalElapsed));
  const breakB = Math.max(0, shift.unpaidBreakSeconds - breakA);

  const weekAShift: ShiftRecord = {
    ...shift,
    endAtUtc: boundary.toUTC().toISO()!,
    unpaidBreakSeconds: breakA,
  };

  const weekBShift: ShiftRecord = {
    ...shift,
    id: `${shift.id}-split-b`,
    startAtUtc: boundary.toUTC().toISO()!,
    unpaidBreakSeconds: breakB,
  };

  return { weekAShift, weekBShift };
}

export function formatSecondsToHours(seconds: number): string {
  const hours = seconds / 3600;
  return hours.toFixed(2);
}

export function getWeekBoundariesUtc(
  anchor: Date | string,
  timeZone = DEFAULT_TIMEZONE
): { weekStartUtc: string; weekEndUtc: string } {
  const dt = typeof anchor === 'string' 
    ? DateTime.fromISO(anchor, { zone: timeZone })
    : DateTime.fromJSDate(anchor, { zone: timeZone });

  // Luxon weekday: 1 = Monday, 7 = Sunday
  const monday = dt.startOf('day').minus({ days: dt.weekday - 1 });
  const sunday = monday.plus({ days: 7 }).minus({ milliseconds: 1 });

  return {
    weekStartUtc: monday.toUTC().toISO()!,
    weekEndUtc: sunday.toUTC().toISO()!,
  };
}

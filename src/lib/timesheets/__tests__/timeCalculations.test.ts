import { describe, it, expect } from 'vitest';
import {
  calculateNetSeconds,
  validateShiftInterval,
  hasShiftOverlap,
  splitShiftAtWeekBoundary,
  formatSecondsToHours,
  getWeekBoundariesUtc,
  isEveningTime,
  DEFAULT_TIMEZONE,
} from '../timeCalculations';
import type { ShiftRecord } from '../types';

describe('timeCalculations', () => {
  describe('calculateNetSeconds', () => {
    it('calculates net seconds correctly subtracting unpaid break', () => {
      // 8 hours shift (28800s) with 30 min break (1800s) = 27000s (7.5h)
      const start = '2026-10-14T14:00:00.000Z';
      const end = '2026-10-14T22:00:00.000Z';
      const net = calculateNetSeconds(start, end, 1800);
      expect(net).toBe(27000);
      expect(formatSecondsToHours(net)).toBe('7.50');
    });

    it('defaults unpaid break to 0 when not provided', () => {
      const start = '2026-10-14T14:00:00.000Z';
      const end = '2026-10-14T18:00:00.000Z'; // 4 hours = 14400s
      expect(calculateNetSeconds(start, end)).toBe(14400);
    });

    it('returns 0 for invalid dates or end before start', () => {
      expect(calculateNetSeconds('invalid', '2026-10-14T14:00:00.000Z', 0)).toBe(0);
      expect(calculateNetSeconds('2026-10-14T14:00:00.000Z', 'invalid', 0)).toBe(0);
      expect(calculateNetSeconds('2026-10-14T16:00:00.000Z', '2026-10-14T14:00:00.000Z', 0)).toBe(0);
    });

    it('returns 0 if break exceeds duration', () => {
      const start = '2026-10-14T14:00:00.000Z';
      const end = '2026-10-14T15:00:00.000Z'; // 1 hour = 3600s
      expect(calculateNetSeconds(start, end, 5000)).toBe(0);
    });
  });

  describe('validateShiftInterval', () => {
    it('rejects end before start or zero-length shifts', () => {
      const start = '2026-10-14T14:00:00.000Z';
      const endBefore = '2026-10-14T13:00:00.000Z';
      expect(validateShiftInterval(start, endBefore, 0).valid).toBe(false);
      expect(validateShiftInterval(start, start, 0).valid).toBe(false);
    });

    it('rejects negative break or break exceeding duration', () => {
      const start = '2026-10-14T14:00:00.000Z';
      const end = '2026-10-14T18:00:00.000Z'; // 4 hours = 14400s
      expect(validateShiftInterval(start, end, -300).valid).toBe(false);
      expect(validateShiftInterval(start, end, 15000).valid).toBe(false);
    });

    it('rejects break equal to total elapsed duration', () => {
      const start = '2026-10-14T14:00:00.000Z';
      const end = '2026-10-14T18:00:00.000Z'; // 14400s
      expect(validateShiftInterval(start, end, 14400).valid).toBe(false);
    });

    it('rejects invalid ISO dates', () => {
      expect(validateShiftInterval('not-a-date', '2026-10-14T18:00:00.000Z').valid).toBe(false);
      expect(validateShiftInterval('2026-10-14T14:00:00.000Z', 'not-a-date').valid).toBe(false);
    });

    it('accepts valid shift interval', () => {
      const start = '2026-10-14T14:00:00.000Z';
      const end = '2026-10-14T18:00:00.000Z';
      expect(validateShiftInterval(start, end, 1800)).toEqual({ valid: true });
    });
  });

  describe('hasShiftOverlap', () => {
    const existing: ShiftRecord[] = [
      {
        id: 's-1',
        employeeId: 'u-1',
        employeeName: 'User',
        locationId: 'loc-main',
        status: 'approved',
        timeZone: 'America/Denver',
        startAtUtc: '2026-10-14T14:00:00.000Z',
        endAtUtc: '2026-10-14T18:00:00.000Z',
        unpaidBreakSeconds: 0,
        startSource: 'qr',
        endSource: 'checklist_return',
        startEventId: 'e-1',
        endEventId: 'e-2',
        revision: 1,
        createdAt: '2026-10-14T14:00:00.000Z',
        updatedAt: '2026-10-14T18:00:00.000Z',
        submittedAt: '2026-10-14T18:00:00.000Z',
        approvedAt: '2026-10-14T18:30:00.000Z',
        approvedBy: 'mgr-1',
      },
    ];

    it('detects overlapping shifts but allows adjacent shifts sharing endpoint', () => {
      // Overlap (16:00 - 20:00 overlaps 14:00 - 18:00)
      expect(hasShiftOverlap(existing, { startAtUtc: '2026-10-14T16:00:00.000Z', endAtUtc: '2026-10-14T20:00:00.000Z' })).toBe(true);

      // Overlap completely inside existing
      expect(hasShiftOverlap(existing, { startAtUtc: '2026-10-14T15:00:00.000Z', endAtUtc: '2026-10-14T17:00:00.000Z' })).toBe(true);

      // Overlap completely enveloping existing
      expect(hasShiftOverlap(existing, { startAtUtc: '2026-10-14T13:00:00.000Z', endAtUtc: '2026-10-14T19:00:00.000Z' })).toBe(true);

      // Exact adjacent sharing start endpoint (10:00 to 14:00) -> allowed
      expect(hasShiftOverlap(existing, { startAtUtc: '2026-10-14T10:00:00.000Z', endAtUtc: '2026-10-14T14:00:00.000Z' })).toBe(false);

      // Exact adjacent sharing end endpoint (18:00 to 22:00) -> allowed
      expect(hasShiftOverlap(existing, { startAtUtc: '2026-10-14T18:00:00.000Z', endAtUtc: '2026-10-14T22:00:00.000Z' })).toBe(false);
    });

    it('ignores the shift itself when candidate.id is provided for edit operations', () => {
      expect(hasShiftOverlap(existing, {
        id: 's-1',
        startAtUtc: '2026-10-14T14:00:00.000Z',
        endAtUtc: '2026-10-14T18:00:00.000Z',
      })).toBe(false);
    });

    it('ignores existing shifts that have null endAtUtc', () => {
      const activeShift: ShiftRecord = {
        ...existing[0],
        id: 's-active',
        endAtUtc: null,
      };
      expect(hasShiftOverlap([activeShift], {
        startAtUtc: '2026-10-14T15:00:00.000Z',
        endAtUtc: '2026-10-14T17:00:00.000Z',
      })).toBe(false);
    });
  });

  describe('splitShiftAtWeekBoundary', () => {
    it('allocates breaks proportionally when splitting across week boundary', () => {
      // Week boundary in Denver on Monday 00:00 local (e.g. 2026-10-19T06:00:00.000Z in MDT UTC-6)
      // Shift from 2026-10-19T04:00:00.000Z (2 hours in week A) to 2026-10-19T10:00:00.000Z (4 hours in week B)
      // Total elapsed = 6 hours (21600s), break = 1800s (30m)
      // Ratio = 2/6 = 1/3 in week A (600s break), 2/3 in week B (1200s break)
      const shift: ShiftRecord = {
        id: 'cross-week',
        employeeId: 'u-1',
        employeeName: 'User',
        locationId: 'loc-main',
        status: 'pending',
        timeZone: 'America/Denver',
        startAtUtc: '2026-10-19T04:00:00.000Z',
        endAtUtc: '2026-10-19T10:00:00.000Z',
        unpaidBreakSeconds: 1800,
        startSource: 'manual',
        endSource: 'manual',
        startEventId: 'e-1',
        endEventId: 'e-2',
        revision: 1,
        createdAt: '2026-10-19T04:00:00.000Z',
        updatedAt: '2026-10-19T10:00:00.000Z',
        submittedAt: '2026-10-19T10:00:00.000Z',
        approvedAt: null,
        approvedBy: null,
      };

      const split = splitShiftAtWeekBoundary(shift, '2026-10-19T06:00:00.000Z');
      expect(split).not.toBeNull();
      if (split) {
        expect(split.weekAShift.unpaidBreakSeconds).toBe(600);
        expect(split.weekBShift.unpaidBreakSeconds).toBe(1200);
        expect(split.weekAShift.unpaidBreakSeconds + split.weekBShift.unpaidBreakSeconds).toBe(1800);
        expect(split.weekAShift.startAtUtc).toBe('2026-10-19T04:00:00.000Z');
        expect(split.weekAShift.endAtUtc).toBe('2026-10-19T06:00:00.000Z');
        expect(split.weekBShift.startAtUtc).toBe('2026-10-19T06:00:00.000Z');
        expect(split.weekBShift.endAtUtc).toBe('2026-10-19T10:00:00.000Z');
        expect(split.weekBShift.id).toBe('cross-week-split-b');
      }
    });

    it('returns null if shift does not cross the boundary', () => {
      const shift: ShiftRecord = {
        id: 's-inside',
        employeeId: 'u-1',
        employeeName: 'User',
        locationId: 'loc-main',
        status: 'pending',
        timeZone: 'America/Denver',
        startAtUtc: '2026-10-19T07:00:00.000Z',
        endAtUtc: '2026-10-19T10:00:00.000Z',
        unpaidBreakSeconds: 0,
        startSource: 'manual',
        endSource: 'manual',
        startEventId: 'e-1',
        endEventId: 'e-2',
        revision: 1,
        createdAt: '2026-10-19T07:00:00.000Z',
        updatedAt: '2026-10-19T10:00:00.000Z',
        submittedAt: '2026-10-19T10:00:00.000Z',
        approvedAt: null,
        approvedBy: null,
      };

      expect(splitShiftAtWeekBoundary(shift, '2026-10-19T06:00:00.000Z')).toBeNull();
    });

    it('returns null if shift endAtUtc is null or dates are invalid', () => {
      const shift: ShiftRecord = {
        id: 's-open',
        employeeId: 'u-1',
        employeeName: 'User',
        locationId: 'loc-main',
        status: 'active',
        timeZone: 'America/Denver',
        startAtUtc: '2026-10-19T04:00:00.000Z',
        endAtUtc: null,
        unpaidBreakSeconds: 0,
        startSource: 'qr',
        endSource: null,
        startEventId: 'e-1',
        endEventId: null,
        revision: 1,
        createdAt: '2026-10-19T04:00:00.000Z',
        updatedAt: '2026-10-19T04:00:00.000Z',
        submittedAt: null,
        approvedAt: null,
        approvedBy: null,
      };

      expect(splitShiftAtWeekBoundary(shift, '2026-10-19T06:00:00.000Z')).toBeNull();
      expect(splitShiftAtWeekBoundary({ ...shift, endAtUtc: 'invalid' }, '2026-10-19T06:00:00.000Z')).toBeNull();
    });
  });

  describe('formatSecondsToHours', () => {
    it('formats seconds to 2 decimal places', () => {
      expect(formatSecondsToHours(0)).toBe('0.00');
      expect(formatSecondsToHours(3600)).toBe('1.00');
      expect(formatSecondsToHours(5400)).toBe('1.50');
      expect(formatSecondsToHours(27000)).toBe('7.50');
      expect(formatSecondsToHours(27300)).toBe('7.58');
    });
  });

  describe('getWeekBoundariesUtc', () => {
    it('determines week boundaries starting Monday 00:00:00 America/Denver', () => {
      // 2026-10-14 is a Wednesday.
      // Monday is 2026-10-12 00:00:00 MDT (UTC-6) -> 2026-10-12T06:00:00.000Z
      // Sunday is 2026-10-18 23:59:59.999 MDT (UTC-6) -> 2026-10-19T05:59:59.999Z
      const { weekStartUtc, weekEndUtc } = getWeekBoundariesUtc('2026-10-14T12:00:00.000Z', 'America/Denver');
      expect(weekStartUtc).toBe('2026-10-12T06:00:00.000Z');
      expect(weekEndUtc).toBe('2026-10-19T05:59:59.999Z');
      expect(new Date(weekEndUtc).getTime()).toBeGreaterThan(new Date(weekStartUtc).getTime());
    });

    it('works with Date objects and uses DEFAULT_TIMEZONE', () => {
      const date = new Date('2026-10-14T12:00:00.000Z');
      const { weekStartUtc, weekEndUtc } = getWeekBoundariesUtc(date);
      expect(weekStartUtc).toBe('2026-10-12T06:00:00.000Z');
      expect(weekEndUtc).toBe('2026-10-19T05:59:59.999Z');
      expect(DEFAULT_TIMEZONE).toBe('America/Denver');
    });

    it('handles Sunday correctly as end of week', () => {
      // 2026-10-18 is Sunday
      const { weekStartUtc, weekEndUtc } = getWeekBoundariesUtc('2026-10-18T20:00:00.000Z', 'America/Denver');
      expect(weekStartUtc).toBe('2026-10-12T06:00:00.000Z');
      expect(weekEndUtc).toBe('2026-10-19T05:59:59.999Z');
    });

    it('handles Monday correctly as start of week', () => {
      // 2026-10-12 is Monday
      const { weekStartUtc, weekEndUtc } = getWeekBoundariesUtc('2026-10-12T10:00:00.000Z', 'America/Denver');
      expect(weekStartUtc).toBe('2026-10-12T06:00:00.000Z');
      expect(weekEndUtc).toBe('2026-10-19T05:59:59.999Z');
    });
  });

  describe('isEveningTime', () => {
    it('returns false for morning and early afternoon times in Denver', () => {
      // 8:00 AM Denver time (14:00 UTC)
      expect(isEveningTime('2026-10-20T14:00:00.000Z', 'America/Denver')).toBe(false);
      // 2:00 PM Denver time (20:00 UTC)
      expect(isEveningTime('2026-10-20T20:00:00.000Z', 'America/Denver')).toBe(false);
      // 4:59 PM Denver time (22:59 UTC)
      expect(isEveningTime('2026-10-20T22:59:00.000Z', 'America/Denver')).toBe(false);
    });

    it('returns true for evening times (>= 17:00 / 5:00 PM Denver)', () => {
      // 5:00 PM Denver time (23:00 UTC)
      expect(isEveningTime('2026-10-20T23:00:00.000Z', 'America/Denver')).toBe(true);
      // 6:22 PM Denver time (00:22 UTC next day)
      expect(isEveningTime('2026-10-21T00:22:00.000Z', 'America/Denver')).toBe(true);
    });

    it('handles invalid timestamps safely', () => {
      expect(isEveningTime('invalid-date')).toBe(false);
    });
  });
});

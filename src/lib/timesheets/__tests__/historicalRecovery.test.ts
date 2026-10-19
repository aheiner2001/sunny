import { describe, expect, it } from 'vitest';
import type { Inspection } from '@/types';
import type { ShiftRecord } from '../types';
import { buildHistoricalEstimates, makeRecoveredShift } from '../historicalRecovery';
const inspection = (id: string, kind: 'pretrip' | 'return', submittedAt: string, extra = {}): Inspection => ({
  id, kind, userId: 'max', userName: 'Max', vehicleId: 'van', vehicleNumber: '101',
  submittedAt, startedAt: submittedAt, status: 'passed', ...extra,
} as Inspection);
const morning = inspection('morning', 'pretrip', '2026-10-19T13:37:00Z');
const returned = inspection('returned', 'return', '2026-10-19T21:15:00Z');
const build = (rows = [morning, returned], shifts: ShiftRecord[] = [], corrections: any[] = []) =>
  buildHistoricalEstimates(rows, shifts, corrections);
describe('historical hours evidence', () => {
  it('estimates 7 hours 38 minutes from the employee’s same-vehicle inspection and return', () => {
    const [row] = build();
    expect(row).toMatchObject({ state: 'ready', employeeName: 'Max', elapsedSeconds: 27480, startBasis: 'inspection submitted' });
  });
  it('uses a recorded actual inspection start instead of its submission time', () => {
    const [row] = build([{ ...morning, startedAtRecorded: true, startedAt: '2026-10-19T13:30:00Z' }, returned]);
    expect(row.startAtUtc).toBe('2026-10-19T13:30:00.000Z');
    expect(row.startBasis).toBe('inspection started');
  });
  it('flags a missing return instead of inventing an end time', () => {
    expect(build([morning])[0]).toMatchObject({ state: 'attention', endAtUtc: null });
  });
  it('does not pair a different employee’s return or a different vehicle', () => {
    expect(build([morning, { ...returned, userId: 'other' }]).every(r => r.state === 'attention')).toBe(true);
    expect(build([morning, { ...returned, vehicleId: 'other' }]).every(r => r.state === 'attention')).toBe(true);
  });
  it('flags multiple inspections in a day rather than combining them into assumed hours', () => {
    expect(build([morning, { ...morning, id: 'second' }, returned])[0].state).toBe('attention');
  });
  it('skips existing overlapping shifts and pending correction requests', () => {
    expect(build(undefined, [{ employeeId: 'max', startAtUtc: morning.submittedAt, endAtUtc: returned.submittedAt } as ShiftRecord])[0].state).toBe('covered');
    expect(build(undefined, [], [{ employeeId: 'max', status: 'pending', proposedStart: morning.submittedAt, proposedEnd: returned.submittedAt }])[0].state).toBe('covered');
  });
  it('flags conflicting estimates on different vehicles', () => {
    const rows = build([morning, returned, { ...morning, id: 'm2', vehicleId: 'v2' }, { ...returned, id: 'r2', vehicleId: 'v2' }]);
    expect(rows.every(r => r.state === 'attention')).toBe(true);
  });
  it('uses Mountain dates, flags overnight pairs for review, and ignores rejected forms', () => {
    const row = build([inspection('m', 'pretrip', '2026-10-18T00:00:00Z'), inspection('r', 'return', '2026-10-18T04:00:00Z')])[0];
    expect(row.date).toBe('2026-10-17');
    expect(row.state).toBe('ready');
    expect(build([morning, { ...returned, submittedAt: '2026-10-20T13:00:00Z' }]).every(r => r.state === 'attention')).toBe(true);
    expect(build([{ ...morning, status: 'rejected' }, returned])[0].state).toBe('attention');
  });
  it('never creates an approved or active shift and retains source provenance', () => {
    const shift = makeRecoveredShift(build()[0], { id: 'manager', name: 'Manager' });
    expect(shift).toMatchObject({ status: 'pending', approvedAt: null, approvedBy: null, unpaidBreakSeconds: 0,
      recovery: { inspectionId: 'morning', returnInspectionId: 'returned', estimated: true } });
    expect(shift.managerNote).toContain('Unpaid breaks have not been deducted');
    expect(() => makeRecoveredShift(build([morning])[0], { id: 'm', name: 'M' })).toThrow();
  });
});

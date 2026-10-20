import { expect, it } from 'vitest';
import type { Inspection } from '@/types';
import {
  buildHistoricalEstimates,
  isMissingReturnManualEndEligible,
  makeManualEndRecoveredShift,
} from '../historicalRecovery';

const pretripOnly = [{
  id: 'pre-1', userId: 'driver', userName: 'Driver', vehicleId: 'van',
  vehicleNumber: '5', submittedAt: '2026-10-12T14:00:00Z', kind: 'pretrip',
  status: 'passed', startedAt: '2026-10-12T13:50:00Z', startedAtRecorded: true,
}] as Inspection[];

it('flags pretrip-without-return as attention with missing return', () => {
  const [row] = buildHistoricalEstimates(pretripOnly, []);
  expect(row.state).toBe('attention');
  expect(row.endAtUtc).toBeNull();
  expect(row.reason).toMatch(/return|Missing/i);
});

it('builds a pending recovered shift from manager end time', () => {
  const [row] = buildHistoricalEstimates(pretripOnly, []);
  expect(isMissingReturnManualEndEligible(row)).toBe(true);
  const shift = makeManualEndRecoveredShift(row, '2026-10-12T22:00:00.000Z', { id: 'm1', name: 'Manager' });
  expect(shift.status).toBe('pending');
  expect(shift.endAtUtc).toBe('2026-10-12T22:00:00.000Z');
  expect(shift.recovery?.manualEnd).toBe(true);
  expect(shift.recovery?.returnInspectionId).toBeNull();
  expect(shift.recovery?.inspectionId).toBe('pre-1');
});

it('rejects manual end recovery when multiple pretrips make the day ambiguous', () => {
  const [row] = buildHistoricalEstimates([
    ...pretripOnly,
    { ...pretripOnly[0], id: 'pre-2', submittedAt: '2026-10-12T15:00:00Z' },
  ], []);

  expect(row).toMatchObject({ state: 'attention', endAtUtc: null, returnInspectionId: null });
  expect(isMissingReturnManualEndEligible(row)).toBe(false);
  expect(() => makeManualEndRecoveredShift(
    row,
    '2026-10-12T22:00:00.000Z',
    { id: 'm1', name: 'Manager' },
  )).toThrow(/exactly one pretrip/i);
});

it('rejects a ready estimate that already has a return', () => {
  const [row] = buildHistoricalEstimates([
    ...pretripOnly,
    {
      id: 'return-1', userId: 'driver', userName: 'Driver', vehicleId: 'van',
      vehicleNumber: '5', submittedAt: '2026-10-12T22:00:00Z', kind: 'return',
      status: 'passed',
    } as Inspection,
  ], []);

  expect(row.state).toBe('ready');
  expect(() => makeManualEndRecoveredShift(row, '2026-10-12T23:00:00.000Z', { id: 'm1', name: 'Manager' }))
    .toThrow(/missing return/i);
});

it('rejects an attention estimate that still has return evidence', () => {
  const [row] = buildHistoricalEstimates([
    ...pretripOnly,
    {
      id: 'late-return', userId: 'driver', userName: 'Driver', vehicleId: 'van',
      vehicleNumber: '5', submittedAt: '2026-10-12T22:00:00Z', kind: 'return',
      status: 'passed', submittedById: 'manager',
    } as Inspection,
  ], []);

  expect(row).toMatchObject({
    state: 'attention',
    returnInspectionId: 'late-return',
    endAtUtc: '2026-10-12T22:00:00.000Z',
  });
  expect(() => makeManualEndRecoveredShift(row, '2026-10-12T23:00:00.000Z', { id: 'm1', name: 'Manager' }))
    .toThrow(/missing return/i);
});

it('rejects manual end at or before start', () => {
  const [row] = buildHistoricalEstimates(pretripOnly, []);
  expect(() => makeManualEndRecoveredShift(row, '2026-10-12T13:00:00.000Z', { id: 'm1', name: 'Manager' }))
    .toThrow(/end time/i);
});

it('rejects manual end more than 18 hours after start', () => {
  const [row] = buildHistoricalEstimates(pretripOnly, []);
  expect(() => makeManualEndRecoveredShift(row, '2026-10-13T08:00:00.001Z', { id: 'm1', name: 'Manager' }))
    .toThrow(/end time/i);
});

it('rejects unparseable manual end time', () => {
  const [row] = buildHistoricalEstimates(pretripOnly, []);
  expect(() => makeManualEndRecoveredShift(row, 'not-a-valid-timestamp', { id: 'm1', name: 'Manager' }))
    .toThrow(/end time/i);
});

it('rejects manual end when period overlaps an existing shift', () => {
  const existing = makeManualEndRecoveredShift(
    buildHistoricalEstimates(pretripOnly, [])[0],
    '2026-10-12T22:00:00.000Z',
    { id: 'm1', name: 'Manager' },
  );
  const [row] = buildHistoricalEstimates(pretripOnly, [existing]);
  expect(() => makeManualEndRecoveredShift(row, '2026-10-12T21:00:00.000Z', { id: 'm1', name: 'Manager' }))
    .toThrow(/overlap/i);
});

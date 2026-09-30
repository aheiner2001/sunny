import { describe, expect, it } from 'vitest';
import { findPreviousVehicleUser } from '../previousVehicleUser';
import type { Inspection, InspectionAlert, VehicleAssignment } from '@/types';

const alert = {
  inspectionId: 'inspection', vehicleId: 'van', inspectionKind: 'pretrip',
  reportedById: 'jacob', reportedAt: '2026-09-29T14:37:06Z',
} as InspectionAlert;
const inspection = {
  id: 'inspection', vehicleId: 'van', userId: 'jacob',
  startedAt: '2026-09-29T14:30:00Z', submittedAt: alert.reportedAt,
  startedAtRecorded: true,
} as Inspection;
function assignment(id: string, userId: string, startedAt: string, endedAt: string | null = null): VehicleAssignment {
  return { id, vehicleId: 'van', vehicleNumber: '5', userId, userName: userId,
    startedAt, endedAt, source: 'manager', actorId: 'manager', actorName: 'Manager', recordedAt: startedAt };
}
const previous = assignment('previous', 'alex', '2026-09-28T14:00:00Z', '2026-09-29T00:00:00Z');

describe('previous vehicle user for a report', () => {
  it('uses the latest assignment before the inspection began, ignoring later drivers and other vans', () => {
    const rows = [
      assignment('old', 'older', '2026-09-27T14:00:00Z'), previous,
      assignment('during', 'during', '2026-09-29T14:32:00Z'),
      assignment('future', 'future', '2026-09-30T14:00:00Z'),
      { ...assignment('other', 'other', '2026-09-29T14:29:00Z'), vehicleId: 'other-van' },
    ];
    expect(findPreviousVehicleUser(alert, inspection, rows)?.userId).toBe('alex');
  });
  it('skips the inspecting employee even when a manager submits on their behalf', () => {
    expect(findPreviousVehicleUser({ ...alert, reportedById: 'manager' }, inspection,
      [previous, assignment('current', 'jacob', '2026-09-29T14:20:00Z')])?.userId).toBe('alex');
  });
  it('does not identify the reporting driver as the previous user on a return', () => {
    expect(findPreviousVehicleUser({ ...alert, inspectionKind: 'return' }, inspection,
      [previous, assignment('current', 'jacob', '2026-09-29T14:20:00Z')])?.userId).toBe('alex');
  });
  it('uses the report time for older reports instead of rejecting their truck history', () => {
    expect(findPreviousVehicleUser(alert, undefined, [previous])?.userId).toBe('alex');
    expect(findPreviousVehicleUser(alert, { ...inspection, startedAtRecorded: undefined }, [previous])?.userId).toBe('alex');
  });
  it('finds previous truck use in inspection history even without assignment records', () => {
    const older = { ...inspection, id: 'old', userId: 'alex', userName: 'Alex', status: 'passed',
      submittedAt: '2026-09-28T14:00:00Z' } as Inspection;
    const later = { ...older, id: 'later', userId: 'later', submittedAt: '2026-09-30T14:00:00Z' };
    const otherVan = { ...older, id: 'other', vehicleId: 'other', submittedAt: '2026-09-29T14:00:00Z' };
    expect(findPreviousVehicleUser(alert, { ...inspection, startedAtRecorded: undefined }, [],
      [inspection, older, later, otherVan])).toMatchObject({ userId: 'alex', source: 'inspection' });
  });
  it('uses the latest prior truck history rather than an older assignment', () => {
    const recent = { ...inspection, id: 'old', userId: 'sam', userName: 'Sam', status: 'passed',
      submittedAt: '2026-09-29T13:00:00Z' } as Inspection;
    expect(findPreviousVehicleUser(alert, inspection, [previous], [recent])?.userId).toBe('sam');
  });
  it('allows the same employee to be the previous user on an earlier completed shift', () => {
    const earlier = assignment('yesterday', 'jacob', '2026-09-28T14:00:00Z', '2026-09-29T00:00:00Z');
    expect(findPreviousVehicleUser(alert, inspection, [earlier, assignment('current', 'jacob', '2026-09-29T14:20:00Z')])?.userId).toBe('jacob');
  });
  it('keeps an earlier same-employee inspection when there is no current assignment record', () => {
    const older = { ...inspection, id: 'yesterday', userName: 'Jacob', status: 'passed', submittedAt: '2026-09-28T14:00:00Z' } as Inspection;
    expect(findPreviousVehicleUser(alert, inspection, [], [older])?.userId).toBe('jacob');
  });
  it('does not mistake the current shift morning inspection for the previous user in a return report', () => {
    const current = assignment('current', 'jacob', '2026-09-29T12:00:00Z');
    const morning = { ...inspection, id: 'morning', userName: 'Jacob', status: 'passed', submittedAt: '2026-09-29T12:10:00Z' } as Inspection;
    expect(findPreviousVehicleUser({ ...alert, inspectionKind: 'return' }, inspection, [previous, current], [morning])?.userId).toBe('alex');
  });
  it('returns unknown for missing history or malformed timestamps', () => {
    expect(findPreviousVehicleUser(alert, inspection, [])).toBeNull();
    expect(findPreviousVehicleUser(alert, inspection, [assignment('bad', 'bad', 'invalid')])).toBeNull();
    expect(findPreviousVehicleUser({ ...alert, reportedAt: 'invalid' }, undefined, [previous])).toBeNull();
  });
  it('returns unknown when simultaneous assignments name different users', () => {
    expect(findPreviousVehicleUser(alert, inspection, [previous,
      assignment('conflict', 'someone-else', '2026-09-28T14:00:00Z')])).toBeNull();
  });
});

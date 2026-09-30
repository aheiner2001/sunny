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
  it('returns unknown when an older report has no reliably recorded inspection start', () => {
    expect(findPreviousVehicleUser(alert, undefined, [previous])).toBeNull();
    expect(findPreviousVehicleUser(alert, { ...inspection, startedAtRecorded: undefined }, [previous])).toBeNull();
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

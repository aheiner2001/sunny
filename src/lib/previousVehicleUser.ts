import type { Inspection, InspectionAlert, VehicleAssignment } from '@/types';

export type PreviousVehicleUser = {
  userId: string;
  userName: string;
  occurredAt: string;
  source: 'assignment' | 'inspection';
};

export function findPreviousVehicleUser(
  alert: InspectionAlert,
  inspection: Inspection | undefined,
  assignments: VehicleAssignment[],
  inspections: Inspection[] = [],
): PreviousVehicleUser | null {
  const linked = inspection?.id === alert.inspectionId && inspection.vehicleId === alert.vehicleId
    ? inspection : undefined;
  const reportedAt = Date.parse(alert.reportedAt);
  if (!Number.isFinite(reportedAt)) return null;
  const actualStart = linked?.startedAtRecorded ? Date.parse(linked.startedAt) : NaN;
  // Older inspections estimated their start. Their report time still provides
  // a historical boundary; do not discard the truck's recorded use history.
  const cutoff = Number.isFinite(actualStart) && actualStart <= reportedAt ? actualStart : reportedAt;
  const inspectingUserId = linked?.userId || alert.reportedById;
  const truckAssignments = assignments.filter(row => row.vehicleId === alert.vehicleId);
  const currentStarts = truckAssignments.filter(row =>
    row.userId === inspectingUserId && Date.parse(row.startedAt) < cutoff &&
    (!row.endedAt || !Number.isFinite(Date.parse(row.endedAt)) || Date.parse(row.endedAt) >= cutoff)
  ).map(row => Date.parse(row.startedAt));
  const currentShiftStart = currentStarts.length ? Math.max(...currentStarts) : Infinity;

  const candidates: PreviousVehicleUser[] = [
    ...truckAssignments.filter(row => row.userId && row.userName && Date.parse(row.startedAt) < cutoff &&
      !(row.userId === inspectingUserId && Date.parse(row.startedAt) >= currentShiftStart)
    ).map(row => ({ userId: row.userId, userName: row.userName, occurredAt: row.startedAt, source: 'assignment' as const })),
    ...inspections.filter(row => row.vehicleId === alert.vehicleId && row.id !== alert.inspectionId &&
      row.userId && row.userName && row.status !== 'in_progress' && row.status !== 'rejected' &&
      Date.parse(row.submittedAt) < cutoff &&
      !(row.userId === inspectingUserId && Date.parse(row.submittedAt) >= currentShiftStart)
    ).map(row => ({ userId: row.userId, userName: row.userName, occurredAt: row.submittedAt, source: 'inspection' as const })),
  ].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  const latest = candidates[0];
  if (!latest || candidates.some(row => Date.parse(row.occurredAt) === Date.parse(latest.occurredAt) && row.userId !== latest.userId)) return null;
  return latest;
}

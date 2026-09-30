import type { Inspection, InspectionAlert, VehicleAssignment } from '@/types';

export function findPreviousVehicleUser(
  alert: InspectionAlert,
  inspection: Inspection | undefined,
  assignments: VehicleAssignment[],
): VehicleAssignment | null {
  // Anchor to this inspection, never the truck's current driver. Older records
  // used estimated starts, so cannot establish who was previous reliably.
  const linked = inspection?.id === alert.inspectionId && inspection.vehicleId === alert.vehicleId
    ? inspection : undefined;
  if (!linked?.startedAtRecorded) return null;
  const cutoff = Date.parse(linked.startedAt);
  const reportedAt = Date.parse(alert.reportedAt);
  if (!Number.isFinite(cutoff) || !Number.isFinite(reportedAt) || cutoff > reportedAt) return null;
  const inspectingUserId = linked.userId;
  const candidates = assignments.filter(row =>
    row.vehicleId === alert.vehicleId && row.userId && row.userName &&
    row.userId !== inspectingUserId && Date.parse(row.startedAt) < cutoff
  ).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const latest = candidates[0];
  // Conflicting records at the same time are not reliable attribution.
  if (!latest || candidates.some(row => Date.parse(row.startedAt) === Date.parse(latest.startedAt) && row.userId !== latest.userId)) return null;
  return latest;
}

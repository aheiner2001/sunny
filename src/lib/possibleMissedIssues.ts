
import type { Inspection, Issue } from '@/types';

export type PossibleMissedIssueSignal = {
  issueId: string;
  issueTitle: string;
  vehicleId: string;
  vehicleNumber?: string;
  equipmentId?: string | null;
  equipmentName?: string | null;
  flaggedAt: string;
  flaggedByInspectionId?: string | null;
  flaggedByUserName?: string | null;
  flaggedByUserId?: string | null;
  priorInspectionId: string;
  priorUserName: string;
  priorUserId?: string | null;
  priorSubmittedAt: string;
  windowHours: number;
  /** Reviewable handoff signal; separate from fleet pass-rate metrics. */
  kind: 'possible_missed_issue';
};

const DEFAULT_WINDOW_HOURS = 72;

export function isCompletedInspection(inspection: Inspection): boolean {
  return inspection.status !== 'in_progress' && inspection.status !== 'rejected'
    && Number.isFinite(new Date(inspection.submittedAt).getTime());
}


/**
 * Reviewable custody signal: when a later operator flags something, associate the
 * most recent prior inspection/operator for the same vehicle (and equipment when known)
 * inside a defensible window. Never mutates pass-rate inputs.
 */
export function findPossibleMissedIssues(
  issues: Issue[],
  inspections: Inspection[],
  options?: { windowHours?: number; now?: Date }
): PossibleMissedIssueSignal[] {
  const windowHours = options?.windowHours ?? DEFAULT_WINDOW_HOURS;
  const windowMs = windowHours * 60 * 60 * 1000;
  const signals: PossibleMissedIssueSignal[] = [];

  const sortedInspections = inspections.filter(isCompletedInspection).sort(
    (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
  );

  for (const issue of issues) {
    const flaggedAt = issue.reportedAt;
    if (!flaggedAt) continue;
    const flaggedMs = new Date(flaggedAt).getTime();
    if (Number.isNaN(flaggedMs)) continue;

    const prior = [...sortedInspections]
      .filter(insp => {
        if (insp.vehicleId !== issue.vehicleId) return false;
        if (issue.inspectionId && insp.id === issue.inspectionId) return false;
        const submitted = new Date(insp.submittedAt).getTime();
        if (Number.isNaN(submitted) || submitted >= flaggedMs) return false;
        if (flaggedMs - submitted > windowMs) return false;
        return true;
      })
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];

    if (!prior) continue;

    // Inspect the latest custody record first; never reach past an acknowledged
    // defect to deduct points from an older clean inspection.
    if (issue.equipmentId) {
      if (prior.responses.some(r => r.equipmentId === issue.equipmentId && r.isFlagged)) continue;
      if (prior.status === 'issues_found' && !prior.responses.some(r => r.equipmentId === issue.equipmentId)) continue;
    } else if (prior.status === 'issues_found' || prior.responses.some(r => r.isFlagged)) continue;

    const flaggingInspection = issue.inspectionId
      ? inspections.find(i => i.id === issue.inspectionId)
      : undefined;

    const reporterId = flaggingInspection?.userId || issue.reportedById;
    const reporterName = flaggingInspection?.userName || issue.reportedByName;
    // A custody discrepancy requires a different, identifiable reporting operator.
    if (!reporterId && !reporterName?.trim()) continue;
    if (prior.userId && reporterId ? prior.userId === reporterId
      : prior.userName?.trim() && prior.userName.trim() === reporterName?.trim()) continue;

    signals.push({
      issueId: issue.id,
      issueTitle: issue.title || issue.equipmentName || 'Flagged issue',
      vehicleId: issue.vehicleId,
      vehicleNumber: issue.vehicleNumber,
      equipmentId: issue.equipmentId,
      equipmentName: issue.equipmentName,
      flaggedAt,
      flaggedByInspectionId: issue.inspectionId || null,
      flaggedByUserName: reporterName || null,
      flaggedByUserId: reporterId || null,
      priorInspectionId: prior.id,
      priorUserName: prior.userName,
      priorUserId: prior.userId || null,
      priorSubmittedAt: prior.submittedAt,
      windowHours,
      kind: 'possible_missed_issue',
    });
  }

  return signals;
}

/** Pass-rate helper: exclude soft signals — pass rate uses inspection status only. */
export function calculatePassRate(inspections: Inspection[]): number {
  if (inspections.length === 0) return 100;
  const passed = inspections.filter(i => i.status === 'passed').length;
  return Math.round((passed / inspections.length) * 100);
}

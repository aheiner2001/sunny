
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
  priorInspectionId: string;
  priorUserName: string;
  priorSubmittedAt: string;
  windowHours: number;
  /** Soft advisory only — must NOT feed pass-rate / operator blame metrics. */
  kind: 'possible_missed_issue';
};

const DEFAULT_WINDOW_HOURS = 72;


/**
 * Conservative soft signal: when a later inspection flags something, associate the
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

  const sortedInspections = [...inspections].sort(
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
        // Prior inspection did not itself flag this equipment (if known)
        if (issue.equipmentId) {
          const flaggedSame = insp.responses.some(
            r => r.equipmentId === issue.equipmentId && r.isFlagged
          );
          if (flaggedSame) return false;
        } else if (insp.status === 'issues_found') {
          // If we cannot scope to equipment, skip priors that already found issues
          // to avoid noisy blame. Soft signal prefers clean priors only.
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];

    if (!prior) continue;

    const flaggingInspection = issue.inspectionId
      ? inspections.find(i => i.id === issue.inspectionId)
      : undefined;

    signals.push({
      issueId: issue.id,
      issueTitle: issue.title || issue.equipmentName || 'Flagged issue',
      vehicleId: issue.vehicleId,
      vehicleNumber: issue.vehicleNumber,
      equipmentId: issue.equipmentId,
      equipmentName: issue.equipmentName,
      flaggedAt,
      flaggedByInspectionId: issue.inspectionId || null,
      flaggedByUserName: flaggingInspection?.userName || issue.reportedByName || null,
      priorInspectionId: prior.id,
      priorUserName: prior.userName,
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

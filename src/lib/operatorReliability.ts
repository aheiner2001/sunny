import type { Inspection, Issue, User } from '@/types';
import { isCompletedInspection, type PossibleMissedIssueSignal } from './possibleMissedIssues';

export const MIN_BONUS_INSPECTIONS = 10;
export type BonusStatus = 'Qualified' | 'Needs Review' | 'Ineligible';

/** Date-range inputs are filtered by the caller. Signals are filtered by discovery
 * date, with prior custody looked up against the complete inspection history. */
export function buildOperatorScorecards(
  users: User[], inspections: Inspection[], issues: Issue[], signals: PossibleMissedIssueSignal[],
) {
  const completed = Array.from(new Map(inspections.filter(isCompletedInspection).map(i => [i.id, i])).values());
  const discoveries = Array.from(new Map(issues.map(i => [i.id, i])).values());
  const operators = new Map(users.map(u => [u.id, u]));

  // IDs are authoritative. A name fallback is allowed only for legacy records
  // without an ID and only when that name uniquely identifies an operator.
  const resolve = (id?: string | null, name?: string | null): string => {
    if (id?.trim()) {
      if (!operators.has(id)) operators.set(id, { id, name: name?.trim() || 'Unknown operator', role: 'employee', status: 'inactive' });
      return id;
    }
    const label = name?.trim() || 'Unknown operator';
    const matches = Array.from(operators.values()).filter(u => u.name === label);
    if (matches.length === 1) return matches[0].id;
    const key = `legacy:${label}`;
    if (!operators.has(key)) operators.set(key, { id: key, name: label, role: 'employee', status: 'inactive' });
    return key;
  };
  // Register ID-bearing historical operators before resolving any legacy names.
  completed.forEach(i => { if (i.userId) resolve(i.userId, i.userName); });
  discoveries.forEach(i => { if (i.reportedById) resolve(i.reportedById, i.reportedByName); });
  signals.forEach(s => { if (s.priorUserId) resolve(s.priorUserId, s.priorUserName); });
  const inspectionOwners = new Map(completed.map(i => [i.id, resolve(i.userId, i.userName)]));
  const issueOwners = new Map(discoveries.map(i => {
    const checklist = completed.find(row => row.id === i.inspectionId);
    return [i.id, resolve(i.reportedById || checklist?.userId, i.reportedByName || checklist?.userName)];
  }));
  const signalOwners = new Map(signals.map(s => [s.issueId, resolve(s.priorUserId, s.priorUserName)]));

  return Array.from(operators.values()).map(user => {
    const rows = completed.filter(i => inspectionOwners.get(i.id) === user.id);
    const userIssues = discoveries.filter(i => issueOwners.get(i.id) === user.id);
    const days = new Set<string>();
    const shifts = new Map<string, Set<string>>();
    rows.forEach(i => {
      // Submission timestamps, not potentially stale legacy dateString values.
      const day = new Date(i.submittedAt).toISOString().slice(0, 10);
      days.add(day);
      const key = `${day}:${i.vehicleId}`;
      const kinds = shifts.get(key) || new Set<string>();
      kinds.add(i.kind || 'pretrip');
      shifts.set(key, kinds);
    });
    const completedShifts = Array.from(shifts.values()).filter(k => k.has('pretrip') && k.has('return')).length;
    const consistencyRatio = shifts.size ? completedShifts / shifts.size : 0;
    const baseDiligence = rows.length ? Math.round(35 * Math.min(1, rows.length / MIN_BONUS_INSPECTIONS) + 35 * consistencyRatio) : 0;

    // Recognize flagged checklists even when an issue record has not been created.
    // A linked issue and its checklist earn credit only once.
    const unlinkedFindings = rows.filter(i => (i.status === 'issues_found' || i.responses.some(r => r.isFlagged))
      && !discoveries.some(iss => iss.inspectionId === i.id || i.issueIds.includes(iss.id))).length;
    const issuesFlagged = userIssues.length + unlinkedFindings;
    const integrityBonus = Math.min(15, issuesFlagged * 3);
    const handoffs = new Map<string, number>();
    signals.filter(s => signalOwners.get(s.issueId) === user.id).forEach(s => {
      // Multiple findings from the same next inspection are one custody event.
      const key = `${s.priorInspectionId}:${s.flaggedByInspectionId || `${s.flaggedByUserId || s.flaggedByUserName}:${s.flaggedAt}`}`;
      const priority = discoveries.find(i => i.id === s.issueId)?.priority;
      const penalty = priority === 'critical' ? 25 : priority === 'moderate' ? 15 : 10;
      handoffs.set(key, Math.max(handoffs.get(key) || 0, penalty));
    });
    const discrepancyPenalty = Array.from(handoffs.values()).reduce((sum, p) => sum + p, 0);
    const handoffFlags = handoffs.size;
    const score = Math.max(0, Math.min(100, baseDiligence + integrityBonus - discrepancyPenalty));
    const bonusStatus: BonusStatus = score < 70 || handoffFlags > 1 ? 'Ineligible'
      : score >= 85 && rows.length >= MIN_BONUS_INSPECTIONS && handoffFlags === 0 ? 'Qualified' : 'Needs Review';
    const grade = score >= 95 ? 'A+' : score >= 90 ? 'A' : score >= 80 ? 'B+' : score >= 70 ? 'B' : 'C';
    return { user, totalInspections: rows.length, activeDays: days.size, completedShifts, observedShifts: shifts.size,
      consistency: Math.round(consistencyRatio * 100), baseDiligence, integrityBonus, issuesFlagged,
      handoffFlags, discrepancyPenalty, score, grade, bonusStatus };
  }).filter(s => s.user.status === 'active' || s.totalInspections > 0 || s.issuesFlagged > 0 || s.handoffFlags > 0)
    .sort((a, b) => b.score - a.score || b.totalInspections - a.totalInspections || a.user.name.localeCompare(b.user.name));
}

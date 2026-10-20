import { DateTime } from 'luxon';
import type { Inspection, MissedReturn } from '@/types';
import type { CorrectionRequest, ShiftRecord } from './types';
import { DEFAULT_TIMEZONE, calculateNetSeconds } from './timeCalculations';

export interface HistoricalEstimate {
  id: string;
  employeeId: string;
  employeeName: string;
  vehicleNumber: string;
  date: string;
  inspectionId: string | null;
  returnInspectionId: string | null;
  startAtUtc: string | null;
  endAtUtc: string | null;
  startBasis: 'inspection started' | 'inspection submitted';
  elapsedSeconds: number | null;
  state: 'ready' | 'attention' | 'covered';
  reason: string;
}

const estimateEvidence = new WeakMap<HistoricalEstimate, {
  shifts: ShiftRecord[];
  corrections: CorrectionRequest[];
}>();

export function overlapsHistoricalHours(employeeId: string, start: string, end: string,
  shifts: ShiftRecord[], corrections: CorrectionRequest[]): boolean {
  const a = Date.parse(start), b = Date.parse(end);
  return shifts.some(s => s.employeeId === employeeId && Date.parse(s.startAtUtc) < b &&
    (s.endAtUtc ? Date.parse(s.endAtUtc) : Infinity) > a) ||
    corrections.some(c => c.employeeId === employeeId && c.status === 'pending' &&
      Date.parse(c.proposedStart) < b && Date.parse(c.proposedEnd) > a);
}

/** Conservative evidence pairs: one employee, vehicle and Mountain calendar day. */
export function buildHistoricalEstimates(inspections: Inspection[], shifts: ShiftRecord[],
  corrections: CorrectionRequest[] = [], missedReturns: MissedReturn[] = []): HistoricalEstimate[] {
  const catchUpIds = new Set(missedReturns.map(record => record.completedReturnInspectionId).filter(Boolean));
  const groups = new Map<string, Inspection[]>();
  const seen = new Set<string>();
  for (const record of inspections) {
    const submitted = DateTime.fromISO(record.submittedAt || '', { zone: 'utc' });
    if (!record.id || seen.has(record.id) || !record.userId || record.userId === 'anon' || !record.vehicleId ||
      (record.kind && record.kind !== 'pretrip' && record.kind !== 'return') || record.status === 'rejected' || record.status === 'in_progress' || record.missedReturnId || catchUpIds.has(record.id) || !submitted.isValid || submitted.toMillis() > Date.now()) continue;
    seen.add(record.id);
    const date = submitted.setZone(DEFAULT_TIMEZONE).toISODate();
    const key = JSON.stringify([record.userId, record.vehicleId, date]);
    groups.set(key, [...(groups.get(key) || []), record]);
  }
  const estimates = Array.from(groups.values()).map(records => {
    const starts = records.filter(r => !r.kind || r.kind === 'pretrip');
    const ends = records.filter(r => r.kind === 'return');
    const start = starts[0], end = ends[0], reference = start || end;
    const recorded = Boolean(start?.startedAtRecorded && Number.isFinite(Date.parse(start.startedAt)) &&
      Date.parse(start.startedAt) <= Date.parse(start.submittedAt));
    const startAtUtc = start ? new Date(recorded ? start.startedAt : start.submittedAt).toISOString() : null;
    const endAtUtc = end ? new Date(end.submittedAt).toISOString() : null;
    const row: HistoricalEstimate = {
      id: `recovered-${encodeURIComponent(start?.id || end.id)}`,
      employeeId: reference.userId, employeeName: reference.userName || reference.userId,
      vehicleNumber: reference.vehicleNumber || reference.vehicleId,
      date: DateTime.fromISO(reference.submittedAt).setZone(DEFAULT_TIMEZONE).toISODate()!,
      inspectionId: start?.id || null, returnInspectionId: end?.id || null,
      startAtUtc, endAtUtc, startBasis: recorded ? 'inspection started' : 'inspection submitted',
      elapsedSeconds: null, state: 'attention', reason: 'Missing inspection or matching return. Review source records manually.',
    };
    estimateEvidence.set(row, { shifts, corrections });
    if (starts.length > 1 || ends.length > 1) row.reason = 'Multiple inspections or returns. Confirm the correct pair manually.';
    else if (start && !end) {
      row.reason = 'No return submitted for this day. Enter an end time to add hours for review.';
    }
    else if (start && end && startAtUtc && endAtUtc) {
      const duration = Date.parse(endAtUtc) - Date.parse(startAtUtc);
      if (duration <= 0 || duration > 18 * 3600000 ||
        DateTime.fromISO(startAtUtc).setZone(DEFAULT_TIMEZONE).toISODate() !== row.date ||
        (start.submittedById && start.submittedById !== start.userId) ||
        (end.submittedById && end.submittedById !== end.userId)) {
        row.reason = 'Timing or submitter needs review. Confirm hours manually.';
      } else {
        row.elapsedSeconds = calculateNetSeconds(startAtUtc, endAtUtc);
        row.state = shifts.some(shift => shift.recovery?.inspectionId === row.inspectionId ||
          (row.returnInspectionId !== null && shift.recovery?.returnInspectionId === row.returnInspectionId)) ||
          overlapsHistoricalHours(row.employeeId, startAtUtc, endAtUtc, shifts, corrections) ? 'covered' : 'ready';
        row.reason = row.state === 'covered' ? 'Existing timesheet or pending hours request overlaps this period.' :
          'Estimated — needs manager review. Unpaid breaks have not been deducted.';
      }
    }
    return row;
  });
  for (const row of estimates) {
    if (row.state !== 'ready') continue;
    if (estimates.some(other => other.id !== row.id && other.employeeId === row.employeeId &&
      other.startAtUtc && other.endAtUtc && row.startAtUtc && row.endAtUtc &&
      Date.parse(other.startAtUtc) < Date.parse(row.endAtUtc) && Date.parse(other.endAtUtc) > Date.parse(row.startAtUtc))) {
      row.state = 'attention';
      row.reason = 'Overlapping evidence on multiple vehicles. Confirm hours manually.';
    }
  }
  return estimates.sort((a, b) => b.date.localeCompare(a.date) || a.employeeName.localeCompare(b.employeeName));
}

export function makeRecoveredShift(row: HistoricalEstimate, actor: { id: string; name: string }): ShiftRecord {
  if (row.state !== 'ready' || !row.startAtUtc || !row.endAtUtc || !row.inspectionId || !row.returnInspectionId)
    throw new Error('This estimate needs manual review before it can be added.');
  const now = new Date().toISOString();
  return {
    id: row.id, employeeId: row.employeeId, employeeName: row.employeeName, locationId: 'loc-main',
    status: 'pending', timeZone: DEFAULT_TIMEZONE, startAtUtc: row.startAtUtc, endAtUtc: row.endAtUtc,
    unpaidBreakSeconds: 0, startSource: 'manual', endSource: 'manual',
    startEventId: `historical-${row.inspectionId}`, endEventId: `historical-${row.returnInspectionId}`,
    revision: 1, createdAt: now, updatedAt: now, submittedAt: now, approvedAt: null, approvedBy: null,
    managerNote: `Estimated from ${row.startBasis} and return submission by ${actor.name}. Unpaid breaks have not been deducted. Verify times and breaks before approval.`,
    recovery: { estimated: true, inspectionId: row.inspectionId, returnInspectionId: row.returnInspectionId,
      recoveredBy: actor.id, recoveredByName: actor.name, recoveredAt: now, startBasis: row.startBasis },
  };
}

export function makeManualEndRecoveredShift(
  row: HistoricalEstimate,
  endAtUtc: string,
  actor: { id: string; name: string },
): ShiftRecord {
  if (row.state !== 'attention' || row.endAtUtc !== null || row.returnInspectionId !== null ||
    !row.inspectionId || !row.startAtUtc)
    throw new Error('Only an attention estimate with a missing return can use a manual end time.');
  const startMillis = Date.parse(row.startAtUtc);
  const endMillis = Date.parse(endAtUtc);
  if (!Number.isFinite(endMillis) || endMillis <= startMillis || endMillis - startMillis > 18 * 3600000)
    throw new Error('End time must be after the start and no more than 18 hours later.');
  const evidence = estimateEvidence.get(row);
  if (evidence && overlapsHistoricalHours(row.employeeId, row.startAtUtc, endAtUtc,
    evidence.shifts, evidence.corrections))
    throw new Error('Existing hours or a pending request overlap this estimate.');
  const now = new Date().toISOString();
  return {
    id: row.id, employeeId: row.employeeId, employeeName: row.employeeName, locationId: 'loc-main',
    status: 'pending', timeZone: DEFAULT_TIMEZONE, startAtUtc: row.startAtUtc, endAtUtc,
    unpaidBreakSeconds: 0, startSource: 'manual', endSource: 'manual',
    startEventId: `historical-${row.inspectionId}`, endEventId: `historical-manual-${row.inspectionId}`,
    revision: 1, createdAt: now, updatedAt: now, submittedAt: now, approvedAt: null, approvedBy: null,
    managerNote: `Manager ${actor.name} entered the end time because no return was submitted. Unpaid breaks have not been deducted. Verify times and breaks before approval.`,
    recovery: {
      estimated: true, inspectionId: row.inspectionId, returnInspectionId: null, manualEnd: true,
      recoveredBy: actor.id, recoveredByName: actor.name, recoveredAt: now, startBasis: row.startBasis,
    },
  };
}

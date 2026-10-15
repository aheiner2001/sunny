import { timesheetStore } from './timesheetStore';
import {
  calculateNetSeconds,
  validateShiftInterval,
  hasShiftOverlap,
  DEFAULT_TIMEZONE,
  getWeekBoundariesUtc,
} from './timeCalculations';
import type {
  ShiftRecord,
  PunchSource,
  CorrectionRequest,
  AuditAction,
  TimesheetSummary,
} from './types';

export class TimesheetService {
  async clockIn(
    employeeId: string,
    employeeName: string,
    source: PunchSource,
    eventId: string,
    timestamp = new Date().toISOString()
  ): Promise<ShiftRecord> {
    const guard = timesheetStore.getActiveShiftGuard(employeeId);
    if (guard?.activeShiftId) {
      const existing = timesheetStore.getShift(guard.activeShiftId);
      if (existing && existing.status === 'active') {
        return existing; // Idempotent: preserve existing active shift & start time
      }
    }

    const id = `shift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newShift: ShiftRecord = {
      id,
      employeeId,
      employeeName,
      locationId: 'loc-main',
      status: 'active',
      timeZone: DEFAULT_TIMEZONE,
      startAtUtc: timestamp,
      endAtUtc: null,
      unpaidBreakSeconds: 0,
      startSource: source,
      endSource: null,
      startEventId: eventId,
      endEventId: null,
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      submittedAt: null,
      approvedAt: null,
      approvedBy: null,
    };

    timesheetStore.saveShift(newShift);
    timesheetStore.setActiveShiftGuard(employeeId, id);

    timesheetStore.appendAuditEvent({
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      shiftId: id,
      actorId: employeeId,
      actorName: employeeName,
      action: 'clock_in',
      beforeValues: null,
      afterValues: { ...newShift },
      reason: null,
      revision: 1,
      eventId,
      timestamp,
    });

    await timesheetStore.waitForPendingSyncs();

    return newShift;
  }

  async clockOut(
    employeeId: string,
    source: PunchSource,
    eventId: string,
    unpaidBreakSeconds = 0,
    timestamp?: string
  ): Promise<ShiftRecord> {
    const existingEnded = timesheetStore.getShiftsByEmployee(employeeId).find((s) => s.endEventId === eventId);
    if (existingEnded) {
      return existingEnded; // Idempotent retry on already closed shift
    }

    const guard = timesheetStore.getActiveShiftGuard(employeeId);
    if (!guard?.activeShiftId) {
      throw new Error('NO_ACTIVE_SHIFT');
    }

    const shift = timesheetStore.getShift(guard.activeShiftId);
    if (!shift || shift.status !== 'active') {
      throw new Error('NO_ACTIVE_SHIFT');
    }

    if (shift.endEventId === eventId) {
      return shift; // Idempotent retry
    }

    let effectiveTimestamp = timestamp ?? new Date().toISOString();
    if (timestamp === undefined && new Date(effectiveTimestamp).getTime() <= new Date(shift.startAtUtc).getTime()) {
      effectiveTimestamp = new Date(new Date(shift.startAtUtc).getTime() + 1000).toISOString();
    }

    const validation = validateShiftInterval(shift.startAtUtc, effectiveTimestamp, unpaidBreakSeconds);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const nextRevision = shift.revision + 1;
    const updated: ShiftRecord = {
      ...shift,
      status: 'pending',
      endAtUtc: effectiveTimestamp,
      endSource: source,
      endEventId: eventId,
      unpaidBreakSeconds,
      revision: nextRevision,
      updatedAt: effectiveTimestamp,
      submittedAt: effectiveTimestamp,
    };

    timesheetStore.saveShift(updated);
    timesheetStore.clearActiveShiftGuard(employeeId);

    timesheetStore.appendAuditEvent({
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      shiftId: shift.id,
      actorId: employeeId,
      actorName: shift.employeeName,
      action: 'clock_out',
      beforeValues: { status: shift.status, endAtUtc: shift.endAtUtc },
      afterValues: { status: updated.status, endAtUtc: updated.endAtUtc, unpaidBreakSeconds },
      reason: null,
      revision: nextRevision,
      eventId,
      timestamp: effectiveTimestamp,
    });

    await timesheetStore.waitForPendingSyncs();

    return updated;
  }

  async saveManagerEdit(
    shiftId: string,
    actor: { id: string; name: string },
    expectedRevision: number,
    updates: { startAtUtc?: string; endAtUtc?: string; unpaidBreakSeconds?: number },
    reason: string
  ): Promise<ShiftRecord> {
    if (!reason || reason.trim().length === 0) {
      throw new Error('REASON_REQUIRED');
    }
    const shift = timesheetStore.getShift(shiftId);
    if (!shift) throw new Error('SHIFT_NOT_FOUND');
    if (shift.revision !== expectedRevision) throw new Error('STALE_REVISION_CONFLICT');

    const nextStart = updates.startAtUtc || shift.startAtUtc;
    const nextEnd = updates.endAtUtc || shift.endAtUtc;
    const nextBreak = updates.unpaidBreakSeconds !== undefined ? updates.unpaidBreakSeconds : shift.unpaidBreakSeconds;

    if (nextEnd) {
      const val = validateShiftInterval(nextStart, nextEnd, nextBreak);
      if (!val.valid) throw new Error(val.error);
      const overlap = hasShiftOverlap(timesheetStore.getShiftsByEmployee(shift.employeeId), {
        startAtUtc: nextStart,
        endAtUtc: nextEnd,
        id: shift.id,
      });
      if (overlap) throw new Error('OVERLAPPING_SHIFT');
    }

    const nextRevision = shift.revision + 1;
    const now = new Date().toISOString();
    const updated: ShiftRecord = {
      ...shift,
      startAtUtc: nextStart,
      endAtUtc: nextEnd,
      unpaidBreakSeconds: nextBreak,
      revision: nextRevision,
      updatedAt: now,
      managerNote: reason,
    };

    timesheetStore.saveShift(updated);
    timesheetStore.appendAuditEvent({
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      shiftId,
      actorId: actor.id,
      actorName: actor.name,
      action: 'manager_edit',
      beforeValues: { ...shift },
      afterValues: { ...updated },
      reason,
      revision: nextRevision,
      eventId: `edit-${Date.now()}`,
      timestamp: now,
    });

    await timesheetStore.waitForPendingSyncs();

    return updated;
  }

  async approveShift(
    shiftId: string,
    actor: { id: string; name: string },
    expectedRevision: number,
    updates?: { startAtUtc?: string; endAtUtc?: string; unpaidBreakSeconds?: number },
    reason?: string
  ): Promise<ShiftRecord> {
    const shift = timesheetStore.getShift(shiftId);
    if (!shift) throw new Error('SHIFT_NOT_FOUND');
    if (actor.id === shift.employeeId) throw new Error('SELF_APPROVAL_DISABLED');
    if (shift.revision !== expectedRevision) throw new Error('STALE_REVISION_CONFLICT');
    if (shift.status === 'active') throw new Error('CANNOT_APPROVE_ACTIVE_SHIFT');

    let base = shift;
    if (updates) {
      if (!reason || reason.trim().length === 0) throw new Error('REASON_REQUIRED');
      base = await this.saveManagerEdit(shiftId, actor, expectedRevision, updates, reason);
    }

    const nextRevision = base.revision + 1;
    const now = new Date().toISOString();
    const action: AuditAction = updates ? 'amend_approve' : 'approve';
    const approved: ShiftRecord = {
      ...base,
      status: 'approved',
      approvedAt: now,
      approvedBy: actor.id,
      revision: nextRevision,
      updatedAt: now,
    };

    timesheetStore.saveShift(approved);
    timesheetStore.appendAuditEvent({
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      shiftId,
      actorId: actor.id,
      actorName: actor.name,
      action,
      beforeValues: { status: base.status, approvedAt: base.approvedAt },
      afterValues: { status: 'approved', approvedAt: now, approvedBy: actor.id },
      reason: reason || null,
      revision: nextRevision,
      eventId: `appr-${Date.now()}`,
      timestamp: now,
    });

    await timesheetStore.waitForPendingSyncs();

    return approved;
  }

  async returnForCorrection(
    shiftId: string,
    actor: { id: string; name: string },
    expectedRevision: number,
    feedbackNote: string
  ): Promise<ShiftRecord> {
    if (!feedbackNote || feedbackNote.trim().length === 0) throw new Error('FEEDBACK_REQUIRED');
    const shift = timesheetStore.getShift(shiftId);
    if (!shift) throw new Error('SHIFT_NOT_FOUND');
    if (shift.revision !== expectedRevision) throw new Error('STALE_REVISION_CONFLICT');

    const nextRevision = shift.revision + 1;
    const now = new Date().toISOString();
    const updated: ShiftRecord = {
      ...shift,
      status: 'needs_correction',
      managerNote: feedbackNote,
      revision: nextRevision,
      updatedAt: now,
    };

    timesheetStore.saveShift(updated);
    timesheetStore.appendAuditEvent({
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      shiftId,
      actorId: actor.id,
      actorName: actor.name,
      action: 'return_for_correction',
      beforeValues: { status: shift.status },
      afterValues: { status: 'needs_correction', managerNote: feedbackNote },
      reason: feedbackNote,
      revision: nextRevision,
      eventId: `ret-${Date.now()}`,
      timestamp: now,
    });

    await timesheetStore.waitForPendingSyncs();

    return updated;
  }

  async requestCorrection(params: {
    shiftId: string | null;
    employee: { id: string; name: string };
    proposedStart: string;
    proposedEnd: string;
    proposedBreakSeconds: number;
    reason: string;
    baseRevision?: number;
  }): Promise<CorrectionRequest> {
    if (!params.reason || params.reason.trim().length === 0) throw new Error('REASON_REQUIRED');
    const val = validateShiftInterval(params.proposedStart, params.proposedEnd, params.proposedBreakSeconds);
    if (!val.valid) throw new Error(val.error);

    const now = new Date().toISOString();
    const request: CorrectionRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      shiftId: params.shiftId,
      employeeId: params.employee.id,
      employeeName: params.employee.name,
      proposedStart: params.proposedStart,
      proposedEnd: params.proposedEnd,
      proposedBreakSeconds: params.proposedBreakSeconds,
      timeZone: DEFAULT_TIMEZONE,
      reason: params.reason,
      status: 'pending',
      baseRevision: params.baseRevision || 1,
      submittedAt: now,
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
    };

    timesheetStore.saveCorrectionRequest(request);
    await timesheetStore.waitForPendingSyncs();
    return request;
  }

  async reviewCorrectionRequest(
    requestId: string,
    actor: { id: string; name: string },
    decision: 'approve' | 'reject',
    reviewNote: string
  ): Promise<CorrectionRequest> {
    const req = timesheetStore.getCorrectionRequest(requestId);
    if (!req) throw new Error('REQUEST_NOT_FOUND');
    if (req.status !== 'pending') throw new Error('REQUEST_ALREADY_RESOLVED');

    const now = new Date().toISOString();
    if (decision === 'approve') {
      if (req.shiftId) {
        const shift = timesheetStore.getShift(req.shiftId);
        if (shift) {
          await this.saveManagerEdit(
            shift.id,
            actor,
            shift.revision,
            {
              startAtUtc: req.proposedStart,
              endAtUtc: req.proposedEnd,
              unpaidBreakSeconds: req.proposedBreakSeconds,
            },
            `Approved correction request: ${req.reason}`
          );
        }
      } else {
        // Missing hours shift creation
        const newShift = await this.clockIn(req.employeeId, req.employeeName, 'manual', `corr-${req.id}`, req.proposedStart);
        await this.clockOut(req.employeeId, 'manual', `corr-out-${req.id}`, req.proposedBreakSeconds, req.proposedEnd);
        await this.approveShift(newShift.id, actor, 2, undefined, `Approved missing hours request: ${req.reason}`);
      }
    }

    const updated: CorrectionRequest = {
      ...req,
      status: decision === 'approve' ? 'approved' : 'rejected',
      reviewedAt: now,
      reviewedBy: actor.id,
      reviewNote: reviewNote || null,
    };

    timesheetStore.saveCorrectionRequest(updated);
    await timesheetStore.waitForPendingSyncs();
    return updated;
  }

  getWeeklySummary(
    employeeId?: string,
    anchorDate: Date | string = new Date(),
    timeZone = DEFAULT_TIMEZONE
  ): TimesheetSummary {
    const { weekStartUtc, weekEndUtc } = getWeekBoundariesUtc(anchorDate, timeZone);
    const startMs = new Date(weekStartUtc).getTime();
    const endMs = new Date(weekEndUtc).getTime();

    const shifts = employeeId
      ? timesheetStore.getShiftsByEmployee(employeeId)
      : timesheetStore.getAllShifts();

    let approvedSeconds = 0;
    let pendingSeconds = 0;
    let activeCount = 0;
    let attentionCount = 0;

    for (const s of shifts) {
      const sStartMs = new Date(s.startAtUtc).getTime();
      if (sStartMs < startMs || sStartMs > endMs) continue;

      if (s.status === 'active') {
        activeCount++;
      } else if (s.status === 'approved' && s.endAtUtc) {
        approvedSeconds += calculateNetSeconds(s.startAtUtc, s.endAtUtc, s.unpaidBreakSeconds);
      } else if (s.status === 'pending' && s.endAtUtc) {
        pendingSeconds += calculateNetSeconds(s.startAtUtc, s.endAtUtc, s.unpaidBreakSeconds);
      } else if (s.status === 'needs_correction') {
        attentionCount++;
      }
    }

    return { approvedSeconds, pendingSeconds, activeCount, attentionCount };
  }
}

export const timesheetService = new TimesheetService();

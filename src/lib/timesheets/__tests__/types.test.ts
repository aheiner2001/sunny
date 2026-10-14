import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import {
  SHIFT_STATUSES,
  PUNCH_SOURCES,
  CORRECTION_STATUSES,
  AUDIT_ACTIONS,
  type ShiftRecord,
  type CorrectionRequest,
  type AuditEvent,
  type ActiveShiftGuard,
  type TimesheetSummary,
} from '../types';

describe('Timesheet Types', () => {
  it('exports valid constant arrays for statuses and actions', () => {
    expect(SHIFT_STATUSES).toEqual(['active', 'pending', 'needs_correction', 'approved']);
    expect(PUNCH_SOURCES).toEqual(['qr', 'manual', 'checklist_return']);
    expect(CORRECTION_STATUSES).toEqual(['pending', 'approved', 'rejected']);
    expect(AUDIT_ACTIONS).toContain('clock_in');
    expect(AUDIT_ACTIONS).toContain('amend_approve');
  });

  it('supports valid ShiftRecord and status values', () => {
    const shift: ShiftRecord = {
      id: 'shift-1',
      employeeId: 'usr-1',
      employeeName: 'Driver Dan',
      locationId: 'loc-main',
      status: 'active',
      timeZone: 'America/Denver',
      startAtUtc: '2026-10-14T14:00:00.000Z',
      endAtUtc: null,
      unpaidBreakSeconds: 0,
      startSource: 'qr',
      endSource: null,
      startEventId: 'evt-1',
      endEventId: null,
      revision: 1,
      createdAt: '2026-10-14T14:00:00.000Z',
      updatedAt: '2026-10-14T14:00:00.000Z',
      submittedAt: null,
      approvedAt: null,
      approvedBy: null,
    };
    expect(shift.status).toBe('active');
    expect(shift.unpaidBreakSeconds).toBe(0);
  });

  it('supports valid CorrectionRequest', () => {
    const correction: CorrectionRequest = {
      id: 'cr-1',
      shiftId: 'shift-1',
      employeeId: 'usr-1',
      employeeName: 'Driver Dan',
      proposedStart: '2026-10-14T14:00:00.000Z',
      proposedEnd: '2026-10-14T22:00:00.000Z',
      proposedBreakSeconds: 1800,
      timeZone: 'America/Denver',
      reason: 'Forgot to punch out',
      status: 'pending',
      baseRevision: 1,
      submittedAt: '2026-10-14T22:05:00.000Z',
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
    };
    expect(correction.status).toBe('pending');
  });

  it('supports valid AuditEvent', () => {
    const event: AuditEvent = {
      id: 'audit-1',
      shiftId: 'shift-1',
      actorId: 'usr-1',
      actorName: 'Driver Dan',
      action: 'clock_in',
      beforeValues: null,
      afterValues: { status: 'active' },
      reason: null,
      revision: 1,
      eventId: 'evt-1',
      timestamp: '2026-10-14T14:00:00.000Z',
    };
    expect(event.action).toBe('clock_in');
  });

  it('supports valid ActiveShiftGuard and TimesheetSummary', () => {
    const guard: ActiveShiftGuard = {
      employeeId: 'usr-1',
      activeShiftId: 'shift-1',
      revision: 1,
    };
    const summary: TimesheetSummary = {
      approvedSeconds: 3600,
      pendingSeconds: 1800,
      activeCount: 1,
      attentionCount: 0,
    };
    expect(guard.activeShiftId).toBe('shift-1');
    expect(summary.activeCount).toBe(1);
  });

  it('verifies luxon DateTime parses ISO timestamp and handles timezones', () => {
    const dt = DateTime.fromISO('2026-10-14T14:00:00.000Z', { zone: 'utc' });
    expect(dt.isValid).toBe(true);
    expect(dt.setZone('America/Denver').hour).toBe(8);
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { timesheetStore, TIMESHEET_STORAGE_KEYS, sanitizeForFirestore } from '../timesheetStore';
import type { ShiftRecord, ActiveShiftGuard, AuditEvent, CorrectionRequest } from '../types';

describe('Timesheet Firebase & LocalStorage Persistence', () => {
  beforeEach(() => {
    timesheetStore.reset();
  });

  it('persists shifts to localStorage so data survives reloads', () => {
    const shift: ShiftRecord = {
      id: 'shift-fb-1',
      employeeId: 'usr-100',
      employeeName: 'Driver Dan',
      locationId: 'loc-main',
      status: 'pending',
      timeZone: 'America/Denver',
      startAtUtc: '2026-10-14T14:00:00.000Z',
      endAtUtc: '2026-10-14T22:00:00.000Z',
      unpaidBreakSeconds: 1800,
      startSource: 'qr',
      endSource: 'checklist_return',
      startEventId: 'evt-start',
      endEventId: 'evt-end',
      revision: 1,
      createdAt: '2026-10-14T14:00:00.000Z',
      updatedAt: '2026-10-14T22:00:00.000Z',
      submittedAt: '2026-10-14T22:00:00.000Z',
      approvedAt: null,
      approvedBy: null,
    };

    timesheetStore.saveShift(shift);

    // Verify localStorage holds the shift
    const raw = localStorage.getItem(TIMESHEET_STORAGE_KEYS.SHIFTS);
    expect(raw).not.toBeNull();
    const parsed: ShiftRecord[] = JSON.parse(raw!);
    expect(parsed.some((s) => s.id === 'shift-fb-1')).toBe(true);

    // Simulate page reload by creating fresh store rehydrated from localStorage
    timesheetStore.init();
    expect(timesheetStore.getShift('shift-fb-1')).not.toBeNull();
    expect(timesheetStore.getShift('shift-fb-1')?.employeeName).toBe('Driver Dan');
  });

  it('persists active shift guards to localStorage', () => {
    timesheetStore.setActiveShiftGuard('usr-100', 'shift-fb-1');
    const raw = localStorage.getItem(TIMESHEET_STORAGE_KEYS.GUARDS);
    expect(raw).not.toBeNull();
    const parsed: ActiveShiftGuard[] = JSON.parse(raw!);
    expect(parsed.find((g) => g.employeeId === 'usr-100')?.activeShiftId).toBe('shift-fb-1');
  });

  it('persists audit events and corrections to localStorage', () => {
    const audit: AuditEvent = {
      id: 'aud-test-1',
      shiftId: 'shift-fb-1',
      actorId: 'usr-100',
      actorName: 'Driver Dan',
      action: 'clock_in',
      beforeValues: null,
      afterValues: { id: 'shift-fb-1', status: 'active' },
      reason: null,
      revision: 1,
      eventId: 'evt-start',
      timestamp: '2026-10-14T14:00:00.000Z',
    };
    timesheetStore.appendAuditEvent(audit);

    const rawAudit = localStorage.getItem(TIMESHEET_STORAGE_KEYS.AUDIT);
    expect(rawAudit).not.toBeNull();

    const correction: CorrectionRequest = {
      id: 'req-test-1',
      shiftId: 'shift-fb-1',
      employeeId: 'usr-100',
      employeeName: 'Driver Dan',
      proposedStart: '2026-10-14T14:00:00.000Z',
      proposedEnd: '2026-10-14T22:30:00.000Z',
      proposedBreakSeconds: 1800,
      timeZone: 'America/Denver',
      reason: 'Forgot to log last stop',
      status: 'pending',
      baseRevision: 1,
      submittedAt: '2026-10-14T22:35:00.000Z',
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
    };
    timesheetStore.saveCorrectionRequest(correction);

    const rawCorr = localStorage.getItem(TIMESHEET_STORAGE_KEYS.CORRECTIONS);
    expect(rawCorr).not.toBeNull();
  });

  it('dispatches sunny_timesheet_update window event when data changes', () => {
    const listener = vi.fn();
    window.addEventListener('sunny_timesheet_update', listener);

    timesheetStore.saveShift({
      id: 'shift-event-1',
      employeeId: 'usr-101',
      employeeName: 'Alice',
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
    });

    expect(listener).toHaveBeenCalled();
    window.removeEventListener('sunny_timesheet_update', listener);
  });

  it('correctly sanitizes undefined values to null for Firestore compliance', () => {
    const rawData = {
      id: 'test-1',
      note: undefined,
      nested: {
        field: undefined,
        active: true,
        items: [1, undefined, 'text'],
      },
      date: new Date('2026-10-14T12:00:00.000Z'),
    };

    const sanitized = sanitizeForFirestore(rawData);
    expect(sanitized.note).toBeNull();
    expect(sanitized.nested.field).toBeNull();
    expect(sanitized.nested.active).toBe(true);
    expect(sanitized.nested.items[1]).toBeNull();
    expect(sanitized.date).toBe('2026-10-14T12:00:00.000Z');
  });

  it('waits for pending sync operations cleanly', async () => {
    await expect(timesheetStore.waitForPendingSyncs()).resolves.toBeUndefined();
  });
});

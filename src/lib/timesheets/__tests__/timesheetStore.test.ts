import { describe, it, expect, beforeEach } from 'vitest';
import { timesheetStore, SAMPLE_SHIFTS, SAMPLE_CORRECTIONS } from '../timesheetStore';
import type { ShiftRecord, CorrectionRequest, AuditEvent } from '../types';

describe('timesheetStore', () => {
  beforeEach(() => {
    timesheetStore.reset();
  });

  describe('shifts CRUD', () => {
    const sampleShift: ShiftRecord = {
      id: 'shift-10',
      employeeId: 'emp-1',
      employeeName: 'Sarah Connor',
      locationId: 'loc-main',
      status: 'active',
      timeZone: 'America/Denver',
      startAtUtc: '2026-10-14T14:00:00.000Z',
      endAtUtc: null,
      unpaidBreakSeconds: 0,
      startSource: 'qr',
      endSource: null,
      startEventId: 'evt-10',
      endEventId: null,
      revision: 1,
      createdAt: '2026-10-14T14:00:00.000Z',
      updatedAt: '2026-10-14T14:00:00.000Z',
      submittedAt: null,
      approvedAt: null,
      approvedBy: null,
    };

    it('saves and retrieves shifts by employee and id', () => {
      timesheetStore.saveShift(sampleShift);
      expect(timesheetStore.getShift('shift-10')).toEqual(sampleShift);
      expect(timesheetStore.getShiftsByEmployee('emp-1')).toHaveLength(1);
    });

    it('returns null for nonexistent shift', () => {
      expect(timesheetStore.getShift('nonexistent')).toBeNull();
    });

    it('returns shifts sorted descending by startAtUtc in getAllShifts', () => {
      const shiftEarlier: ShiftRecord = {
        ...sampleShift,
        id: 'shift-early',
        startAtUtc: '2026-10-14T10:00:00.000Z',
      };
      const shiftLater: ShiftRecord = {
        ...sampleShift,
        id: 'shift-late',
        startAtUtc: '2026-10-14T18:00:00.000Z',
      };

      timesheetStore.saveShift(shiftEarlier);
      timesheetStore.saveShift(shiftLater);

      const all = timesheetStore.getAllShifts();
      expect(all).toHaveLength(2);
      expect(all[0].id).toBe('shift-late');
      expect(all[1].id).toBe('shift-early');
    });

    it('filters shifts by employee correctly', () => {
      timesheetStore.saveShift(sampleShift);
      timesheetStore.saveShift({
        ...sampleShift,
        id: 'shift-emp2',
        employeeId: 'emp-2',
      });

      expect(timesheetStore.getShiftsByEmployee('emp-1')).toHaveLength(1);
      expect(timesheetStore.getShiftsByEmployee('emp-2')).toHaveLength(1);
      expect(timesheetStore.getShiftsByEmployee('emp-3')).toHaveLength(0);
    });

    it('clones saved shift to prevent external mutation', () => {
      const mutable = { ...sampleShift };
      timesheetStore.saveShift(mutable);
      mutable.employeeName = 'Mutated Name';

      const retrieved = timesheetStore.getShift('shift-10');
      expect(retrieved?.employeeName).toBe('Sarah Connor');
    });

    it('deletes shift by id and returns boolean status', () => {
      timesheetStore.saveShift(sampleShift);
      expect(timesheetStore.deleteShift('shift-10')).toBe(true);
      expect(timesheetStore.getShift('shift-10')).toBeNull();
      expect(timesheetStore.deleteShift('shift-10')).toBe(false);
    });
  });

  describe('active shift guards', () => {
    it('manages active shift guards transactionally', () => {
      expect(timesheetStore.getActiveShiftGuard('emp-1')).toBeNull();
      timesheetStore.setActiveShiftGuard('emp-1', 'shift-10');
      expect(timesheetStore.getActiveShiftGuard('emp-1')?.activeShiftId).toBe('shift-10');
      expect(timesheetStore.getActiveShiftGuard('emp-1')?.revision).toBe(1);

      timesheetStore.setActiveShiftGuard('emp-1', 'shift-11');
      expect(timesheetStore.getActiveShiftGuard('emp-1')?.activeShiftId).toBe('shift-11');
      expect(timesheetStore.getActiveShiftGuard('emp-1')?.revision).toBe(2);

      timesheetStore.clearActiveShiftGuard('emp-1');
      expect(timesheetStore.getActiveShiftGuard('emp-1')?.activeShiftId).toBeNull();
      expect(timesheetStore.getActiveShiftGuard('emp-1')?.revision).toBe(3);
    });

    it('does not throw or set guard when clearing non-existent guard', () => {
      timesheetStore.clearActiveShiftGuard('emp-unknown');
      expect(timesheetStore.getActiveShiftGuard('emp-unknown')).toBeNull();
    });
  });

  describe('audit events', () => {
    it('records audit events immutably and returns them in ascending chronological order', () => {
      const event1: AuditEvent = {
        id: 'aud-1',
        shiftId: 'shift-10',
        actorId: 'emp-1',
        actorName: 'Sarah Connor',
        action: 'clock_in',
        beforeValues: null,
        afterValues: { id: 'shift-10', status: 'active' },
        reason: null,
        revision: 1,
        eventId: 'evt-10',
        timestamp: '2026-10-14T14:00:00.000Z',
      };

      const event2: AuditEvent = {
        id: 'aud-2',
        shiftId: 'shift-10',
        actorId: 'emp-1',
        actorName: 'Sarah Connor',
        action: 'clock_out',
        beforeValues: { status: 'active' },
        afterValues: { status: 'pending' },
        reason: null,
        revision: 2,
        eventId: 'evt-11',
        timestamp: '2026-10-14T22:00:00.000Z',
      };

      // Append in reverse order to test sorting
      timesheetStore.appendAuditEvent(event2);
      timesheetStore.appendAuditEvent(event1);

      const log = timesheetStore.getAuditEventsForShift('shift-10');
      expect(log).toHaveLength(2);
      expect(log[0].id).toBe('aud-1');
      expect(log[1].id).toBe('aud-2');

      const allEvents = timesheetStore.getAllAuditEvents();
      expect(allEvents).toHaveLength(2);
      expect(allEvents[0].id).toBe('aud-1');
    });

    it('returns empty array when shift has no audit events', () => {
      expect(timesheetStore.getAuditEventsForShift('shift-none')).toEqual([]);
    });
  });

  describe('correction requests CRUD', () => {
    const correction: CorrectionRequest = {
      id: 'cor-1',
      shiftId: 'shift-10',
      employeeId: 'emp-1',
      employeeName: 'Sarah Connor',
      proposedStart: '2026-10-14T13:45:00.000Z',
      proposedEnd: '2026-10-14T22:00:00.000Z',
      proposedBreakSeconds: 1800,
      timeZone: 'America/Denver',
      reason: 'Clock-in QR was scanning slowly',
      status: 'pending',
      baseRevision: 1,
      submittedAt: '2026-10-14T22:05:00.000Z',
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
    };

    it('saves and retrieves correction requests', () => {
      timesheetStore.saveCorrectionRequest(correction);
      expect(timesheetStore.getCorrectionRequest('cor-1')).toEqual(correction);
      expect(timesheetStore.getCorrectionRequestsByEmployee('emp-1')).toHaveLength(1);
    });

    it('returns null for nonexistent correction request', () => {
      expect(timesheetStore.getCorrectionRequest('cor-missing')).toBeNull();
    });

    it('returns all correction requests sorted descending by submittedAt', () => {
      const earlier: CorrectionRequest = {
        ...correction,
        id: 'cor-early',
        submittedAt: '2026-10-14T10:00:00.000Z',
      };
      const later: CorrectionRequest = {
        ...correction,
        id: 'cor-late',
        submittedAt: '2026-10-14T23:00:00.000Z',
      };

      timesheetStore.saveCorrectionRequest(earlier);
      timesheetStore.saveCorrectionRequest(later);

      const all = timesheetStore.getAllCorrectionRequests();
      expect(all).toHaveLength(2);
      expect(all[0].id).toBe('cor-late');
      expect(all[1].id).toBe('cor-early');
    });

    it('deletes correction requests and returns status', () => {
      timesheetStore.saveCorrectionRequest(correction);
      expect(timesheetStore.deleteCorrectionRequest('cor-1')).toBe(true);
      expect(timesheetStore.getCorrectionRequest('cor-1')).toBeNull();
      expect(timesheetStore.deleteCorrectionRequest('cor-1')).toBe(false);
    });
  });

  describe('reset and seed helpers', () => {
    it('resets all stores completely', () => {
      timesheetStore.saveShift({
        id: 'shift-1',
        employeeId: 'emp-1',
        employeeName: 'Sarah',
        locationId: 'loc-1',
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
      timesheetStore.setActiveShiftGuard('emp-1', 'shift-1');
      timesheetStore.appendAuditEvent({
        id: 'aud-1',
        shiftId: 'shift-1',
        actorId: 'emp-1',
        actorName: 'Sarah',
        action: 'clock_in',
        beforeValues: null,
        afterValues: { id: 'shift-1' },
        reason: null,
        revision: 1,
        eventId: 'evt-1',
        timestamp: '2026-10-14T14:00:00.000Z',
      });
      timesheetStore.saveCorrectionRequest({
        id: 'cor-1',
        shiftId: 'shift-1',
        employeeId: 'emp-1',
        employeeName: 'Sarah',
        proposedStart: '2026-10-14T14:00:00.000Z',
        proposedEnd: '2026-10-14T20:00:00.000Z',
        proposedBreakSeconds: 0,
        timeZone: 'America/Denver',
        reason: 'Typo',
        status: 'pending',
        baseRevision: 1,
        submittedAt: '2026-10-14T20:00:00.000Z',
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: null,
      });

      timesheetStore.reset();

      expect(timesheetStore.getAllShifts()).toHaveLength(0);
      expect(timesheetStore.getActiveShiftGuard('emp-1')).toBeNull();
      expect(timesheetStore.getAllAuditEvents()).toHaveLength(0);
      expect(timesheetStore.getAllCorrectionRequests()).toHaveLength(0);
    });

    it('seeds sample data when requested', () => {
      timesheetStore.seed();
      expect(timesheetStore.getAllShifts().length).toBeGreaterThan(0);
      expect(timesheetStore.getAllCorrectionRequests().length).toBeGreaterThan(0);
      expect(timesheetStore.getAllAuditEvents().length).toBeGreaterThan(0);

      const johnShifts = timesheetStore.getShiftsByEmployee('user-john');
      expect(johnShifts.length).toBeGreaterThan(0);
    });

    it('seedIfEmpty only populates data when store has no shifts', () => {
      timesheetStore.seedIfEmpty();
      const initialCount = timesheetStore.getAllShifts().length;
      expect(initialCount).toBeGreaterThan(0);

      // Calling seedIfEmpty again does not duplicate or change count
      timesheetStore.seedIfEmpty();
      expect(timesheetStore.getAllShifts().length).toBe(initialCount);
    });
  });
});

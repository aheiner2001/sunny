import { describe, it, expect, beforeEach } from 'vitest';
import { timesheetService } from '../timesheetService';
import { timesheetStore } from '../timesheetStore';

describe('timesheetService', () => {
  beforeEach(() => {
    timesheetStore.reset();
  });

  describe('clockIn', () => {
    it('clocks in and idempotently returns existing active shift on duplicate clock-in', async () => {
      const shift1 = await timesheetService.clockIn('emp-1', 'Alice', 'qr', 'evt-1', '2026-10-14T14:00:00.000Z');
      expect(shift1.status).toBe('active');
      expect(shift1.startAtUtc).toBe('2026-10-14T14:00:00.000Z');

      // Duplicate scan 10 mins later with different eventId must preserve original shift & start
      const shift2 = await timesheetService.clockIn('emp-1', 'Alice', 'qr', 'evt-2', '2026-10-14T14:10:00.000Z');
      expect(shift2.id).toBe(shift1.id);
      expect(shift2.startAtUtc).toBe('2026-10-14T14:00:00.000Z');
    });

    it('creates a new shift if previous shift was closed', async () => {
      const shift1 = await timesheetService.clockIn('emp-1', 'Alice', 'qr', 'evt-1', '2026-10-14T08:00:00.000Z');
      await timesheetService.clockOut('emp-1', 'qr', 'evt-2', 0, '2026-10-14T12:00:00.000Z');

      const shift2 = await timesheetService.clockIn('emp-1', 'Alice', 'qr', 'evt-3', '2026-10-14T13:00:00.000Z');
      expect(shift2.id).not.toBe(shift1.id);
      expect(shift2.status).toBe('active');
      expect(shift2.startAtUtc).toBe('2026-10-14T13:00:00.000Z');
    });

    it('records an audit event on clockIn', async () => {
      const shift = await timesheetService.clockIn('emp-1', 'Alice', 'qr', 'evt-1', '2026-10-14T14:00:00.000Z');
      const audits = timesheetStore.getAuditEventsForShift(shift.id);
      expect(audits).toHaveLength(1);
      expect(audits[0].action).toBe('clock_in');
      expect(audits[0].actorId).toBe('emp-1');
    });
  });

  describe('clockOut', () => {
    it('clocks out active shift transitioning directly to pending', async () => {
      await timesheetService.clockIn('emp-1', 'Alice', 'qr', 'evt-1', '2026-10-14T14:00:00.000Z');
      const out = await timesheetService.clockOut('emp-1', 'checklist_return', 'evt-out-1', 1800, '2026-10-14T22:00:00.000Z');
      expect(out.status).toBe('pending');
      expect(out.endAtUtc).toBe('2026-10-14T22:00:00.000Z');
      expect(out.unpaidBreakSeconds).toBe(1800);
      expect(out.endSource).toBe('checklist_return');

      // Guard should be cleared
      const guard = timesheetStore.getActiveShiftGuard('emp-1');
      expect(guard?.activeShiftId).toBeNull();
    });

    it('handles idempotent retry when clocking out with same eventId', async () => {
      await timesheetService.clockIn('emp-1', 'Alice', 'qr', 'evt-1', '2026-10-14T14:00:00.000Z');
      const out1 = await timesheetService.clockOut('emp-1', 'checklist_return', 'evt-out-1', 1800, '2026-10-14T22:00:00.000Z');

      const out2 = await timesheetService.clockOut('emp-1', 'checklist_return', 'evt-out-1', 1800, '2026-10-14T22:00:00.000Z');
      expect(out2.id).toBe(out1.id);
      expect(out2.status).toBe('pending');
    });

    it('throws NO_ACTIVE_SHIFT when clocking out with no open shift', async () => {
      await expect(
        timesheetService.clockOut('emp-none', 'checklist_return', 'evt-1', 0, '2026-10-14T14:00:00.000Z')
      ).rejects.toThrow('NO_ACTIVE_SHIFT');
    });

    it('validates shift interval on clock out (e.g. end before start)', async () => {
      await timesheetService.clockIn('emp-1', 'Alice', 'qr', 'evt-1', '2026-10-14T14:00:00.000Z');
      await expect(
        timesheetService.clockOut('emp-1', 'checklist_return', 'evt-2', 0, '2026-10-14T13:00:00.000Z')
      ).rejects.toThrow('Shift end time must be strictly after start time');
    });

    it('validates shift interval on clock out (break exceeding duration)', async () => {
      await timesheetService.clockIn('emp-1', 'Alice', 'qr', 'evt-1', '2026-10-14T14:00:00.000Z');
      await expect(
        timesheetService.clockOut('emp-1', 'checklist_return', 'evt-2', 7200, '2026-10-14T15:00:00.000Z')
      ).rejects.toThrow('Unpaid break cannot meet or exceed total elapsed shift duration');
    });
  });

  describe('saveManagerEdit', () => {
    it('rejects edit without reason', async () => {
      await timesheetService.clockIn('emp-1', 'Alice', 'manual', 'evt-1', '2026-10-14T14:00:00.000Z');
      const closed = await timesheetService.clockOut('emp-1', 'manual', 'evt-2', 0, '2026-10-14T18:00:00.000Z');

      await expect(
        timesheetService.saveManagerEdit(
          closed.id,
          { id: 'mgr-1', name: 'Bob' },
          closed.revision,
          { unpaidBreakSeconds: 900 },
          '   '
        )
      ).rejects.toThrow('REASON_REQUIRED');
    });

    it('throws SHIFT_NOT_FOUND for non-existent shift', async () => {
      await expect(
        timesheetService.saveManagerEdit(
          'non-existent',
          { id: 'mgr-1', name: 'Bob' },
          1,
          { unpaidBreakSeconds: 900 },
          'Valid reason'
        )
      ).rejects.toThrow('SHIFT_NOT_FOUND');
    });

    it('rejects stale edits with STALE_REVISION_CONFLICT', async () => {
      await timesheetService.clockIn('emp-1', 'Alice', 'manual', 'evt-1', '2026-10-14T14:00:00.000Z');
      const closed = await timesheetService.clockOut('emp-1', 'manual', 'evt-2', 0, '2026-10-14T18:00:00.000Z');

      // Manager 1 edits with closed.revision (2) -> becomes revision 3
      await timesheetService.saveManagerEdit(
        closed.id,
        { id: 'mgr-1', name: 'Bob' },
        closed.revision,
        { unpaidBreakSeconds: 900 },
        'Added missing break'
      );

      // Manager 2 tries to edit with stale revision (closed.revision = 2) -> rejected
      await expect(
        timesheetService.saveManagerEdit(
          closed.id,
          { id: 'mgr-2', name: 'Charlie' },
          closed.revision,
          { unpaidBreakSeconds: 1200 },
          'Conflicting break edit'
        )
      ).rejects.toThrow('STALE_REVISION_CONFLICT');
    });

    it('rejects manager edits causing shift overlap', async () => {
      // Shift 1: 08:00 - 12:00
      await timesheetService.clockIn('emp-1', 'Alice', 'manual', 'evt-1', '2026-10-14T08:00:00.000Z');
      await timesheetService.clockOut('emp-1', 'manual', 'evt-2', 0, '2026-10-14T12:00:00.000Z');

      // Shift 2: 13:00 - 17:00
      const shift2 = await timesheetService.clockIn('emp-1', 'Alice', 'manual', 'evt-3', '2026-10-14T13:00:00.000Z');
      const closed2 = await timesheetService.clockOut('emp-1', 'manual', 'evt-4', 0, '2026-10-14T17:00:00.000Z');

      // Try editing Shift 2 to start at 11:00 (overlaps with Shift 1)
      await expect(
        timesheetService.saveManagerEdit(
          closed2.id,
          { id: 'mgr-1', name: 'Bob' },
          closed2.revision,
          { startAtUtc: '2026-10-14T11:00:00.000Z' },
          'Adjust shift start'
        )
      ).rejects.toThrow('OVERLAPPING_SHIFT');
    });

    it('successfully saves manager edit and records audit event', async () => {
      await timesheetService.clockIn('emp-1', 'Alice', 'manual', 'evt-1', '2026-10-14T14:00:00.000Z');
      const closed = await timesheetService.clockOut('emp-1', 'manual', 'evt-2', 0, '2026-10-14T18:00:00.000Z');

      const updated = await timesheetService.saveManagerEdit(
        closed.id,
        { id: 'mgr-1', name: 'Bob' },
        closed.revision,
        { unpaidBreakSeconds: 900 },
        'Added 15 min break'
      );

      expect(updated.unpaidBreakSeconds).toBe(900);
      expect(updated.managerNote).toBe('Added 15 min break');
      expect(updated.revision).toBe(closed.revision + 1);

      const audits = timesheetStore.getAuditEventsForShift(closed.id);
      const editAudit = audits.find((a) => a.action === 'manager_edit');
      expect(editAudit).toBeDefined();
      expect(editAudit?.reason).toBe('Added 15 min break');
      expect(editAudit?.actorId).toBe('mgr-1');
    });
  });

  describe('approveShift', () => {
    it('prevents manager self-approval per prototype default', async () => {
      await timesheetService.clockIn('mgr-1', 'Bob Manager', 'manual', 'evt-1', '2026-10-14T14:00:00.000Z');
      const closed = await timesheetService.clockOut('mgr-1', 'manual', 'evt-2', 0, '2026-10-14T18:00:00.000Z');

      await expect(
        timesheetService.approveShift(closed.id, { id: 'mgr-1', name: 'Bob Manager' }, closed.revision)
      ).rejects.toThrow('SELF_APPROVAL_DISABLED');
    });

    it('rejects approving an active shift', async () => {
      const active = await timesheetService.clockIn('emp-1', 'Alice', 'manual', 'evt-1', '2026-10-14T14:00:00.000Z');

      await expect(
        timesheetService.approveShift(active.id, { id: 'mgr-2', name: 'Charlie' }, active.revision)
      ).rejects.toThrow('CANNOT_APPROVE_ACTIVE_SHIFT');
    });

    it('rejects approval with stale revision', async () => {
      await timesheetService.clockIn('emp-1', 'Alice', 'manual', 'evt-1', '2026-10-14T14:00:00.000Z');
      const closed = await timesheetService.clockOut('emp-1', 'manual', 'evt-2', 0, '2026-10-14T18:00:00.000Z');

      await expect(
        timesheetService.approveShift(closed.id, { id: 'mgr-2', name: 'Charlie' }, 999)
      ).rejects.toThrow('STALE_REVISION_CONFLICT');
    });

    it('allows another authorized manager to approve shift with audit trail', async () => {
      await timesheetService.clockIn('emp-1', 'Alice', 'manual', 'evt-1', '2026-10-14T14:00:00.000Z');
      const closed = await timesheetService.clockOut('emp-1', 'manual', 'evt-2', 0, '2026-10-14T18:00:00.000Z');

      const approved = await timesheetService.approveShift(
        closed.id,
        { id: 'mgr-2', name: 'Charlie Manager' },
        closed.revision
      );
      expect(approved.status).toBe('approved');
      expect(approved.approvedBy).toBe('mgr-2');

      const logs = timesheetStore.getAuditEventsForShift(closed.id);
      expect(logs.some((l) => l.action === 'approve')).toBe(true);
    });

    it('supports amend-and-approve with atomic audit logging', async () => {
      await timesheetService.clockIn('emp-1', 'Alice', 'manual', 'evt-1', '2026-10-14T14:00:00.000Z');
      const closed = await timesheetService.clockOut('emp-1', 'manual', 'evt-2', 0, '2026-10-14T18:00:00.000Z');

      const approved = await timesheetService.approveShift(
        closed.id,
        { id: 'mgr-2', name: 'Charlie Manager' },
        closed.revision,
        { unpaidBreakSeconds: 1800 },
        'Adjusted lunch break before signoff'
      );

      expect(approved.status).toBe('approved');
      expect(approved.unpaidBreakSeconds).toBe(1800);
      expect(approved.approvedBy).toBe('mgr-2');

      const logs = timesheetStore.getAuditEventsForShift(closed.id);
      expect(logs.some((l) => l.action === 'manager_edit')).toBe(true);
      expect(logs.some((l) => l.action === 'amend_approve')).toBe(true);
    });

    it('requires reason when amend-and-approve is invoked with updates', async () => {
      await timesheetService.clockIn('emp-1', 'Alice', 'manual', 'evt-1', '2026-10-14T14:00:00.000Z');
      const closed = await timesheetService.clockOut('emp-1', 'manual', 'evt-2', 0, '2026-10-14T18:00:00.000Z');

      await expect(
        timesheetService.approveShift(
          closed.id,
          { id: 'mgr-2', name: 'Charlie Manager' },
          closed.revision,
          { unpaidBreakSeconds: 1800 },
          ''
        )
      ).rejects.toThrow('REASON_REQUIRED');
    });
  });

  describe('returnForCorrection', () => {
    it('rejects without feedback note', async () => {
      await timesheetService.clockIn('emp-1', 'Alice', 'manual', 'evt-1', '2026-10-14T14:00:00.000Z');
      const closed = await timesheetService.clockOut('emp-1', 'manual', 'evt-2', 0, '2026-10-14T18:00:00.000Z');

      await expect(
        timesheetService.returnForCorrection(closed.id, { id: 'mgr-1', name: 'Bob' }, closed.revision, '')
      ).rejects.toThrow('FEEDBACK_REQUIRED');
    });

    it('rejects stale revision', async () => {
      await timesheetService.clockIn('emp-1', 'Alice', 'manual', 'evt-1', '2026-10-14T14:00:00.000Z');
      const closed = await timesheetService.clockOut('emp-1', 'manual', 'evt-2', 0, '2026-10-14T18:00:00.000Z');

      await expect(
        timesheetService.returnForCorrection(closed.id, { id: 'mgr-1', name: 'Bob' }, 999, 'Fix this')
      ).rejects.toThrow('STALE_REVISION_CONFLICT');
    });

    it('returns shift for correction and updates status and managerNote', async () => {
      await timesheetService.clockIn('emp-1', 'Alice', 'manual', 'evt-1', '2026-10-14T14:00:00.000Z');
      const closed = await timesheetService.clockOut('emp-1', 'manual', 'evt-2', 0, '2026-10-14T18:00:00.000Z');

      const returned = await timesheetService.returnForCorrection(
        closed.id,
        { id: 'mgr-1', name: 'Bob' },
        closed.revision,
        'Please verify departure time'
      );

      expect(returned.status).toBe('needs_correction');
      expect(returned.managerNote).toBe('Please verify departure time');

      const logs = timesheetStore.getAuditEventsForShift(closed.id);
      const retLog = logs.find((l) => l.action === 'return_for_correction');
      expect(retLog).toBeDefined();
      expect(retLog?.reason).toBe('Please verify departure time');
    });
  });

  describe('requestCorrection & reviewCorrectionRequest', () => {
    it('submits a correction request and validates interval and reason', async () => {
      await expect(
        timesheetService.requestCorrection({
          shiftId: 'shift-1',
          employee: { id: 'emp-1', name: 'Alice' },
          proposedStart: '2026-10-14T14:00:00.000Z',
          proposedEnd: '2026-10-14T18:00:00.000Z',
          proposedBreakSeconds: 0,
          reason: '',
        })
      ).rejects.toThrow('REASON_REQUIRED');

      const req = await timesheetService.requestCorrection({
        shiftId: 'shift-1',
        employee: { id: 'emp-1', name: 'Alice' },
        proposedStart: '2026-10-14T14:00:00.000Z',
        proposedEnd: '2026-10-14T18:00:00.000Z',
        proposedBreakSeconds: 900,
        reason: 'Forgot to clock 15 min break',
      });

      expect(req.status).toBe('pending');
      expect(req.employeeId).toBe('emp-1');
      expect(timesheetStore.getCorrectionRequest(req.id)).toBeDefined();
    });

    it('approves correction request for an existing shift', async () => {
      await timesheetService.clockIn('emp-1', 'Alice', 'manual', 'evt-1', '2026-10-14T14:00:00.000Z');
      const closed = await timesheetService.clockOut('emp-1', 'manual', 'evt-2', 0, '2026-10-14T18:00:00.000Z');

      const req = await timesheetService.requestCorrection({
        shiftId: closed.id,
        employee: { id: 'emp-1', name: 'Alice' },
        proposedStart: '2026-10-14T14:00:00.000Z',
        proposedEnd: '2026-10-14T18:00:00.000Z',
        proposedBreakSeconds: 1800,
        reason: 'Took lunch from 16:00 to 16:30',
      });

      const reviewed = await timesheetService.reviewCorrectionRequest(
        req.id,
        { id: 'mgr-1', name: 'Bob' },
        'approve',
        'Looks good'
      );

      expect(reviewed.status).toBe('approved');
      expect(reviewed.reviewedBy).toBe('mgr-1');

      const updatedShift = timesheetStore.getShift(closed.id);
      expect(updatedShift?.unpaidBreakSeconds).toBe(1800);
    });

    it('approves correction request for missing hours (shiftId null)', async () => {
      const req = await timesheetService.requestCorrection({
        shiftId: null,
        employee: { id: 'emp-2', name: 'David' },
        proposedStart: '2026-10-14T09:00:00.000Z',
        proposedEnd: '2026-10-14T17:00:00.000Z',
        proposedBreakSeconds: 1800,
        reason: 'Forgot badge on site',
      });

      const reviewed = await timesheetService.reviewCorrectionRequest(
        req.id,
        { id: 'mgr-1', name: 'Bob' },
        'approve',
        'Verified on security log'
      );

      expect(reviewed.status).toBe('approved');
      const employeeShifts = timesheetStore.getShiftsByEmployee('emp-2');
      expect(employeeShifts).toHaveLength(1);
      expect(employeeShifts[0].status).toBe('approved');
      expect(employeeShifts[0].unpaidBreakSeconds).toBe(1800);
      expect(employeeShifts[0].approvedBy).toBe('mgr-1');
    });

    it('rejects correction request without modifying shift', async () => {
      await timesheetService.clockIn('emp-1', 'Alice', 'manual', 'evt-1', '2026-10-14T14:00:00.000Z');
      const closed = await timesheetService.clockOut('emp-1', 'manual', 'evt-2', 0, '2026-10-14T18:00:00.000Z');

      const req = await timesheetService.requestCorrection({
        shiftId: closed.id,
        employee: { id: 'emp-1', name: 'Alice' },
        proposedStart: '2026-10-14T14:00:00.000Z',
        proposedEnd: '2026-10-14T18:00:00.000Z',
        proposedBreakSeconds: 1800,
        reason: 'Invalid request',
      });

      const reviewed = await timesheetService.reviewCorrectionRequest(
        req.id,
        { id: 'mgr-1', name: 'Bob' },
        'reject',
        'Not verified'
      );

      expect(reviewed.status).toBe('rejected');
      const shift = timesheetStore.getShift(closed.id);
      expect(shift?.unpaidBreakSeconds).toBe(0);
    });

    it('prevents reviewing already resolved request', async () => {
      const req = await timesheetService.requestCorrection({
        shiftId: null,
        employee: { id: 'emp-2', name: 'David' },
        proposedStart: '2026-10-14T09:00:00.000Z',
        proposedEnd: '2026-10-14T17:00:00.000Z',
        proposedBreakSeconds: 1800,
        reason: 'Forgot badge',
      });

      await timesheetService.reviewCorrectionRequest(req.id, { id: 'mgr-1', name: 'Bob' }, 'reject', 'No');

      await expect(
        timesheetService.reviewCorrectionRequest(req.id, { id: 'mgr-1', name: 'Bob' }, 'approve', 'Retry')
      ).rejects.toThrow('REQUEST_ALREADY_RESOLVED');
    });
  });

  describe('getWeeklySummary', () => {
    it('aggregates approved, pending, active, and needs_correction within week', async () => {
      // Wednesday 2026-10-14
      // Shift 1: Approved, 4 hrs net (14:00 to 18:00, 0 break) = 14400s
      const s1 = await timesheetService.clockIn('emp-1', 'Alice', 'qr', 'evt-1', '2026-10-14T14:00:00.000Z');
      const closed1 = await timesheetService.clockOut('emp-1', 'qr', 'evt-2', 0, '2026-10-14T18:00:00.000Z');
      await timesheetService.approveShift(closed1.id, { id: 'mgr-1', name: 'Bob' }, closed1.revision);

      // Shift 2: Pending, 2 hrs net (19:00 to 21:00) = 7200s
      await timesheetService.clockIn('emp-1', 'Alice', 'qr', 'evt-3', '2026-10-14T19:00:00.000Z');
      await timesheetService.clockOut('emp-1', 'qr', 'evt-4', 0, '2026-10-14T21:00:00.000Z');

      // Shift 3: Active
      await timesheetService.clockIn('emp-2', 'Bob', 'qr', 'evt-5', '2026-10-14T22:00:00.000Z');

      // Shift 4: Needs correction
      const s4 = await timesheetService.clockIn('emp-3', 'Charlie', 'qr', 'evt-6', '2026-10-14T08:00:00.000Z');
      const closed4 = await timesheetService.clockOut('emp-3', 'qr', 'evt-7', 0, '2026-10-14T10:00:00.000Z');
      await timesheetService.returnForCorrection(closed4.id, { id: 'mgr-1', name: 'Bob' }, closed4.revision, 'Please explain');

      const summary = timesheetService.getWeeklySummary(undefined, '2026-10-14T12:00:00.000Z');
      expect(summary.approvedSeconds).toBe(14400);
      expect(summary.pendingSeconds).toBe(7200);
      expect(summary.activeCount).toBe(1);
      expect(summary.attentionCount).toBe(1);

      // Filtered by emp-1
      const emp1Summary = timesheetService.getWeeklySummary('emp-1', '2026-10-14T12:00:00.000Z');
      expect(emp1Summary.approvedSeconds).toBe(14400);
      expect(emp1Summary.pendingSeconds).toBe(7200);
      expect(emp1Summary.activeCount).toBe(0);
      expect(emp1Summary.attentionCount).toBe(0);
    });

    it('excludes shifts from different weeks', async () => {
      // Prior week: 2026-10-05 (Monday)
      const s1 = await timesheetService.clockIn('emp-1', 'Alice', 'qr', 'evt-1', '2026-10-05T14:00:00.000Z');
      const closed1 = await timesheetService.clockOut('emp-1', 'qr', 'evt-2', 0, '2026-10-05T18:00:00.000Z');
      await timesheetService.approveShift(closed1.id, { id: 'mgr-1', name: 'Bob' }, closed1.revision);

      const summary = timesheetService.getWeeklySummary('emp-1', '2026-10-14T12:00:00.000Z');
      expect(summary.approvedSeconds).toBe(0);
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ShiftRecord, ActiveShiftGuard, AuditEvent, CorrectionRequest } from '../types';

const { mockSetDoc, mockDeleteDoc, mockOnSnapshot, snapshotCallbacks } = vi.hoisted(() => {
  const callbacks: Array<(snapshot: any) => void> = [];
  return {
    mockSetDoc: vi.fn().mockResolvedValue(undefined),
    mockDeleteDoc: vi.fn().mockResolvedValue(undefined),
    mockOnSnapshot: vi.fn((col: any, options: any, onNext: any, onError: any) => {
      callbacks.push(onNext);
      return vi.fn();
    }),
    snapshotCallbacks: callbacks,
  };
});

vi.mock('@/lib/firebase', () => ({
  db: { _isMock: true },
  ensureAuth: vi.fn().mockResolvedValue({uid: 'test'}),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((db: any, name: string) => ({ name })),
  doc: vi.fn((db: any, col: string, id: string) => ({ col, id })),
  setDoc: mockSetDoc,
  deleteDoc: mockDeleteDoc,
  onSnapshot: mockOnSnapshot,
  runTransaction: vi.fn(async (_db: any, callback: any) => callback({
    get: async () => ({ exists: () => false }), set: mockSetDoc,
  })),
  getDocs: vi.fn().mockResolvedValue({ empty: true, forEach: vi.fn() }),
}));

// Import after mocks are established
import { timesheetStore, FIRESTORE_COLLECTIONS } from '../timesheetStore';

describe('Timesheet Store Cloud Firestore Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    snapshotCallbacks.length = 0;
    timesheetStore.reset();
  });

  it('syncs shift creations, updates, and deletions to Firestore', async () => {
    const shift: ShiftRecord = {
      id: 'shift-cloud-1',
      employeeId: 'emp-101',
      employeeName: 'Alice',
      locationId: 'loc-main',
      status: 'active',
      timeZone: 'America/Denver',
      startAtUtc: '2026-10-14T14:00:00.000Z',
      endAtUtc: null,
      unpaidBreakSeconds: 0,
      startSource: 'qr',
      endSource: null,
      startEventId: 'evt-c1',
      endEventId: null,
      revision: 1,
      createdAt: '2026-10-14T14:00:00.000Z',
      updatedAt: '2026-10-14T14:00:00.000Z',
      submittedAt: null,
      approvedAt: null,
      approvedBy: null,
    };

    await timesheetStore.syncShiftToCloud(shift);
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ col: FIRESTORE_COLLECTIONS.SHIFTS, id: 'shift-cloud-1' }),
      expect.objectContaining({ id: 'shift-cloud-1', status: 'active', endAtUtc: null }),
      { merge: true }
    );

    await timesheetStore.deleteShiftFromCloud('shift-cloud-1');
    expect(mockDeleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ col: FIRESTORE_COLLECTIONS.SHIFTS, id: 'shift-cloud-1' })
    );
  });

  it('syncs active shift guards to Firestore', async () => {
    const guard: ActiveShiftGuard = {
      employeeId: 'emp-101',
      activeShiftId: 'shift-cloud-1',
      revision: 1,
    };

    await timesheetStore.syncGuardToCloud(guard);
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ col: FIRESTORE_COLLECTIONS.GUARDS, id: 'emp-101' }),
      expect.objectContaining({ employeeId: 'emp-101', activeShiftId: 'shift-cloud-1' }),
      { merge: true }
    );
  });

  it('syncs audit events to Firestore', async () => {
    const audit: AuditEvent = {
      id: 'aud-cloud-1',
      shiftId: 'shift-cloud-1',
      actorId: 'emp-101',
      actorName: 'Alice',
      action: 'clock_in',
      beforeValues: null,
      afterValues: { id: 'shift-cloud-1', status: 'active' },
      reason: null,
      revision: 1,
      eventId: 'evt-c1',
      timestamp: '2026-10-14T14:00:00.000Z',
    };

    await timesheetStore.syncAuditEventToCloud(audit);
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ col: FIRESTORE_COLLECTIONS.AUDIT, id: 'aud-cloud-1' }),
      expect.objectContaining({ id: 'aud-cloud-1', action: 'clock_in' }),
      { merge: true }
    );
  });

  it('syncs correction requests and deletions to Firestore', async () => {
    const correction: CorrectionRequest = {
      id: 'corr-cloud-1',
      shiftId: 'shift-cloud-1',
      employeeId: 'emp-101',
      employeeName: 'Alice',
      proposedStart: '2026-10-14T14:00:00.000Z',
      proposedEnd: '2026-10-14T22:00:00.000Z',
      proposedBreakSeconds: 1800,
      timeZone: 'America/Denver',
      reason: 'Odometer verification discrepancy',
      status: 'pending',
      baseRevision: 1,
      submittedAt: '2026-10-14T22:05:00.000Z',
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
    };

    await timesheetStore.syncCorrectionToCloud(correction);
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ col: FIRESTORE_COLLECTIONS.CORRECTIONS, id: 'corr-cloud-1' }),
      expect.objectContaining({ id: 'corr-cloud-1', status: 'pending' }),
      { merge: true }
    );

    await timesheetStore.deleteCorrectionFromCloud('corr-cloud-1');
    expect(mockDeleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ col: FIRESTORE_COLLECTIONS.CORRECTIONS, id: 'corr-cloud-1' })
    );
  });

  it('sets up Firestore snapshot listeners and hydrates store from real-time snapshots', async () => {
    await timesheetStore.setupFirestoreListeners();

    expect(mockOnSnapshot).toHaveBeenCalledTimes(4); // shifts, guards, audit, corrections

    // Simulate shifts snapshot
    const incomingShift: ShiftRecord = {
      id: 'shift-remote-1',
      employeeId: 'emp-202',
      employeeName: 'Bob',
      locationId: 'loc-main',
      status: 'pending',
      timeZone: 'America/Denver',
      startAtUtc: '2026-10-14T14:00:00.000Z',
      endAtUtc: '2026-10-14T22:00:00.000Z',
      unpaidBreakSeconds: 1800,
      startSource: 'qr',
      endSource: 'checklist_return',
      startEventId: 'evt-r1',
      endEventId: 'evt-r2',
      revision: 1,
      createdAt: '2026-10-14T14:00:00.000Z',
      updatedAt: '2026-10-14T22:00:00.000Z',
      submittedAt: '2026-10-14T22:00:00.000Z',
      approvedAt: null,
      approvedBy: null,
    };

    // Callback 0: shifts
    snapshotCallbacks[0]({
      empty: false,
      forEach: (cb: any) => cb({ data: () => incomingShift }),
    });

    expect(timesheetStore.getShift('shift-remote-1')).not.toBeNull();
    expect(timesheetStore.getShift('shift-remote-1')?.employeeName).toBe('Bob');

    // Callback 1: guards
    snapshotCallbacks[1]({
      empty: false,
      forEach: (cb: any) =>
        cb({
          data: () => ({
            employeeId: 'emp-202',
            activeShiftId: 'shift-remote-1',
            updatedAt: '2026-10-14T14:00:00.000Z',
          }),
        }),
    });
    expect(timesheetStore.getActiveShiftGuard('emp-202')?.activeShiftId).toBe('shift-remote-1');

    // Callback 2: audit
    snapshotCallbacks[2]({
      empty: false,
      forEach: (cb: any) =>
        cb({
          data: () => ({
            id: 'aud-remote-1',
            shiftId: 'shift-remote-1',
            actorId: 'emp-202',
            actorName: 'Bob',
            action: 'clock_out',
            beforeValues: null,
            afterValues: null,
            reason: null,
            revision: 1,
            eventId: 'evt-r2',
            timestamp: '2026-10-14T22:00:00.000Z',
          }),
        }),
    });
    expect(timesheetStore.getAuditEventsForShift('shift-remote-1')).toHaveLength(1);

    // Callback 3: corrections
    snapshotCallbacks[3]({
      empty: false,
      forEach: (cb: any) =>
        cb({
          data: () => ({
            id: 'corr-remote-1',
            shiftId: 'shift-remote-1',
            employeeId: 'emp-202',
            employeeName: 'Bob',
            proposedStart: '2026-10-14T14:00:00.000Z',
            proposedEnd: '2026-10-14T22:00:00.000Z',
            proposedBreakSeconds: 1800,
            timeZone: 'America/Denver',
            reason: 'Review requested',
            status: 'pending',
            baseRevision: 1,
            submittedAt: '2026-10-14T22:05:00.000Z',
            reviewedAt: null,
            reviewedBy: null,
            reviewNote: null,
          }),
        }),
    });
    expect(timesheetStore.getCorrectionRequestsByEmployee('emp-202')).toHaveLength(1);
  });

  it('seeds data with syncToCloud option enabled', async () => {
    timesheetStore.seed({ syncToCloud: true });
    await timesheetStore.waitForPendingSyncs();
    expect(mockSetDoc).toHaveBeenCalled();
  });
  it('replaces deleted remote rows even when the server snapshot is empty', async () => {
    await timesheetStore.setupFirestoreListeners();
    const emit = snapshotCallbacks[0];
    emit({ forEach: (cb: any) => cb({ data: () => ({ id: 'stale', status: 'active' }) }) });
    expect(timesheetStore.getAllShifts()).toHaveLength(1);
    emit({ empty: true, forEach: () => {} });
    expect(timesheetStore.getAllShifts()).toHaveLength(0);
  });

  it('shows listener errors and can restart listeners after failure', async () => {
    await timesheetStore.setupFirestoreListeners();
    const onError = mockOnSnapshot.mock.calls[0][3];
    onError(new Error('permission-denied'));
    expect(timesheetStore.getSyncStatus()).toContain('Cloud sync failed');
    await timesheetStore.setupFirestoreListeners();
    expect(mockOnSnapshot).toHaveBeenCalledTimes(8);
  });

  it('classifies permission-denied listener errors separately from generic failures', async () => {
    timesheetStore.reset();
    await timesheetStore.setupFirestoreListeners();
    const onError = mockOnSnapshot.mock.calls[0][3];
    onError({ code: 'permission-denied', message: 'Missing or insufficient permissions.' });
    expect(timesheetStore.getSyncStatus()).toMatch(/permission/i);
    expect(timesheetStore.getSyncStatus()).toMatch(/Firebase|rules|Console/i);
  });

  it('keeps a generic cloud-sync failure message for non-permission errors', async () => {
    timesheetStore.reset();
    await timesheetStore.setupFirestoreListeners();
    const onError = mockOnSnapshot.mock.calls[0][3];
    onError(new Error('network-request-failed'));
    expect(timesheetStore.getSyncStatus()).toContain('Cloud sync failed');
    expect(timesheetStore.getSyncStatus()).not.toMatch(/Console rules/i);
  });

  it('keeps cloud status unconfirmed until every collection has current server data', async () => {
    await timesheetStore.setupFirestoreListeners();
    const emit = (index: number, fromCache: boolean, hasPendingWrites = false) => snapshotCallbacks[index]({
      metadata: { fromCache, hasPendingWrites }, forEach: () => {},
    });
    snapshotCallbacks.forEach((_, index) => emit(index, false));
    expect(timesheetStore.getSyncStatus()).toBe('Firebase Cloud Sync Active');
    emit(0, true, true);
    emit(1, false);
    expect(timesheetStore.getSyncStatus()).not.toBe('Firebase Cloud Sync Active');
    emit(0, false);
    expect(timesheetStore.getSyncStatus()).toBe('Firebase Cloud Sync Active');
  });

});

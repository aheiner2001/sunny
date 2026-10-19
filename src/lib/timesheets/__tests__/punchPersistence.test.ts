import { beforeEach, expect, it, vi } from 'vitest';

// A transactional document store: only publishes writes after the callback succeeds.
const cloud = vi.hoisted(() => ({ docs: new Map<string, any>(), fail: false, failAfter: false, retry: false, afterReads: null as null | (() => Promise<void>), queue: Promise.resolve() }));
vi.mock('@/lib/firebase', () => ({ db: { _isMock: true }, ensureAuth: vi.fn().mockResolvedValue({ uid: 'test' }) }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, id: string) => `${col}/${id}`,
  collection: (_db: unknown, name: string) => name,
  setDoc: vi.fn(async (key: string, value: any) => { cloud.docs.set(key, value); }), deleteDoc: vi.fn(), onSnapshot: vi.fn(),
  where: (_field: string, _op: string, employeeId: string) => employeeId,
  query: (col: string, employeeId: string) => ({ col, employeeId }),
  getDoc: async (key: string) => ({ exists: () => cloud.docs.has(key), data: () => cloud.docs.get(key) }),
  getDocs: async ({ col, employeeId }: any) => {
    const values: any[] = [];
    cloud.docs.forEach((value, key) => {
      if (key.startsWith(`${col}/`) && (value.employeeId === employeeId || value.userId === employeeId)) values.push(value);
    });
    if (col === 'timesheet_corrections' && cloud.afterReads) {
      const hook = cloud.afterReads; cloud.afterReads = null; await hook();
    }
    return { forEach: (receive: any) => values.forEach(value => receive({ data: () => value })) };
  },
  getDocsFromServer: async ({ col, employeeId }: any) => {
    const values: any[] = [];
    cloud.docs.forEach((value, key) => {
      if (key.startsWith(`${col}/`) && (value.employeeId === employeeId || value.userId === employeeId)) values.push(value);
    });
    if (col === 'timesheet_corrections' && cloud.afterReads) {
      const hook = cloud.afterReads; cloud.afterReads = null; await hook();
    }
    return { forEach: (receive: any) => values.forEach(value => receive({ data: () => value })) };
  },
  runTransaction: vi.fn((_db: unknown, callback: any) => {
    const result = cloud.queue.then(async () => {
      if (cloud.fail) throw new Error('permission-denied');
      const pending = new Map<string, any>();
      const transaction = {
        get: async (key: string) => ({ exists: () => cloud.docs.has(key), data: () => cloud.docs.get(key) }),
        set: (key: string, data: any) => pending.set(key, data),
      };
      if (cloud.retry) { await callback(transaction); pending.clear(); }
      const value = await callback(transaction);
      if (cloud.failAfter) throw new Error('commit-failed');
      pending.forEach((value, key) => cloud.docs.set(key, value));
      return value;
    });
    cloud.queue = result.then(() => undefined, () => undefined);
    return result;
  }),
}));
import { timesheetService } from '../timesheetService';
import { timesheetStore } from '../timesheetStore';
beforeEach(() => { timesheetStore.reset(); cloud.docs.clear(); cloud.fail = false; cloud.failAfter = false; cloud.retry = false; cloud.afterReads = null; cloud.queue = Promise.resolve(); });
const start = () => timesheetService.clockIn('driver', 'Driver', 'qr', 'scan-1', '2026-10-19T14:00:00Z');
it('does not confirm a punch or cache an active shift when persistence fails', async () => {
  cloud.fail = true;
  await expect(start()).rejects.toThrow('permission-denied');
  expect(timesheetStore.getAllShifts()).toHaveLength(0);
});
it('finds and closes the remote shift after browser storage is cleared', async () => {
  const shift = await start();
  timesheetStore.reset();
  const ended = await timesheetService.clockOut('driver', 'checklist_return', 'return-1', 0, '2026-10-19T22:00:00Z');
  expect(ended).toMatchObject({ id: shift.id, status: 'pending' });
  expect(cloud.docs.get(`timesheet_shifts/${shift.id}`).status).toBe('pending');
  expect(cloud.docs.get('timesheet_guards/driver').activeShiftId).toBeNull();
});
it('keeps one shift and its start time across simultaneous scans and a fresh browser', async () => {
  const [first, second] = await Promise.all([start(), timesheetService.clockIn('driver', 'Driver', 'qr', 'scan-2')]);
  expect(second.id).toBe(first.id);
  timesheetStore.reset();
  expect((await start()).id).toBe(first.id);
  expect(Array.from(cloud.docs.keys()).filter(key => key.startsWith('timesheet_shifts/'))).toHaveLength(1);
});
it('retries an acknowledged return without closing a later shift', async () => {
  const original = await start();
  await timesheetService.clockOut('driver', 'checklist_return', 'return-1', 0, '2026-10-19T22:00:00Z');
  const later = await timesheetService.clockIn('driver', 'Driver', 'qr', 'scan-3', '2026-10-20T14:00:00Z');
  timesheetStore.reset();
  const retry = await timesheetService.clockOut('driver', 'checklist_return', 'return-1');
  expect(retry.id).toBe(original.id);
  expect(cloud.docs.get('timesheet_guards/driver').activeShiftId).toBe(later.id);
});

it('does not publish local shifts when the commit fails after running the callback', async () => {
  cloud.failAfter = true;
  await expect(start()).rejects.toThrow('commit-failed');
  expect(cloud.docs.size).toBe(0);
  expect(timesheetStore.getAllShifts()).toHaveLength(0);
});
it('publishes one shift and audit if Firestore retries the transaction callback', async () => {
  cloud.retry = true;
  const shift = await start();
  expect(timesheetStore.getAllShifts()).toHaveLength(1);
  expect(timesheetStore.getAllAuditEvents()).toHaveLength(1);
  expect(Array.from(cloud.docs.keys()).filter(key => key.startsWith('timesheet_shifts/'))).toHaveLength(1);
  expect(cloud.docs.get('timesheet_guards/driver').activeShiftId).toBe(shift.id);
});


import { makeRecoveredShift, buildHistoricalEstimates } from '../historicalRecovery';
import type { Inspection } from '@/types';
const recovered = () => makeRecoveredShift(buildHistoricalEstimates([
  { id: 'old-inspection', userId: 'driver', userName: 'Driver', vehicleId: 'van', submittedAt: '2026-10-12T14:00:00Z', kind: 'pretrip', status: 'passed' },
  { id: 'old-return', userId: 'driver', userName: 'Driver', vehicleId: 'van', submittedAt: '2026-10-12T22:00:00Z', kind: 'return', status: 'passed' },
] as Inspection[], [])[0], { id: 'manager', name: 'Manager' });
const seedEvidence = () => {
  cloud.docs.set('inspections/old-inspection', { id: 'old-inspection', userId: 'driver', userName: 'Driver', vehicleId: 'van', kind: 'pretrip', status: 'passed', submittedAt: '2026-10-12T14:00:00Z' });
  cloud.docs.set('inspections/old-return', { id: 'old-return', userId: 'driver', userName: 'Driver', vehicleId: 'van', kind: 'return', status: 'passed', submittedAt: '2026-10-12T22:00:00Z' });
};
it('saves recovered hours as pending without closing today’s active shift', async () => {
  seedEvidence();
  const today = await start();
  const result = await timesheetStore.saveRecoveredShift(recovered());
  expect(result.status).toBe('pending');
  expect(cloud.docs.get('timesheet_guards/driver').activeShiftId).toBe(today.id);
  expect(cloud.docs.get(`timesheet_shifts/${today.id}`).status).toBe('active');
  expect(cloud.docs.get(`timesheet_shifts/${result.id}`).recovery.inspectionId).toBe('old-inspection');
});
it('rejects duplicate recovery across browsers', async () => {
  seedEvidence();
  await timesheetStore.saveRecoveredShift(recovered());
  timesheetStore.reset();
  await expect(timesheetStore.saveRecoveredShift(recovered())).rejects.toThrow();
  expect(Array.from(cloud.docs.keys()).filter(key => key.startsWith('timesheet_shifts/'))).toHaveLength(1);
});
it('rejects overlap with remotely stored active hours', async () => {
  seedEvidence();
  await timesheetService.clockIn('driver', 'Driver', 'qr', 'old-open-shift', '2026-10-12T13:00:00Z');
  timesheetStore.reset();
  await expect(timesheetStore.saveRecoveredShift(recovered())).rejects.toThrow('overlap');
});
it('does not show a recovered shift as saved when the cloud commit fails', async () => {
  seedEvidence();
  cloud.failAfter = true;
  await expect(timesheetStore.saveRecoveredShift(recovered())).rejects.toThrow('commit-failed');
  expect(timesheetStore.getAllShifts()).toHaveLength(0);
});

it('rejects recovery if a missing-hours request arrives after the overlap snapshot', async () => {
  seedEvidence();
  cloud.afterReads = async () => {
    await timesheetService.requestCorrection({ shiftId: null, employee: { id: 'driver', name: 'Driver' },
      proposedStart: '2026-10-12T14:00:00Z', proposedEnd: '2026-10-12T22:00:00Z', proposedBreakSeconds: 0, reason: 'Missed clock-in' });
  };
  await expect(timesheetStore.saveRecoveredShift(recovered())).rejects.toThrow();
  expect(cloud.docs.has(`timesheet_shifts/${recovered().id}`)).toBe(false);
});
it('rejects a browser estimate whose source inspection was rejected remotely', async () => {
  seedEvidence(); cloud.docs.get('inspections/old-inspection').status = 'rejected';
  await expect(timesheetStore.saveRecoveredShift(recovered())).rejects.toThrow();
});
it('rejects a stale pair made ambiguous by another remote inspection', async () => {
  seedEvidence(); cloud.docs.set('inspections/extra', { ...cloud.docs.get('inspections/old-inspection'), id: 'extra' });
  await expect(timesheetStore.saveRecoveredShift(recovered())).rejects.toThrow();
});
it('prevents moving recovered hours into a current active shift', async () => {
  seedEvidence();
  const historical = await timesheetStore.saveRecoveredShift(recovered());
  await start();
  await expect(timesheetService.saveManagerEdit(historical.id, { id: 'm', name: 'M' }, 1,
    { startAtUtc: '2026-10-19T14:00:00Z', endAtUtc: '2026-10-19T22:00:00Z' }, 'Corrected dates')).rejects.toThrow('overlap');
});

it('keeps recovered hours pending if cloud approval is rejected', async () => {
  seedEvidence();
  const shift = await timesheetStore.saveRecoveredShift(recovered());
  cloud.failAfter = true;
  await expect(timesheetService.approveShift(shift.id, { id: 'manager', name: 'Manager' }, 1)).rejects.toThrow();
  expect(timesheetStore.getShift(shift.id)?.status).toBe('pending');
});
it('rejects recovery if a manager extends other hours after the overlap snapshot', async () => {
  seedEvidence();
  const other = await timesheetService.clockIn('driver', 'Driver', 'manual', 'earlier', '2026-10-12T08:00:00Z');
  await timesheetService.clockOut('driver', 'manual', 'earlier-end', 0, '2026-10-12T13:00:00Z');
  cloud.afterReads = async () => {
    await timesheetService.saveManagerEdit(other.id, { id: 'manager', name: 'Manager' }, 2,
      { endAtUtc: '2026-10-12T16:00:00Z' }, 'Corrected earlier work');
  };
  await expect(timesheetStore.saveRecoveredShift(recovered())).rejects.toThrow();
  expect(cloud.docs.has(`timesheet_shifts/${recovered().id}`)).toBe(false);
});

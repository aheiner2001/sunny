import { beforeEach, expect, it, vi } from 'vitest';

// A transactional document store: only publishes writes after the callback succeeds.
const cloud = vi.hoisted(() => ({ docs: new Map<string, any>(), fail: false, failAfter: false, retry: false, afterReads: null as null | (() => Promise<void>), queue: Promise.resolve(), listeners: new Map<string, { next: (snapshot: any) => void; fail: () => void }>() }));
vi.mock('@/lib/firebase', () => ({ db: { _isMock: true }, ensureAuth: vi.fn().mockResolvedValue({ uid: 'test' }) }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, id: string) => `${col}/${id}`,
  collection: (_db: unknown, name: string) => name,
  setDoc: vi.fn(async (key: string, value: any) => { cloud.docs.set(key, value); }), deleteDoc: vi.fn(), onSnapshot: vi.fn((name: string, _options: unknown, next: any, fail: any) => {
    cloud.listeners.set(name, { next, fail });
    return () => cloud.listeners.delete(name);
  }),
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
beforeEach(() => { timesheetStore.reset(); cloud.docs.clear(); cloud.fail = false; cloud.failAfter = false; cloud.retry = false; cloud.afterReads = null; cloud.queue = Promise.resolve(); cloud.listeners.clear(); vi.mocked(ensureAuth).mockResolvedValue({ uid: 'test' } as any); });


import { ensureAuth } from '@/lib/firebase';
const enterChecklist = () => timesheetService.clockIn('driver', 'Driver', 'qr', 'inspection-entry', '2026-10-20T14:00:00Z');

it('persists a checklist-entry punch to the server before confirming it locally', async () => {
  let authenticate!: (user: any) => void;
  vi.mocked(ensureAuth).mockReturnValueOnce(new Promise(resolve => { authenticate = resolve; }));
  const pending = enterChecklist();
  expect(cloud.docs.size).toBe(0);
  expect(timesheetStore.getAllShifts()).toHaveLength(0);
  authenticate({ uid: 'test' });
  await pending;
  const [shift] = timesheetStore.getAllShifts();
  expect(cloud.docs.get(`timesheet_shifts/${shift.id}`)).toMatchObject({ employeeId: 'driver', status: 'active', startAtUtc: shift.startAtUtc });
  expect(cloud.docs.get('timesheet_guards/driver').activeShiftId).toBe(shift.id);
  expect(Array.from(cloud.docs.keys()).filter(key => key.startsWith('timesheet_audit/'))).toHaveLength(1);
  expect(JSON.parse(localStorage.getItem('sunny_timesheet_shifts')!)[0].id).toBe(shift.id);
  expect(timesheetStore.getSyncStatus()).toBe('Last timesheet save confirmed');
});

it('closes the same cloud shift from a fresh browser and persists pending approval and clock-out audit', async () => {
  const original = await timesheetService.clockIn('driver', 'Driver', 'qr', 'start', '2026-10-20T14:00:00Z');
  timesheetStore.reset();
  localStorage.clear();
  const closed = await timesheetService.clockOut('driver', 'checklist_return', 'return-saved-checklist', 0, '2026-10-20T22:00:00Z');
  expect(closed.id).toBe(original.id);
  expect(cloud.docs.get(`timesheet_shifts/${closed.id}`)).toMatchObject({
    status: 'pending', startAtUtc: '2026-10-20T14:00:00Z', endAtUtc: '2026-10-20T22:00:00Z',
    endSource: 'checklist_return', approvedBy: null,
  });
  expect(cloud.docs.get('timesheet_guards/driver').activeShiftId).toBeNull();
  expect(Array.from(cloud.docs.values()).filter(value => value.action === 'clock_out')).toHaveLength(1);
});

it('does not create fake synced hours after a denied checklist-entry write and allows retry', async () => {
  cloud.fail = true;
  await expect(enterChecklist()).rejects.toThrow('permission-denied');
  expect(cloud.docs.size).toBe(0);
  expect(timesheetStore.getAllShifts()).toHaveLength(0);
  expect(timesheetStore.getSyncStatus()).toContain('save failed');
  cloud.fail = false;
  await enterChecklist();
  expect(timesheetStore.getAllShifts()).toHaveLength(1);
  expect(timesheetStore.getSyncStatus()).toBe('Last timesheet save confirmed');
});

it('keeps the remote shift active if the clock-out commit is rejected', async () => {
  const shift = await timesheetService.clockIn('driver', 'Driver', 'qr', 'start', '2026-10-20T14:00:00Z');
  cloud.failAfter = true;
  await expect(timesheetService.clockOut('driver', 'checklist_return', 'end', 0, '2026-10-20T22:00:00Z')).rejects.toThrow('commit-failed');
  expect(cloud.docs.get(`timesheet_shifts/${shift.id}`).status).toBe('active');
  expect(cloud.docs.get('timesheet_guards/driver').activeShiftId).toBe(shift.id);
  expect(timesheetStore.getShift(shift.id)?.status).toBe('active');
  expect(Array.from(cloud.docs.values()).filter(value => value.action === 'clock_out')).toHaveLength(0);
});

it('requires authentication before writing and never confirms an unauthenticated punch', async () => {
  vi.mocked(ensureAuth).mockResolvedValueOnce(null);
  await expect(enterChecklist()).rejects.toThrow('authentication unavailable');
  expect(cloud.docs.size).toBe(0);
  expect(timesheetStore.getAllShifts()).toHaveLength(0);
});

it('only reports live cloud sync after server-confirmed snapshots for all four collections', async () => {
  const shift = await timesheetService.clockIn('driver', 'Driver', 'qr', 'start', '2026-10-20T14:00:00Z');
  timesheetStore.reset();
  await timesheetStore.setupFirestoreListeners();
  expect(cloud.listeners.size).toBe(4);
  const emit = (name: string, fromCache: boolean, hasPendingWrites = false) => {
    const entries = Array.from(cloud.docs.entries()).filter(([key]) => key.startsWith(name + '/')).map(([, value]) => value);
    cloud.listeners.get(name)!.next({
      metadata: { fromCache, hasPendingWrites },
      forEach: (receive: any) => entries.forEach(value => receive({ data: () => value })),
    });
  };
  const collections = ['timesheet_shifts', 'timesheet_guards', 'timesheet_audit', 'timesheet_corrections'];
  for (const name of collections) emit(name, true);
  expect(timesheetStore.getSyncStatus()).not.toBe('Firebase Cloud Sync Active');
  for (const name of collections) emit(name, false);
  expect(timesheetStore.getSyncStatus()).toBe('Firebase Cloud Sync Active');
  expect(timesheetStore.getShift(shift.id)?.status).toBe('active');
  emit('timesheet_shifts', false, true);
  expect(timesheetStore.getSyncStatus()).not.toBe('Firebase Cloud Sync Active');
  emit('timesheet_shifts', false);
  expect(timesheetStore.getSyncStatus()).toBe('Firebase Cloud Sync Active');
});
